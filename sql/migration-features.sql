-- E-Sukan feature migration (MySQL 8) — run once on existing databases

CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(64) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL
);

INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES
('default_open_time', '08:00'),
('default_close_time', '22:00');

ALTER TABLE facilities ADD COLUMN IF NOT EXISTS open_time TIME NULL;
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS close_time TIME NULL;
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS cost_per_hour DECIMAL(10,2) NOT NULL DEFAULT 0.00;

ALTER TABLE equipment ADD COLUMN IF NOT EXISTS cost_per_hour DECIMAL(10,2) NOT NULL DEFAULT 0.00;

CREATE TABLE IF NOT EXISTS facility_equipment (
    facility_id BIGINT NOT NULL,
    equipment_id BIGINT NOT NULL,
    PRIMARY KEY (facility_id, equipment_id),
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
);

