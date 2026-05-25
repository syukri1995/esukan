-- Booking hourly fees + payments linked to bookings

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS booking_id BIGINT NULL;
