# user-service

> **Note:** Authentication + registration moved to **`auth-service`** (`/auth`).
> This module now **administers existing users** (`/users`) and owns the RBAC
> catalog (now at `src/shared/rbac.js`). Login/`me`/register/change-password are
> in auth-service.

Defines the **role-based access control (RBAC)** model and administers user
records — broker-side staff and client-side logins. There's a single UI; the
backend tells the frontend *what the user may do* (effective permissions from
`GET /auth/me`), and also **enforces** it on every endpoint.

## Two scopes

| `user_type` | Who | Roles |
| ----------- | --- | ----- |
| **broker** | internal staff | `super_admin`, `admin`, `compliance`, `operations`, `support`, `auditor` |
| **client** | external customers | `client` (sees only their own data) |

## RBAC model (`rbac.js`)

Roles and their permissions are defined **in code** (versioned, auditable — a
broker's role set is fixed and security-sensitive). A user is assigned exactly
one role; their **effective permissions** are resolved from the catalog.

Permissions are `domain:action` strings with wildcard support:
- `*` → everything (super_admin)
- `reports:*` → all reports permissions

| Role | Summary |
| ---- | ------- |
| **super_admin** | Everything, incl. system config (DSC PIN, SMTP/relay) and user management |
| **admin** | Users, clients, all day-to-day ops (`reports:*`, `documents:*`, esign sign, email send). *Not* sensitive config |
| **compliance** | Sign docs, run/inspect reports, audit trail |
| **operations** | Generate/bulk reports, process documents, send emails |
| **support** | View client data, re-send communications |
| **auditor** | Read-only across the backoffice |
| **client** | `self:profile`, `self:reports:read`, `self:documents:read` — own data only |

### Enforcement
- `authenticate` (JWT) sets `req.user = { id, role, type, clientRef }`.
- `requirePermission('reports:generate')` guards routes by permission.
- `authorize('admin', …)` guards by role (super_admin always passes).
- `super_admin` bypasses role checks and holds `*`.

> Client data-scoping (a client only seeing rows for *their* `clientRef`) is
> enforced per-endpoint in each module using `req.user.clientRef` — the RBAC
> layer grants the `self:*` capability; the module filters the data.

## How the single UI works
The frontend calls **`GET /auth/me`** after login → `{ user, permissions }`. It
shows/hides features based on `permissions` (e.g. show "Generate Report" only if
`reports:generate` is present). The backend independently enforces the same
permissions, so the UI is convenience, not the security boundary.

## API

**Auth — `/api/v1/auth`**
| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| POST | `/login` | public | email+password → `{ token, user, permissions }` |
| GET | `/me` | token | current user + effective permissions |
| POST | `/change-password` | token | change own password |

**User management — `/api/v1/users`** (RBAC: `users:read` / `users:manage`)
| Method | Path | Permission | Purpose |
| ------ | ---- | ---------- | ------- |
| GET | `/roles` | users:read | RBAC catalog (roles + permissions) for the UI |
| GET | `/` | users:read | list users |
| POST | `/` | users:manage | create a user |
| GET | `/:id` | users:read | get a user |
| PATCH | `/:id` | users:manage | update role / active / profile |
| POST | `/:id/reset-password` | users:manage | admin reset |

## Auth details
- Passwords hashed with **bcrypt** (bcryptjs, 10 rounds).
- JWT carries `{ id, role, type, clientRef }`; permissions are derived from the
  role per request (role changes take effect on next token; short-lived tokens
  recommended). `is_active` checked at login.

## Bootstrap / CLI

```bash
# create the first super_admin (or any user)
npm run user:create -- admin@yourdomain.com 'StrongPass#1' super_admin 'Platform Admin'
# create a client login (clientRef links to their account)
npm run user:create -- client@x.com 'StrongPass#1' client CL0001 'Client Name'
```

A super_admin (`admin@sapphirebroking.net`) was created during setup — **change
its password** via `/auth/change-password`.

## Diagnostics
```bash
npm run users:test    # create roles, login, assert permission resolution
```

## TODO / roadmap
- [ ] Per-module client data-scoping (filter by `clientRef` for client users).
- [ ] Refresh tokens / token revocation list; `is_active` re-check per request.
- [ ] Audit log of user/role changes (who changed what).
- [ ] Optional DB-editable custom roles on top of the code catalog.
- [ ] 2FA for broker staff.
