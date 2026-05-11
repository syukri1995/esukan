# E-Sukan — Vercel frontend + TiDB + free Java host

This app is split for typical free-tier hosting:

- **Vercel**: static UI from `src/main/resources/static` (see [vercel.json](vercel.json)).
- **Backend**: Spring Boot JAR on [Render](https://render.com), [Fly.io](https://fly.io), [Google Cloud Run](https://cloud.google.com/run), etc.
- **Database**: [TiDB Cloud Serverless](https://www.pingcap.com/tidb-cloud-serverless/) (MySQL-compatible).

## 1. TiDB Cloud

1. Create a cluster and database (e.g. `esukan_db`).
2. Copy the **MySQL** connection string from the console.
3. Set on your Java host:

   - `SPRING_DATASOURCE_URL` — JDBC URL (include TLS parameters as TiDB documents).
   - `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD`
   - `SPRING_JPA_HIBERNATE_DDL_AUTO=update` for a first deploy (then consider `validate` + migrations).

4. Run [sql/schema.sql](sql/schema.sql) once in the TiDB SQL editor (or use [sql/migration-auth-tournaments.sql](sql/migration-auth-tournaments.sql) on an existing MySQL volume).

## 2. Backend (example env)

Set at minimum:

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (many hosts inject this; Spring uses `server.port=${PORT:8080}`). |
| `SPRING_DATASOURCE_*` | TiDB JDBC credentials. |
| `ESUKAN_JWT_SECRET` | Long random secret (≥ 32 bytes) for HS256 JWT signing. |
| `ESUKAN_CORS_ALLOWED_ORIGINS` | Your Vercel URL, e.g. `https://your-app.vercel.app` (comma-separated). Omit rewrite on Vercel if you rely on CORS only. |

Optional email for password reset:

| Variable | Purpose |
|----------|---------|
| `SPRING_MAIL_HOST`, `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD` | SMTP for forgot-password emails. |

## 3. Vercel

1. In [vercel.json](vercel.json), replace `REPLACE_WITH_YOUR_BACKEND_HOST` in `rewrites` with your API origin **without** a trailing slash (e.g. `https://esukan-api.onrender.com`). This proxies `/api/*` through Vercel so the SPA can call same-origin `/api/...` and avoid CORS.
2. If you **do not** use rewrites, remove the `rewrites` block and inject before `auth.js` on each HTML page:  
   `window.ESUKAN_API_BASE = 'https://your-api.example.com';`
3. Deploy the repository root; the build copies static assets into `public/`.

## 4. Order of operations

1. Apply DB schema on TiDB.
2. Deploy backend; confirm `GET /actuator/health`.
3. Deploy Vercel; set rewrite or `ESUKAN_API_BASE`.
4. Log in with seeded users (see README) or register a new student.
