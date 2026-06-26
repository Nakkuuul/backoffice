# auth-service

Owns **authentication** and **registration** for the backoffice. Splits the
identity concern out of `user-service` (which now only *administers* existing
users). Uses the shared `users` table and the shared RBAC catalog
(`src/shared/rbac.js`).

## Tokens (access + refresh)

- **Access token** — short-lived JWT (`AUTH_ACCESS_TTL`) carrying
  `{ id, role, type, clientRef, mcp }`. Stateless; verified by the `authenticate`
  middleware. `mcp` = must-change-password.
- **Refresh token** — opaque 32-byte random string (`AUTH_REFRESH_TTL`). Only its
  **SHA-256 is stored** in `auth_sessions`, so a DB leak can't mint access tokens.
  Refresh **rotates** (old token revoked on use) and is **revocable** (logout,
  password change).

## Master user (first boot)

`initAuthService()` runs on startup and seeds a **master `super_admin`** if none
exists (idempotent), from `AUTH_MASTER_EMAIL/PASSWORD/NAME`. The master is created
with **`must_change_password = true`**, so its first login forces a reset.

## Forced password change (first login)

Any admin-set password requires a change on next login:
- master seed, `register` (admin-created users), and admin `reset-password` all
  set `must_change_password = true`.
- The access token carries `mcp: true`. The `authenticate` middleware **blocks
  every route with `403 PASSWORD_CHANGE_REQUIRED`** except `/auth/change-password`,
  `/auth/me`, and `/auth/logout` until the user changes their password.
- Self-service `change-password` clears the flag, **revokes all prior sessions**,
  and issues a fresh access+refresh pair so the user proceeds seamlessly.

## Two-factor authentication (TOTP) + multi-step login

Login is a **state machine**. `POST /auth/login` verifies the password and then
returns either a fully-authenticated result or a **challenge** with a short-lived
**interim token** (`pre: true`) describing the next `stage`. The interim token is
restricted by the gate to the step-up endpoints only; **no refresh session is
created until login fully completes** — so a refreshed/established session always
implies 2FA was passed.

```
login(email,password)
  └─ stage "change_password"   → POST /auth/change-password   (forced first-login)
  └─ stage "enroll_2fa"        → POST /auth/2fa/setup → /2fa/enable   (first time)
  └─ stage "verify_2fa"        → POST /auth/2fa/verify           (returning logins)
  └─ stage "authenticated"     → { token, refreshToken, user, permissions }
```

- **First login:** change password → scan the QR (`/2fa/setup` returns a PNG data
  URL + otpauth URI + base32 secret) → confirm a code (`/2fa/enable`) → 2FA on,
  **recovery codes shown once**, logged in.
- **Returning logins:** password → `/2fa/verify` with the authenticator code (or a
  one-time recovery code) → logged in.
- TOTP secret is stored **AES-256-GCM encrypted** at rest; recovery codes stored
  as SHA-256, single-use. Toggle the whole feature with `AUTH_2FA_ENABLED`.

## Forgot access (password reset) — multi-channel

Self-service recovery for a forgotten password, with **multiple delivery options**:

```
POST /auth/forgot-password { email, method }
  method "email_link" → 256-bit token in a one-time link (default)
  method "email_otp"  → 6-digit one-time code by email
  method "sms_otp"    → 6-digit one-time code by SMS (needs a phone on file)
POST /auth/reset-password { token, newPassword }                 # link
POST /auth/reset-password { email, otp, newPassword }            # OTP
POST /auth/reset-password/verify { token } → { valid }           # link pre-check (UX)
```

Credentials live in `password_reset_tokens` and only their **SHA-256 hash** is
stored. Reset **does not log the user in** and **does not bypass 2FA** — they sign
in fresh afterwards, so e-mail/SMS control alone never grants access. SMS uses a
pluggable provider (`auth-service/sms`, default `stub` that only logs — no on-prem
gateway yet).

**Security properties of the reset flow:**
- **Enumeration-safe:** `forgot-password` always returns the same `200`
  regardless of whether the account exists, is active, or has a phone.
- **Short-lived + single-use:** link `AUTH_RESET_LINK_TTL` (30m), OTP
  `AUTH_RESET_OTP_TTL` (10m); link claimed atomically (replay-safe), OTP consumed
  atomically on success.
- **OTP brute-force bounded:** wrong codes increment `attempts`; the row locks at
  `AUTH_RESET_OTP_MAX_ATTEMPTS` (5). Plus per-(ip,email) rate limiting and a
  per-user request throttle (`AUTH_RESET_MAX_REQUESTS`/window).
- **Only the newest credential is valid** (prior tokens invalidated on each request).
- On success: new password set, **all sessions revoked**, all other reset tokens
  invalidated, and reuse of the current password is rejected.

## API (`/api/v1/auth`)

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| POST | `/login` | public | email+password → full result **or** a `{ stage, token, … }` challenge |
| POST | `/refresh` | public (refresh token) | rotate → new `{ token, refreshToken }` |
| POST | `/forgot-password` | public (rate-limited) | issue a reset link/OTP via `email_link` \| `email_otp` \| `sms_otp` — uniform 200 |
| POST | `/reset-password` | public (rate-limited) | complete reset with `{ token }` or `{ email, otp }` + `newPassword` |
| POST | `/reset-password/verify` | public (rate-limited) | `{ token }` → `{ valid }` (link pre-check) |
| POST | `/logout` | token | revoke the supplied refresh session — or **all** the user's sessions if no token is given ("sign out everywhere") |
| GET | `/me` | token (incl. interim) | `{ user, permissions }` |
| POST | `/change-password` | token (incl. interim) | change → next stage (login flow) or fresh tokens (routine) |
| POST | `/2fa/setup` | interim/token | begin enrollment → `{ qrCode, otpauthUrl, secret }` |
| POST | `/2fa/enable` | interim/token | confirm `{ code }` → enable, returns tokens + `recoveryCodes` |
| POST | `/2fa/verify` | interim/token | `{ code }` (TOTP or recovery) → full tokens |
| POST | `/register` | token + `users:manage` | create a user (forced first-login reset + 2FA enroll) |

> Admin **2FA reset** for a locked-out user: `POST /users/:id/reset-2fa`
> (`users:manage`) — disables TOTP so the user re-enrolls on next login.
> User **administration** lives in `user-service` at `/api/v1/users`.

> User **administration** (list/get/update/deactivate/reset-password, role
> catalog) lives in `user-service` at `/api/v1/users`.

## Security properties
(Hardened after an adversarial security review — see fixes below.)
- Passwords hashed with bcrypt (10 rounds). Login compares against a **valid**
  bcrypt dummy hash for unknown users so the cost matches a real check — no
  timing-based user enumeration.
- Refresh tokens stored hashed; **rotation is atomic** (`claimSession` revokes +
  returns in one statement) so a token can't be replayed/redeemed twice.
- Revoked on logout (one or all sessions) and on password change (all sessions).
- **mcp gate** matches the request PATH only (query string stripped, exact suffix)
  so an exempt path can't be smuggled via `?x=/auth/me`.
- **Privilege guards** on user management: only a super_admin can create/assign
  the `super_admin` role; a non-super_admin cannot modify or reset a super_admin;
  nobody can change their own role/active status via the admin endpoints.
- RBAC enforced on `register` (`users:manage`); `super_admin` bypasses role checks.
- All SQL is parameterized; Zod validates + strips unknown fields (no mass-assignment
  of `role`/`is_active`/`must_change_password`/`created_by`).
- Client users always keep a `clientRef` (enforced on register **and** update).
- The interim-token gate is **stage-exact** (router-relative path match) — a
  later stage can't reach an earlier stage's endpoint (e.g. verify→setup).
- **Rate limiting** on login / 2FA verify+enable+setup / change-password
  (per ip+identity) → `429 TOO_MANY_REQUESTS`. TOTP secret decryption fails
  closed (never 500s on tampered ciphertext); boot fails fast if 2FA is on
  without an encryption key.

## Config / env
`JWT_SECRET`, `AUTH_ACCESS_TTL` (e.g. 15m), `AUTH_REFRESH_TTL` (e.g. 30d),
`AUTH_CHALLENGE_TTL` (interim-token TTL, e.g. 10m), `AUTH_MASTER_EMAIL/PASSWORD/NAME`.
2FA: `AUTH_2FA_ENABLED`, `AUTH_2FA_ISSUER`, `AUTH_2FA_WINDOW`, `AUTH_2FA_RECOVERY_CODES`,
`AUTH_ENC_KEY` (base64 32-byte AES key for TOTP secrets; falls back to `ESIGN_ENC_KEY`).
Reset: `APP_PUBLIC_URL` (frontend base for the reset link), `AUTH_RESET_LINK_TTL`,
`AUTH_RESET_OTP_TTL`, `AUTH_RESET_OTP_MAX_ATTEMPTS`, `AUTH_RESET_MAX_REQUESTS`,
`AUTH_RESET_WINDOW_MS`. SMS: `SMS_PROVIDER` (default `stub`), `SMS_SENDER_ID`.

## Diagnostics
```bash
npm run auth:test        # service-level: full flow incl. 2FA enroll/verify + recovery codes
npm run auth:test-http   # HTTP: the staged login over the wire (gate codes, QR, enable/verify)
npm run auth:test-reset  # password reset: link + OTP, single-use, attempt-lock, enumeration-safe
```

## TODO / roadmap
- [x] Rate limiting on login + 2FA + change-password (in-memory).
- [x] httpOnly-cookie tokens for the browser — handled at the **frontend BFF**
  (`frontend/src/app/bff/auth/*` + `lib/server/auth-bff.ts`): the backend still
  returns tokens as JSON, and the Next route handlers store the access / refresh /
  interim tokens in httpOnly+SameSite cookies so JS never sees them.
- [ ] Back rate-limiting with Redis for a multi-node fleet (currently per-process).
- [ ] Audit log of auth events (login, 2FA enable/verify, resets).
- [ ] Password strength policy + breached-password check.
- [ ] SSO / WebAuthn (passkeys) as alternative second factors.
