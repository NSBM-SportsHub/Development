-- MySQL 8 / MariaDB 10.6+, UTC timestamps. No destructive or automatic ALTER statements.
-- Canonical sport and club tables shared by clubs, training, memberships, competitions and announcements.
CREATE TABLE IF NOT EXISTS sports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(1000) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sports_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clubs are archived, never deleted, because memberships and competition history reference them.
CREATE TABLE IF NOT EXISTS clubs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sport_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    description TEXT NULL,
    -- Only active and recruiting clubs accept membership applications.
    status ENUM('active', 'recruiting', 'full', 'inactive') NOT NULL DEFAULT 'active',
    is_archived TINYINT(1) NOT NULL DEFAULT 0,
    image_url VARCHAR(500) NULL,
    schedule_text VARCHAR(160) NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_clubs_name (name),
    KEY idx_clubs_sport_visibility (sport_id, is_archived, status),
    CONSTRAINT fk_clubs_sport FOREIGN KEY (sport_id) REFERENCES sports (id),
    CONSTRAINT fk_clubs_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
