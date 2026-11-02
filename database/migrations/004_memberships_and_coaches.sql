-- MySQL 8 / MariaDB 10.6+, UTC timestamps. No destructive or automatic ALTER statements.
-- active_flag is 1 for live rows and NULL otherwise. Unique indexes ignore NULLs, so
-- each (club, user) pair may hold only one live row while keeping any number of past rows.

-- Coaches are users assigned to a club by an Admin; they review that club's memberships.
CREATE TABLE IF NOT EXISTS club_coaches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    club_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    assigned_by BIGINT UNSIGNED NOT NULL,
    ended_by BIGINT UNSIGNED NULL,
    ended_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    active_flag TINYINT UNSIGNED AS (IF(ended_at IS NULL, 1, NULL)) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_club_coaches_active (club_id, user_id, active_flag),
    KEY idx_club_coaches_user (user_id, active_flag),
    CONSTRAINT fk_club_coaches_club FOREIGN KEY (club_id) REFERENCES clubs (id),
    CONSTRAINT fk_club_coaches_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_club_coaches_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (id),
    CONSTRAINT fk_club_coaches_ended_by FOREIGN KEY (ended_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per application. Approved rows are the member records; ended rows keep history.
CREATE TABLE IF NOT EXISTS memberships (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    club_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'withdrawn', 'ended') NOT NULL DEFAULT 'pending',
    message VARCHAR(1000) NULL,
    review_note VARCHAR(1000) NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    reviewed_at DATETIME NULL,
    ended_by BIGINT UNSIGNED NULL,
    ended_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    active_flag TINYINT UNSIGNED AS (IF(status IN ('pending', 'approved'), 1, NULL)) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_memberships_active (club_id, user_id, active_flag),
    KEY idx_memberships_user_status (user_id, status),
    KEY idx_memberships_club_status (club_id, status, created_at),
    CONSTRAINT fk_memberships_club FOREIGN KEY (club_id) REFERENCES clubs (id),
    CONSTRAINT fk_memberships_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_memberships_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (id),
    CONSTRAINT fk_memberships_ended_by FOREIGN KEY (ended_by) REFERENCES users (id),
    CONSTRAINT chk_memberships_no_self_review CHECK (reviewed_by IS NULL OR reviewed_by <> user_id),
    CONSTRAINT chk_memberships_review_state CHECK (status = 'pending' OR status = 'withdrawn' OR reviewed_at IS NOT NULL),
    CONSTRAINT chk_memberships_end_state CHECK ((status = 'ended') = (ended_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
