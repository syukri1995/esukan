# E-Sukan — Campus Facility & Equipment Booking System

A modern web application for managing campus sports facilities and equipment rentals. Built with **Spring Boot 3.2.0**, **Java 17**, and a responsive **HTML/CSS/JavaScript** dashboard.

---

## 🎯 Features

- **Facility Management**: Register and manage badminton courts, futsal courts, and other sports facilities
- **Booking System**: Students can book facilities with date/time selection and status tracking
- **Equipment Rentals**: Track equipment inventory and manage rental transactions
- **Real-time Dashboard**: View bookings, inventory health, peak usage hours, and today's schedule
- **Admin Controls**: Approve/cancel bookings, update equipment status, manage inventory
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile screens
- **In-Memory Development Database**: H2 database for local testing without MySQL

---

## 🏗️ Architecture

```
E-Sukan
├── Backend (Spring Boot 3.2.0)
│   ├── REST APIs for bookings, equipment, facilities, rentals
│   ├── JPA/Hibernate ORM with MySQL (production) or H2 (dev)
│   └── Spring Data repositories and services
│
├── Frontend (Static Assets)
│   ├── index.html - Responsive SPA dashboard
│   ├── css/style.css - Modern dark theme with green accents
│   └── js/app.js - Client-side logic, API calls, page navigation
│
└── Configuration
    ├── application.properties - Default profile (MySQL)
    ├── application-dev.properties - Development profile (H2)
    └── pom.xml - Maven dependencies
```

---

## 🛠️ Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Runtime** | Java | 17 LTS |
| **Framework** | Spring Boot | 3.2.0 |
| **ORM** | Hibernate | 6.3.1 |
| **Build Tool** | Maven | 3.9.15+ |
| **Production DB** | MySQL | 8.0 |
| **Dev DB** | H2 | In-memory |
| **Server** | Tomcat (embedded) | 10.1.16 |
| **Frontend** | HTML5 / CSS3 / Vanilla JS | ES6+ |

---

## 🚀 Quick Start

### Prerequisites

- **Java 17** (confirm with `java -version`)
- **Maven 3.9+** (confirm with `mvn -version`)

### Local Development (H2 In-Memory Database)

No MySQL setup required. The app runs entirely in memory for rapid development.

```powershell
$env:SPRING_PROFILES_ACTIVE='dev'
mvn spring-boot:run
```

Visit: **http://localhost:8080**

The H2 console is also available at **http://localhost:8080/h2-console** (for debugging).

### Production (MySQL Database)

Requires a running MySQL 8.0 server.

1. **Create `.env` file** in the project root:
   ```env
   MYSQL_ROOT_PASSWORD=your_root_password
   MYSQL_USER=esukan_user
   MYSQL_PASSWORD=your_app_password
   DOMAIN=your-domain.com
   CERTBOT_EMAIL=your-email@example.com
   ```

2. **Start the app**:
   ```powershell
   mvn spring-boot:run
   ```

   Or with custom port:
   ```powershell
   $env:SERVER_PORT=8081
   mvn spring-boot:run
   ```

---

## 📁 Project Structure

```
src/main/
├── java/com/esukan/
│   ├── EsukanApplication.java           # Spring Boot entry point
│   ├── DataInitializer.java             # Seed sample data
│   ├── controller/                      # REST controllers
│   │   ├── BookingController.java
│   │   ├── EquipmentController.java
│   │   ├── EquipmentRentalController.java
│   │   └── FacilityController.java
│   ├── model/                           # JPA entities
│   │   ├── Booking.java
│   │   ├── Equipment.java
│   │   ├── EquipmentRental.java
│   │   └── Facility.java
│   ├── repository/                      # Data access
│   │   ├── BookingRepository.java
│   │   ├── EquipmentRepository.java
│   │   ├── EquipmentRentalRepository.java
│   │   └── FacilityRepository.java
│   └── service/                         # Business logic
│       ├── BookingService.java
│       ├── EquipmentService.java
│       ├── EquipmentRentalService.java
│       └── FacilityService.java
├── resources/
│   ├── application.properties            # Default config (MySQL)
│   ├── application-dev.properties        # Dev config (H2)
│   └── static/
│       ├── index.html                   # Dashboard SPA
│       ├── css/style.css                # Responsive styling
│       └── js/app.js                    # Frontend logic
```

---

## 📊 Database Schema

### Tables

- **facilities** — Badminton courts, futsal courts, etc.
- **equipment** — Rackets, shuttlecocks, balls, protective gear, etc.
- **bookings** — Student facility reservations with status tracking
- **equipment_rentals** — Equipment checkout/return transactions

See [sql/schema.sql](sql/schema.sql) for the full schema.

---

## 🔌 REST API Endpoints

All endpoints return JSON.

### Bookings
- `GET /api/bookings` — List all bookings
- `POST /api/bookings` — Create a new booking
- `PATCH /api/bookings/{id}/status?status=CONFIRMED` — Update status
- `DELETE /api/bookings/{id}` — Delete booking
- `GET /api/bookings/date/{date}` — Bookings on a specific date
- `GET /api/bookings/dashboard` — Dashboard statistics
- `GET /api/bookings/peak-hours/{facilityId}` — Peak usage data

### Facilities
- `GET /api/facilities` — List all facilities
- `GET /api/facilities/active` — Active facilities only
- `POST /api/facilities` — Create facility

### Equipment
- `GET /api/equipment` — List all equipment
- `GET /api/equipment/status/{status}` — Filter by status (AVAILABLE, DAMAGED, IN_MAINTENANCE)
- `POST /api/equipment` — Add equipment
- `PATCH /api/equipment/{id}/status?status=AVAILABLE` — Update status
- `GET /api/equipment/health-report` — Inventory health summary

### Rentals
- `GET /api/rentals` — List all rentals
- `POST /api/rentals` — Create rental
- `PATCH /api/rentals/{id}/return` — Mark equipment as returned
- `DELETE /api/rentals/{id}` — Delete rental

---

## 🎨 Dashboard Pages

The frontend is a single-page application (SPA) with these main views:

1. **Dashboard** — Stats cards, inventory health, peak hours, today's schedule
2. **Facilities** — Browse all facilities, filter by type, view details
3. **Bookings** — Full booking list with status filtering and quick actions
4. **Equipment** — Inventory management with status indicators
5. **Rentals** — Active and historical rental transactions

### Key Features
- **Dark Mode** with green accent colors (modern industrial design)
- **Responsive Sidebar** collapses on smaller screens
- **Real-time Updates** on CRUD operations
- **Toast Notifications** for user feedback
- **Status Badges** for visual status indication
- **Horizontal Scroll** on data tables for mobile compatibility

---

## 🐳 Docker Deployment

The project includes Docker and Docker Compose setup for production deployment:

```bash
# Build Docker image
docker build -t esukan:latest .

# Deploy with Docker Compose
docker compose up -d
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for full Digital Ocean deployment instructions.

---

## 🧪 Development Workflow

### Run Tests
```powershell
mvn clean test
```

### Compile Only
```powershell
mvn clean compile
```

### Package as JAR
```powershell
mvn clean package
```

### Run with Debug Mode
```powershell
$env:SPRING_PROFILES_ACTIVE='dev'
mvn spring-boot:run --debug
```

---

## 📝 Sample Data

The app auto-seeds the H2 database with:
- 5 sports facilities (badminton and futsal courts)
- 8 equipment items (rackets, shuttlecocks, balls, protective gear, etc.)

Data is initialized via [DataInitializer.java](src/main/java/com/esukan/DataInitializer.java) on startup.

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `SERVER_PORT` | `8080` | Application port |
| `SPRING_PROFILES_ACTIVE` | `default` | Profile: `default` (MySQL) or `dev` (H2) |
| `SPRING_DATASOURCE_URL` | See props | Database URL |
| `SPRING_DATASOURCE_USERNAME` | `root` | DB user |
| `SPRING_DATASOURCE_PASSWORD` | `321Damansara*` | DB password |
| `MYSQL_ROOT_PASSWORD` | (required) | MySQL root password |
| `MYSQL_USER` | `esukan_user` | MySQL app user |
| `MYSQL_PASSWORD` | (required) | MySQL app password |

### Profiles

- **default** — Production profile using MySQL
  - Requires `.env` file with MySQL credentials
  - Uses `application.properties`

- **dev** — Development profile using H2
  - No MySQL required
  - Uses `application-dev.properties`
  - Automatically creates schema and seeds data

---

## 🐛 Troubleshooting

### Port 8080 Already in Use
```powershell
# Use an alternate port
$env:SERVER_PORT=8081
mvn spring-boot:run
```

### MySQL Connection Refused
- Ensure MySQL is running
- Verify `.env` credentials match your MySQL setup
- Check `SPRING_DATASOURCE_URL` for correct host/port

### H2 Console Not Loading
- Confirm dev profile is active
- Visit `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:mem:esukan_db`
- User: `sa` (no password)

### "Unknown lifecycle phase 'spring-boot'"
- Ensure command is `mvn spring-boot:run` (with colon)
- Not `mvn spring-boot run` (without colon)

---

## 📚 Resources

- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [Spring Data JPA Guide](https://spring.io/projects/spring-data-jpa)
- [MySQL 8.0 Docs](https://dev.mysql.com/doc/)
- [H2 Database Docs](http://h2database.com/)
- [Deployment Guide](DEPLOYMENT.md)

---

## 📄 License

This project is open source. Modify and distribute freely for educational and campus use.

---

## 🤝 Contributing

Contributions are welcome! Fork the repo, create a feature branch, and submit a pull request.

---

## 👨‍💼 Author

Built for campus facility management by the E-Sukan team.

---

**Last Updated:** May 3, 2026  
**Status:** Active Development  
**Java Version:** 17 LTS  
**Spring Boot Version:** 3.2.0
