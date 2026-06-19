# AGENTS.md — 编程狗社区 (Coding Dog Community)

## Overview

Vue 3 + Node.js/Express programming community platform. Two independent packages: `client/` (Vue3+Vite+Element Plus) and `server/` (Express+Sequelize). No monorepo tooling — each package has its own `package.json` and `node_modules/`.

## Development Commands

```bash
# Frontend (separate terminal)
cd client && npm install && npm run dev    # starts on port 8080, proxies /api → localhost:3001
```

```bash
# Security/consistency checks (run from server/)
npm run check:consistency     # validates codebase invariants
npm run security:attack       # security attack tests
npm run security:targeted     # targeted production boundary tests
```

## Build & Deploy

```bash
cd client && npm run build           # produces client/dist/
docker-compose up -d --build         # full Docker build (frontend + backend in one container)
```

Docker uses `network_mode: host` — the server binds directly to host port 3001. No separate frontend container in production; the Express server serves `client/dist/` static files.

## Environment

- Copy `.env.example` to `.env` in repo root (Docker) or `server/.env` (local dev).
- `DB_TYPE`: `sqlite` (default, file at `server/data/database.sqlite`) or `mysql`.
- `PORT` env var takes priority over `SERVER_PORT` for the backend port.
- `JWT_SECRET` and `SESSION_SECRET` must be set (>=32 chars). Production exits if missing.
- `CORS_ORIGIN` is required in production (`NODE_ENV=production`).
- `client/.env.production` sets `VITE_API_BASE_URL=/api`.

## Architecture

### Server (`server/`)

- **Entry**: `app.js` — loads dotenv, configures Express (CORS, sessions, rate limiting, body parsing, security headers, CSP), mounts all routes, serves static frontend, starts server.
- **Config**: `config/database.js` (Sequelize setup), `config/auth.js` (JWT secret resolution), `config/permissions.js` (role hierarchy).
- **Middleware**: `middleware/auth.js` (JWT auth, optionalAuth, adminMiddleware), `middleware/rateLimit.js`, `middleware/hcaptcha.js`, `middleware/geetest.js`, `middleware/response.js` (pagination helpers), `middleware/operationLog.js`.
- **Models**: Single file `models/index.js` — all Sequelize models defined here (User, Work, Comment, Post, Studio, StudioMember, StudioWork, Report, Like, Favorite, Follow, Notification, Announcement, Banner, IpBan, CaptchaStats, SystemConfig, OperationLog, RolePermission, Statistics, SensitiveWord). Relations defined at bottom.
- **Utils**: `utils/dbAdapter.js` — abstraction layer for SQLite vs MySQL differences.
- **Roles**: `user` → `reviewer` → `moderator` → `admin` → `superadmin`. Checked via `isRoleAtLeast()`.

### Client (`client/`)

- **Stack**: Vue 3 + Vite + Element Plus + Pinia + Vue Router + Sass.
- **Alias**: `@` maps to `client/src/`.
- **API layer**: `src/api/request.js` creates an Axios instance with `/api` baseURL, handles auth tokens and 401 redirects.
- **Routes**: `src/router/index.js`. `/register` redirects to `/login`. Admin panel at `/admin`.
- **No test framework configured** in the client package.

## Key Conventions

- All API responses use `{ code, msg, data }` format. Pagination uses both `data.total` and `data.pagination`.
- Auth is JWT-based (Bearer token in `Authorization` header) + optional session-based for some flows.
- Work statuses: `pending`, `published`, `rejected`, `deleted`. Post statuses: `active`, `published`, `draft`, `hidden`, `deleted`.
- Content moderation: AI review service (`services/aiReview.js`) + sensitive word filtering.
- Captcha support: Geetest and hCaptcha (optional, configured via env vars).
- The `【给ai的】源站编程猫社区的api/` directory contains reference API docs for the original Codemao platform — useful context for understanding the data model.

## Security Invariants (checked by `scripts/check-consistency.js`)

- `x-powered-by` is disabled, security headers (CSP, X-Frame-Options, nosniff) are set.
- JSON body limit is 256kb. `pageSize` is capped at 100.
- Production requires explicit `CORS_ORIGIN` and strong `SESSION_SECRET`/`JWT_SECRET`.
- Login rate limited (10 attempts / 15 min). Codemao import rate limited (20 / 10 min). General write rate limited (120 / 1 min).
- hcaptchaGuard runs on all `/api/` routes except `/api/health`.
- Avatar uploads verify file type and signature. Database migration routes require superadmin.
