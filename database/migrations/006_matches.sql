-- MySQL 8 / MariaDB 10.6+, UTC timestamps. No destructive or automatic ALTER statements.
-- Standings are calculated from completed matches; they are never stored.
CREATE TABLE IF NOT EXISTS matches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tournament_id BIGINT UNSIGNED NOT NULL,
    round_no SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    home_entry_id BIGINT UNSIGNED NOT NULL,
    away_entry_id BIGINT UNSIGNED NOT NULL,
    scheduled_at DATETIME NULL,
    facility_id BIGINT UNSIGNED NULL,
    venue VARCHAR(160) NULL,
    status ENUM('scheduled', 'postponed', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    home_score SMALLINT UNSIGNED NULL,
    away_score SMALLINT UNSIGNED NULL,
    winner_entry_id BIGINT UNSIGNED NULL,
    result_notes VARCHAR(500) NULL,
    result_recorded_by BIGINT UNSIGNED NULL,
    result_recorded_at DATETIME NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_matches_tournament_round (tournament_id, round_no, status),
    KEY idx_matches_scheduled (scheduled_at),
    -- Composite keys guarantee both sides and the winner belong to this match's tournament.
    CONSTRAINT fk_matches_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments (id),
    CONSTRAINT fk_matches_home_entry FOREIGN KEY (tournament_id, home_entry_id) REFERENCES tournament_entries (tournament_id, id),
    CONSTRAINT fk_matches_away_entry FOREIGN KEY (tournament_id, away_entry_id) REFERENCES tournament_entries (tournament_id, id),
    CONSTRAINT fk_matches_winner_entry FOREIGN KEY (tournament_id, winner_entry_id) REFERENCES tournament_entries (tournament_id, id),
    CONSTRAINT fk_matches_facility FOREIGN KEY (facility_id) REFERENCES facilities (id),
    CONSTRAINT fk_matches_result_recorded_by FOREIGN KEY (result_recorded_by) REFERENCES users (id),
    CONSTRAINT fk_matches_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT chk_matches_distinct_sides CHECK (home_entry_id <> away_entry_id),
    CONSTRAINT chk_matches_round CHECK (round_no >= 1),
    CONSTRAINT chk_matches_winner_side CHECK (winner_entry_id IS NULL OR winner_entry_id = home_entry_id OR winner_entry_id = away_entry_id),
    CONSTRAINT chk_matches_result_state CHECK (
        (status = 'completed' AND home_score IS NOT NULL AND away_score IS NOT NULL AND result_recorded_at IS NOT NULL)
        OR (status <> 'completed' AND home_score IS NULL AND away_score IS NULL AND winner_entry_id IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
