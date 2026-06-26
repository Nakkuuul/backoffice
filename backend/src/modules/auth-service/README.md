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

## API (`/api/v1/auth`)

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| POST | `/login` | public | email+password → `{ token, refreshToken, user, permissions, mustChangePassword }` |
| POST | `/refresh` | public (refresh token) | rotate → new `{ token, refreshToken, mustChangePassword }` |
| POST | `/logout` | token | revoke the supplied refresh session — or **all** the user's sessions if no token is given ("sign out everywhere") |
| GET | `/me` | token | `{ user, permissions }` |
| POST | `/change-password` | token | self-service change → fresh tokens (clears mcp) |
| POST | `/register` | token + `users:manage` | create a user (forced first-login reset) |

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
- All SQL is parameterized; Joi validates + strips unknown fields (no mass-assignment
  of `role`/`is_active`/`must_change_password`/`created_by`).
- Client users always keep a `clientRef` (enforced on register **and** update).

## Config / env
`JWT_SECRET`, `AUTH_ACCESS_TTL` (e.g. 15m), `AUTH_REFRESH_TTL` (e.g. 30d),
`AUTH_MASTER_EMAIL/PASSWORD/NAME`.

## Diagnostics
```bash
npm run auth:test        # service-level: login/refresh-rotation/forced-change/revocation
npm run auth:test-http   # HTTP: the 403 PASSWORD_CHANGE_REQUIRED gate end-to-end (server up)
```

## TODO / roadmap
- [ ] httpOnly refresh-token cookie option (vs JSON body) for browser clients.
- [ ] Login rate-limiting / lockout + audit log of auth events.
- [ ] Password strength policy + breached-password check.
- [ ] Optional 2FA for broker staff; SSO later.
