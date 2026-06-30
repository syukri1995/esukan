-- E-Sukan Database Schema (MySQL 8)

CREATE DATABASE IF NOT EXISTS esukan_db;
USE esukan_db;

CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(64) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL
);

INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES
('default_open_time', '08:00'),
('default_close_time', '22:00');

-- Facilities table (badminton courts, futsal courts, etc.)
CREATE TABLE IF NOT EXISTS facilities (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type ENUM('BADMINTON', 'FUTSAL') NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    open_time TIME NULL,
    close_time TIME NULL,
    cost_per_hour DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Equipment table
CREATE TABLE IF NOT EXISTS equipment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    status ENUM('AVAILABLE', 'DAMAGED', 'IN_MAINTENANCE') DEFAULT 'AVAILABLE',
    quantity INT DEFAULT 1,
    description VARCHAR(255),
    cost_per_hour DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facility_equipment (
    facility_id BIGINT NOT NULL,
    equipment_id BIGINT NOT NULL,
    PRIMARY KEY (facility_id, equipment_id),
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
);

-- Users (auth)
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

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_name VARCHAR(100) NOT NULL,
    student_id VARCHAR(20) NOT NULL,
    student_email VARCHAR(100) NOT NULL,
    facility_id BIGINT NOT NULL,
    user_id BIGINT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM('PENDING', 'CONFIRMED', 'CANCELLED') DEFAULT 'PENDING',
    notes VARCHAR(255),
    estimated_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Facility booking waitlist (FIFO promotion on cancel)
CREATE TABLE IF NOT EXISTS booking_waitlist (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_name VARCHAR(100) NOT NULL,
    student_id VARCHAR(20) NOT NULL,
    student_email VARCHAR(100) NOT NULL,
    facility_id BIGINT NOT NULL,
    user_id BIGINT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM('WAITING', 'PROMOTED', 'CANCELLED') DEFAULT 'WAITING',
    notes VARCHAR(255),
    promoted_booking_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Equipment rentals table
CREATE TABLE IF NOT EXISTS equipment_rentals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_name VARCHAR(100) NOT NULL,
    student_id VARCHAR(20) NOT NULL,
    equipment_id BIGINT NOT NULL,
    user_id BIGINT NULL,
    quantity INT DEFAULT 1,
    rental_date DATE NOT NULL,
    return_date DATE,
    status ENUM('ACTIVE', 'RETURNED', 'OVERDUE') DEFAULT 'ACTIVE',
    deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Payments for equipment rentals
CREATE TABLE IF NOT EXISTS payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rental_id BIGINT NULL,
    booking_id BIGINT NULL,
    method ENUM('CASH', 'ONLINE_BANKING', 'E_WALLET', 'CARD') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('PENDING', 'PAID', 'FAILED') DEFAULT 'PENDING',
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rental_id) REFERENCES equipment_rentals(id),
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
);


-- Seed facilities
INSERT INTO facilities (name, type, description) VALUES
('Badminton Court 1', 'BADMINTON', 'Main badminton court near sports complex entrance'),
('Badminton Court 2', 'BADMINTON', 'Indoor badminton court with air conditioning'),
('Badminton Court 3', 'BADMINTON', 'Outdoor badminton court'),
('Futsal Court A', 'FUTSAL', 'Full-size futsal court with synthetic turf'),
('Futsal Court B', 'FUTSAL', 'Indoor futsal court, capacity 10 players');

-- Seed equipment
INSERT INTO equipment (name, category, status, quantity, description) VALUES
('Badminton Racket', 'Racket Sports', 'AVAILABLE', 20, 'Yonex standard rackets'),
('Shuttlecock (tube)', 'Racket Sports', 'AVAILABLE', 50, 'Feather shuttlecocks'),
('Futsal Ball', 'Ball Sports', 'AVAILABLE', 10, 'Size 4 futsal balls'),
('Goalkeeper Gloves', 'Protective Gear', 'AVAILABLE', 5, 'Standard goalkeeper gloves'),
('Knee Guard', 'Protective Gear', 'IN_MAINTENANCE', 8, 'Knee protection for futsal'),
('Bibs / Vests', 'Apparel', 'AVAILABLE', 30, 'Team differentiation bibs'),
('Score Counter', 'Accessories', 'DAMAGED', 2, 'Manual score counters'),
('Badminton Net', 'Court Equipment', 'AVAILABLE', 3, 'Portable badminton nets');

-- Migration note: on existing databases without deposit_amount or payments, run:
-- ALTER TABLE equipment_rentals ADD COLUMN deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 50.00;
-- then create payments table as above.
