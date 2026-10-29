-- MySQL 8 / MariaDB 10.6+, UTC timestamps. No destructive or automatic ALTER statements.
-- Entries are teams (or individuals, with a team size of 1) made of approved club members.
CREATE TABLE IF NOT EXISTS tournaments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sport_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    format ENUM('league', 'knockout') NOT NULL,
    status ENUM('draft', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'draft',
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    registration_closes_at DATETIME NULL,
    max_entries SMALLINT UNSIGNED NULL,
    min_team_size SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    max_team_size SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    points_win TINYINT UNSIGNED NOT NULL DEFAULT 3,
    points_draw TINYINT UNSIGNED NOT NULL DEFAULT 1,
    points_loss TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tournaments_name (name),
    KEY idx_tournaments_status_start (status, starts_on),
    KEY idx_tournaments_sport (sport_id),
    CONSTRAINT fk_tournaments_sport FOREIGN KEY (sport_id) REFERENCES sports (id),
    CONSTRAINT fk_tournaments_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT chk_tournaments_dates CHECK (ends_on >= starts_on),
    CONSTRAINT chk_tournaments_team_size CHECK (min_team_size >= 1 AND max_team_size >= min_team_size),
    CONSTRAINT chk_tournaments_max_entries CHECK (max_entries IS NULL OR max_entries >= 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tournament_entries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tournament_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    captain_user_id BIGINT UNSIGNED NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'withdrawn') NOT NULL DEFAULT 'pending',
    review_note VARCHAR(1000) NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    reviewed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    active_flag TINYINT UNSIGNED AS (IF(status IN ('pending', 'approved'), 1, NULL)) STORED,
    PRIMARY KEY (id),
    -- Target of the composite foreign keys that keep members and matches inside one tournament.
    UNIQUE KEY uq_tournament_entries_scope (tournament_id, id),
    UNIQUE KEY uq_tournament_entries_active_name (tournament_id, name, active_flag),
    KEY idx_tournament_entries_status (tournament_id, status),
    KEY idx_tournament_entries_captain (captain_user_id),
    CONSTRAINT fk_tournament_entries_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments (id),
    CONSTRAINT fk_tournament_entries_captain FOREIGN KEY (captain_user_id) REFERENCES users (id),
    CONSTRAINT fk_tournament_entries_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- active_flag is cleared when the entry is rejected or withdrawn, freeing the student to
-- join another entry. While set, a student belongs to at most one entry per tournament.
CREATE TABLE IF NOT EXISTS tournament_entry_members (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tournament_id BIGINT UNSIGNED NOT NULL,
    entry_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    active_flag TINYINT UNSIGNED NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tournament_entry_members_entry_user (entry_id, user_id),
    UNIQUE KEY uq_tournament_entry_members_active (tournament_id, user_id, active_flag),
    KEY idx_tournament_entry_members_user (user_id),
    CONSTRAINT fk_tournament_entry_members_entry FOREIGN KEY (tournament_id, entry_id) REFERENCES tournament_entries (tournament_id, id),
    CONSTRAINT fk_tournament_entry_members_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT chk_tournament_entry_members_flag CHECK (active_flag IS NULL OR active_flag = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
