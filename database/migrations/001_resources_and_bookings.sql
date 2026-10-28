CREATE TABLE facilities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    description TEXT NULL,
    location VARCHAR(160) NULL,
    capacity INT UNSIGNED NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_facilities_active_name (is_active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE equipment (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    description TEXT NULL,
    total_quantity INT UNSIGNED NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_equipment_active_name (is_active, name),
    CONSTRAINT chk_equipment_total_quantity CHECK (total_quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bookings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    facility_id BIGINT UNSIGNED NULL,
    equipment_id BIGINT UNSIGNED NULL,
    requested_by BIGINT UNSIGNED NOT NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    notes VARCHAR(1000) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_bookings_facility_time_status (facility_id, status, starts_at, ends_at),
    KEY idx_bookings_equipment_time_status (equipment_id, status, starts_at, ends_at),
    KEY idx_bookings_requester_created (requested_by, created_at),
    CONSTRAINT fk_bookings_facility FOREIGN KEY (facility_id) REFERENCES facilities (id),
    CONSTRAINT fk_bookings_equipment FOREIGN KEY (equipment_id) REFERENCES equipment (id),
    CONSTRAINT chk_bookings_exactly_one_resource CHECK (
        (facility_id IS NOT NULL AND equipment_id IS NULL)
        OR (facility_id IS NULL AND equipment_id IS NOT NULL)
    ),
    CONSTRAINT chk_bookings_time CHECK (ends_at > starts_at),
    CONSTRAINT chk_bookings_quantity CHECK (quantity > 0),
    CONSTRAINT chk_bookings_status CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
