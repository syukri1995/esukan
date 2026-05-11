-- Run manually on an existing MySQL/TiDB database that already has the legacy schema
-- (Docker init scripts only run on empty data volumes.)

USE esukan_db;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(120) NOT NULL,
    role ENUM('STUDENT', 'LECTURER', 'ADMIN') NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    student_id_number VARCHAR(32),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add nullable FK columns if missing (ignore errors if columns already exist)
ALTER TABLE bookings ADD COLUMN user_id BIGINT NULL;
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE equipment_rentals ADD COLUMN user_id BIGINT NULL;
ALTER TABLE equipment_rentals ADD CONSTRAINT fk_rentals_user FOREIGN KEY (user_id) REFERENCES users(id);

CREATE TABLE IF NOT EXISTS tournaments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    description VARCHAR(2000),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('DRAFT', 'OPEN', 'CLOSED', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
    organizer_id BIGINT NOT NULL,
    venue_facility_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_id) REFERENCES users(id),
    FOREIGN KEY (venue_facility_id) REFERENCES facilities(id)
);

CREATE TABLE IF NOT EXISTS tournament_registrations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tournament_id BIGINT NOT NULL,
    team_name VARCHAR(120) NOT NULL,
    contact_email VARCHAR(120),
    registered_by_user_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
    FOREIGN KEY (registered_by_user_id) REFERENCES users(id),
    UNIQUE KEY uk_tournament_team (tournament_id, team_name)
);
