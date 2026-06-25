# Backoffice

Monolithic Node.js backoffice for broker operations. Designed for **on-premise deployment** on the broker's local server.

- **Runtime:** Node.js 20+ (ESM)
- **HTTP:** Express
- **Database:** PostgreSQL (`pg`)
- **Logging:** pino (JSON in prod)
- **Process manager:** PM2 (cluster mode)

## Architecture

A **modular monolith**: one deployable process, organized into self-contained feature modules. Each module follows a layered pattern:

```
routes → controller → service → repository → database
```

- **routes** — HTTP endpoints and middleware wiring
- **controller** — parse request / shape response (no business logic)
- **service** — business rules, orchestration, transactions
- **repository** — all SQL / data access (uses the shared pool)

## Folder structure

```
backoffice/
├── src/
│   ├── server.js              # entry point: HTTP server + graceful shutdown
│   ├── app.js                 # Express app assembly (no side effects)
│   ├── config/                # env loading + validated config
│   ├── api/
│   │   ├── routes/            # top-level route aggregator
│   │   └── middlewares/       # auth, validate, error handler, 404
│   ├── modules/               # feature modules (modular monolith)
│   │   ├── health/            # liveness/readiness probes (implemented)
│   │   ├── auth/              # authentication (skeleton)
│   │   └── users/             # user management (skeleton)
│   ├── db/
│   │   ├── pool.js            # shared PostgreSQL pool + withTransaction
│   │   ├── migrations/        # NNN_name.sql forward migrations
│   │   └── seeds/             # seed data
│   ├── shared/
│   │   ├── errors/            # AppError hierarchy
│   │   ├── utils/             # logger, asyncHandler, ...
│   │   └── constants/
│   ├── jobs/                  # scheduled / cron tasks
│   └── integrations/          # external system clients
├── scripts/                   # migrate.js, seed.js
├── tests/                     # unit + integration
├── logs/                      # runtime logs (gitignored)
├── docs/
├── ecosystem.config.cjs       # PM2 deployment config
└── .env.example
```

## Getting started

```bash
cp .env.example .env      # fill in DB credentials + JWT secret
npm install
npm run migrate           # apply DB migrations
npm run dev               # start with auto-reload
```

Health check: `GET http://localhost:3000/api/v1/health/live`

## Scripts

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Start with `--watch` auto-reload     |
| `npm start`        | Start (production)                   |
| `npm run migrate`  | Apply pending DB migrations          |
| `npm run seed`     | Run seeders                          |
| `npm test`         | Run tests (node:test)                |
| `npm run lint`     | Lint                                 |
| `npm run format`   | Format with Prettier                 |

## Deployment (local server)

```bash
npm ci --omit=dev
npm run migrate
pm2 start ecosystem.config.cjs --env production
pm2 save && pm2 startup
```

## Adding a module

1. Create `src/modules/<name>/` with `<name>.routes.js`, `.controller.js`, `.service.js`, `.repository.js`, `.validation.js`.
2. Mount it in `src/api/routes/index.js`.
3. Add migrations under `src/db/migrations/`.
