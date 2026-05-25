-- MySQL: allow booking-only payments (rental_id optional)
ALTER TABLE payments MODIFY COLUMN rental_id BIGINT NULL;
