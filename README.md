# E-Sukan — Campus Facility & Equipment Booking System

A web application for managing campus sports facilities and equipment rentals. Built with **Jakarta Servlet 6**, **Java 17**, **JDBC (HikariCP)**, and a responsive **HTML/CSS/JavaScript** dashboard. The build produces a **WAR** (`esukan.war`) for Servlet 6 / Jakarta EE 10 containers; local development uses **embedded Jetty** on port **9090**.

---

## Requirements

| Requirement | Version | Notes |
|-------------|---------|--------|
| **JDK** | **17** (LTS) | Confirm with `java -version`. |
| **Apache Maven** | **3.9+** | On `PATH` as `mvn`. No Maven Wrapper in this repo. |
| **MySQL / TiDB** | **8.0+** / Serverless | **Only when `ESUKAN_DB_USE_H2=false`** (default local run uses H2). |
| **Docker** (optional) | Recent stable | Tomcat + MySQL via `docker compose` / `Dockerfile`. |

```powershell
java -version
mvn -version
```

First build downloads dependencies from **Maven Central**. Corporate proxies may need a trusted CA or Maven `settings.xml` mirror.

---

## Installation and how to run

### 1. Get the code

```powershell
git clone <your-repo-url> esukan
cd esukan\CSC584_GroupProject
```

### 2. Run locally (H2 in-memory, recommended)

No MySQL setup. Schema and sample data are applied on startup via `EsukanContextListener` when tables are empty.

```powershell
mvn jetty:run
```

Keep the terminal open until you stop with `Ctrl+C`.

**URLs (default port 9090):**

- **Login:** http://localhost:9090/login.html
- **Dashboard:** http://localhost:9090/index.html

**Alternative:** `.\scripts\run-jetty-h2.ps1` (builds WAR, then runs Jetty).

**Port already in use?** Change `<port>9090</port>` in `pom.xml` (Jetty plugin) or stop the process on 9090.

### 3. Run locally against MySQL or TiDB

1. Copy [`.env.example`](.env.example) to **`.env`** in this folder.
2. Set:
   - `ESUKAN_DB_USE_H2=false`
   - `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` (JDBC URL from TiDB/MySQL console; TLS params as required).
3. Run:

```powershell
mvn jetty:run
```

Or: `.\scripts\run-jetty-tidb.ps1`

Optional: run [`sql/schema.sql`](sql/schema.sql) once on a fresh hosted database.

### 4. Build WAR (deploy, no dev server)

```powershell
mvn clean package -DskipTests
```

Artifact: `target/esukan.war` — deploy to Tomcat 10+, Jetty 12 EE10, or any **Servlet 6** container.

**Docker (Tomcat on 8080):**

```powershell
docker build -t esukan:latest .
docker compose up -d --build
```

See [DEPLOYMENT.md](DEPLOYMENT.md) and [DEPLOYMENT_VERCEL_TIDB.md](DEPLOYMENT_VERCEL_TIDB.md).

---

## Features

- **Facility management** — Courts and sports facilities
- **Booking system** — Date/time reservations and status workflow
- **Equipment rentals** — Inventory and checkout/return
- **Waitlist** — Queue when slots are full
- **Payments** — Booking/rental payment records
- **Tournaments** — Lecturers create events; students register teams while status is **OPEN**
- **Dashboard** — Stats, inventory health, peak hours, schedule
- **Admin controls** — Users, bookings, equipment
- **Authentication** — JWT login, registration, forgot/reset password; roles **STUDENT**, **LECTURER**, **ADMIN**
- **Responsive UI** — Static SPA-style dashboard (`index.html`, `css/`, `js/`)

### Seeded accounts (empty `users` table)

| Username   | Password      | Role     |
|-----------|---------------|----------|
| `admin`   | `admin123`    | ADMIN    |
| `lecturer`| `lecturer123` | LECTURER |
| `student` | `student123`  | STUDENT  |

Change these in any shared or production environment.

**Smoke automation** (created if missing): `smoke_student` / `smoke123`, `smoke_admin` / `smoke123` — for `scripts/smoke-prod.ps1` only.

### Auth API

- `POST /api/auth/register` — Register (default role STUDENT)
- `POST /api/auth/login` — Returns JWT; use `Authorization: Bearer <token>` on protected `/api/**` routes
- `GET /api/auth/me` — Current user
- `POST /api/auth/forgot-password` — Request reset (dev may log token; SMTP optional)
- `POST /api/auth/reset-password` — `{ "token", "newPassword" }`

---

## Architecture

```
E-Sukan
├── Backend (Jakarta Servlet 6 WAR)
│   ├── Servlets under com.esukan.servlet (JSON REST-style APIs)
│   ├── WEB-INF/web.xml — URL mappings
│   ├── EsukanContextListener — DB pool, schema bootstrap, seed data
│   └── JDBC via HikariCP (H2 dev / MySQL or TiDB prod)
│
├── Frontend (static assets)
│   └── src/main/resources/static/
│       ├── index.html, login.html
│       ├── css/style.css
│       └── js/app.js
│
└── Configuration
    ├── esukan.properties — Defaults (H2, JWT, MySQL URL template)
    ├── .env — Overrides (loaded from project working directory)
    └── pom.xml — Jetty plugin (dev), WAR packaging
```

---

## Tech stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Runtime** | Java | 17 LTS |
| **API** | Jakarta Servlet | 6.0 |
| **JSON** | Gson | 2.10.1 |
| **Connection pool** | HikariCP | 5.1.0 |
| **Auth** | JJWT + BCrypt | 0.12.6 / 0.10.2 |
| **Build** | Maven | 3.9+ |
| **Dev server** | Jetty EE10 Maven plugin | 12.0.16 (port 9090) |
| **Prod container** | Tomcat (Docker) | 10.1.x (port 8080) |
| **Databases** | H2 (local) / MySQL 8 / TiDB | — |
| **Frontend** | HTML5 / CSS3 / Vanilla JS | ES6+ |

---

## Project structure

```
src/main/
├── java/com/esukan/
│   ├── listener/EsukanContextListener.java   # Startup: schema + seed
│   ├── servlet/                              # HTTP API handlers
│   │   ├── AuthServlet.java
│   │   ├── BookingServlet.java
│   │   ├── FacilityServlet.java
│   │   ├── EquipmentServlet.java
│   │   ├── RentalServlet.java
│   │   ├── PaymentServlet.java
│   │   ├── TournamentServlet.java
│   │   ├── WaitlistServlet.java
│   │   └── AdminUserServlet.java
│   ├── model/                                # Domain types
│   ├── dto/                                  # Request/response shapes
│   ├── security/                             # JWT, UserPrincipal
│   └── util/                                 # DBConnection, DotEnv, Jsons
├── resources/
│   ├── esukan.properties
│   ├── schema-bootstrap.sql
│   └── static/                               # UI (served at /)
└── webapp/WEB-INF/web.xml                    # Servlet mappings
```

---

## Database schema

Tables (created/updated via `schema-bootstrap.sql` on startup):

- **users** / **password_reset_tokens** — Authentication
- **facilities**, **equipment**, **bookings**, **equipment_rentals**
- **payments**, **booking_waitlist**
- **tournaments** / **tournament_registrations**

Existing MySQL deployments: [sql/migration-auth-tournaments.sql](sql/migration-auth-tournaments.sql) if upgrading an older DB.

---

## REST API overview

All JSON APIs are mapped in `WEB-INF/web.xml`. Protected routes require `Authorization: Bearer <JWT>`.

| Prefix | Servlet |
|--------|---------|
| `/api/auth`, `/api/auth/*` | AuthServlet |
| `/api/bookings`, `/api/bookings/*` | BookingServlet |
| `/api/facilities`, `/api/facilities/*` | FacilityServlet |
| `/api/equipment`, `/api/equipment/*` | EquipmentServlet |
| `/api/rentals`, `/api/rentals/*` | RentalServlet |
| `/api/payments`, `/api/payments/*` | PaymentServlet |
| `/api/tournaments`, `/api/tournaments/*` | TournamentServlet |
| `/api/waitlist`, `/api/waitlist/*` | WaitlistServlet |
| `/api/admin/users`, `/api/admin/users/*` | AdminUserServlet |

### Bookings (examples)

- `GET /api/bookings` — List (admin: all; others: own)
- `POST /api/bookings` — Create
- `PATCH /api/bookings/{id}/status?status=CONFIRMED`
- `DELETE /api/bookings/{id}`
- `GET /api/bookings/date/{date}`
- `GET /api/bookings/dashboard`
- `GET /api/bookings/peak-hours/{facilityId}`

### Facilities, equipment, rentals

Same general patterns as before: list/create/update via GET/POST/PATCH on `/api/facilities`, `/api/equipment`, `/api/rentals` (see servlet classes for path-specific behavior).

---

## Configuration

### `esukan.properties`

| Key | Purpose |
|-----|---------|
| `esukan.db.use-h2` | `true` = H2 in-memory (default local) |
| `esukan.db.h2.url` / `.user` / `.password` | H2 JDBC settings |
| `esukan.db.mysql.url` / `.user` / `.password` | Local MySQL template |
| `esukan.jwt.secret` | HS256 secret (≥ 32 bytes in production) |
| `esukan.jwt.expiration-ms` | Token lifetime |

### Environment / `.env`

| Variable | Purpose |
|----------|---------|
| `ESUKAN_DB_USE_H2` | `false` for MySQL/TiDB |
| `SPRING_DATASOURCE_URL` | JDBC URL (name kept for deploy scripts) |
| `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | DB credentials |
| `ESUKAN_JWT_SECRET` | Override JWT secret |
| `ESUKAN_JWT_EXPIRATION_MS` | Override token TTL |
| `MYSQL_*` | Docker Compose MySQL only |

`.env` is read from the **current working directory** when the app starts (typically `CSC584_GroupProject/` when using Maven).

---

## Troubleshooting

### Port 9090 already in use

Stop the other process or change the Jetty `<port>` in `pom.xml`.

### MySQL/TiDB connection errors

- Confirm `ESUKAN_DB_USE_H2=false` in `.env`
- Verify `SPRING_DATASOURCE_*` and TLS parameters in the JDBC URL
- Ensure the database exists and `sql/schema.sql` was applied if needed

### WAR deploys but 404 on APIs

Confirm the WAR is deployed with context path `/` (Dockerfile uses `ROOT.war`) and `web.xml` is inside the WAR.

### No H2 console

This build does not expose Spring’s H2 console; use your own SQL client against `jdbc:h2:mem:esukan` only if you attach a persistent H2 URL (default is in-memory).

---

## Deployment links

- [Docker / DigitalOcean](DEPLOYMENT.md)
- [Vercel frontend + Render API + TiDB](DEPLOYMENT_VERCEL_TIDB.md)
- Repo root overview: [`../README.md`](../README.md)

---

## Resources

- [Jakarta Servlet specification](https://jakarta.ee/specifications/servlet/)
- [Jetty documentation](https://jetty.org/docs/)
- [H2 Database](http://h2database.com/)
- [MySQL 8.0](https://dev.mysql.com/doc/)

---

**Last updated:** May 2026  
**Java:** 17 LTS  
**Packaging:** WAR (Jakarta Servlet 6)
