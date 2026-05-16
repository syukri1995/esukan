# E-Sukan — Vercel frontend + TiDB + Java API host

This app is split for typical free-tier hosting:

- **Vercel**: static UI (`npm run build` → `public/`) + Edge `middleware.js` proxies `/api/*` to your API.
- **Backend**: Docker image ([Dockerfile](Dockerfile)) on [Render](https://render.com) (see [render.yaml](render.yaml)) or similar — **not** on Vercel (Java servlet WAR).
- **Database**: [TiDB Cloud Serverless](https://www.pingcap.com/tidb-cloud-serverless/) (MySQL-compatible).

## 1. TiDB Cloud

1. Create a cluster and database (e.g. `esukan_db`).
2. Copy the **MySQL** connection string from the console.
3. Set on your Java host:

   - `SPRING_DATASOURCE_URL` — JDBC URL (include TLS parameters as TiDB documents).
   - `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD`
   - `SPRING_JPA_HIBERNATE_DDL_AUTO=update` for a first deploy (then consider `validate` + migrations).

4. Run [sql/schema.sql](sql/schema.sql) once in the TiDB SQL editor (or use [sql/migration-auth-tournaments.sql](sql/migration-auth-tournaments.sql) on an existing MySQL volume).

## 2. Backend API (Render free tier + Docker)

**One-click (recommended):** [Deploy to Render](https://render.com/deploy?repo=https://github.com/HoboPenny/CSC584_GroupProject) — uses [render.yaml](render.yaml) (free plan, Singapore region).

Or run `.\scripts\deploy-free-backend.ps1` from this folder (opens the same link).

Manual: [Render](https://render.com) → **New** → **Blueprint** → repo `HoboPenny/CSC584_GroupProject`, branch `servlet-update`.
3. Set environment variables (from your local `.env` / TiDB console):

| Variable | Purpose |
|----------|---------|
| `ESUKAN_DB_USE_H2` | `false` |
| `SPRING_DATASOURCE_URL` | TiDB JDBC URL (`esukan_db`, TLS; omit Windows `serverSslCert` paths — use JVM trust store). |
| `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | TiDB credentials |
| `ESUKAN_JWT_SECRET` | Long random secret (≥ 32 bytes) for JWT |

4. Deploy and note the public URL, e.g. `https://esukan-api.onrender.com`.
5. Smoke test: `https://esukan-api.onrender.com/login.html` and `POST .../api/auth/login`.

CORS: servlets allow `*`; Vercel uses same-origin `/api` via middleware, so extra CORS config is optional.

Optional email for password reset:

| Variable | Purpose |
|----------|---------|
| `SPRING_MAIL_HOST`, `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD` | SMTP for forgot-password emails. |

## 3. Vercel (static UI)

1. [Vercel](https://vercel.com) → **Add New Project** → import Git repo.
2. Set **Root Directory** to `CSC584_GroupProject` (if the repo root is `esukan`).
3. Framework preset: **Other** (uses [vercel.json](vercel.json): `npm run build`, output `public/`).
4. Environment variable:

| Variable | Example |
|----------|---------|
| `BACKEND_URL` | `https://esukan-api.onrender.com` (no trailing slash) |

`middleware.js` forwards browser calls from `/api/*` to `BACKEND_URL/api/*`. Leave `window.ESUKAN_API_BASE` empty in HTML.

5. Deploy. Open `https://<your-project>.vercel.app/login.html`.

CLI (from `CSC584_GroupProject`):

```bash
npx vercel@latest --prod
```

Set `BACKEND_URL` in the Vercel project settings before testing login.

## 4. Order of operations

1. TiDB: database `esukan_db` + schema (app bootstrap or [sql/schema.sql](sql/schema.sql)).
2. Deploy **backend** (Render); confirm `/login.html` and `/api/auth/login`.
3. Deploy **Vercel** with `BACKEND_URL` pointing at the API host.
4. Log in with seeded users (see README) or register a new student.
