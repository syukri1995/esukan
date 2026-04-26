-- E-Sukan Database Schema

CREATE DATABASE IF NOT EXISTS esukan_db;
USE esukan_db;

-- Facilities table (badminton courts, futsal courts, etc.)
CREATE TABLE IF NOT EXISTS facilities (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type ENUM('BADMINTON', 'FUTSAL') NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
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
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_name VARCHAR(100) NOT NULL,
    student_id VARCHAR(20) NOT NULL,
    student_email VARCHAR(100) NOT NULL,
    facility_id BIGINT NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM('PENDING', 'CONFIRMED', 'CANCELLED') DEFAULT 'PENDING',
    notes VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id)
);

-- Equipment rentals table
CREATE TABLE IF NOT EXISTS equipment_rentals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_name VARCHAR(100) NOT NULL,
    student_id VARCHAR(20) NOT NULL,
    equipment_id BIGINT NOT NULL,
    quantity INT DEFAULT 1,
    rental_date DATE NOT NULL,
    return_date DATE,
    status ENUM('ACTIVE', 'RETURNED', 'OVERDUE') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id)
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

-- Sample bookings
-- INSERT INTO bookings (student_name, student_id, student_email, facility_id, booking_date, start_time, end_time, status) VALUES
--('Ahmad Hafiz', 'S001234', 'ahmad@university.edu.my', 1, CURDATE(), '08:00:00', '09:00:00', 'CONFIRMED'),
--('Nurul Ain', 'S001235', 'nurul@university.edu.my', 4, CURDATE(), '10:00:00', '11:00:00', 'PENDING'),
--('Rajesh Kumar', 'S001236', 'rajesh@university.edu.my', 2, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '14:00:00', '15:00:00', 'CONFIRMED'),
--('Siti Hawa', 'S001237', 'siti@university.edu.my', 5, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '16:00:00', '17:00:00', 'PENDING');
