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

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS format VARCHAR(32) NOT NULL DEFAULT 'SINGLE_ELIMINATION';

CREATE TABLE IF NOT EXISTS tournament_matches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tournament_id BIGINT NOT NULL,
    round_number INT NOT NULL,
    match_index INT NOT NULL,
    slot_label VARCHAR(32),
    team_a_registration_id BIGINT NULL,
    team_b_registration_id BIGINT NULL,
    winner_registration_id BIGINT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    next_match_id BIGINT NULL,
    next_match_slot CHAR(1) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (team_a_registration_id) REFERENCES tournament_registrations(id),
    FOREIGN KEY (team_b_registration_id) REFERENCES tournament_registrations(id),
    FOREIGN KEY (winner_registration_id) REFERENCES tournament_registrations(id),
    FOREIGN KEY (next_match_id) REFERENCES tournament_matches(id)
);
