-- Training and attendance use canonical club and user IDs; history is retained.
CREATE TABLE IF NOT EXISTS training_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    club_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(150) NOT NULL,
    status ENUM('scheduled', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    notes VARCHAR(2000) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_training_club_date (club_id, session_date),
    CONSTRAINT fk_training_club FOREIGN KEY (club_id) REFERENCES clubs (id),
    CONSTRAINT chk_training_times CHECK (end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS training_attendance (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_id BIGINT UNSIGNED NOT NULL,
    participant_id BIGINT UNSIGNED NOT NULL,
    status ENUM('present', 'absent', 'late', 'excused') NOT NULL DEFAULT 'present',
    notes VARCHAR(2000) NOT NULL DEFAULT '',
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_attendance_participant (session_id, participant_id),
    CONSTRAINT fk_attendance_session FOREIGN KEY (session_id) REFERENCES training_sessions (id),
    CONSTRAINT fk_attendance_participant FOREIGN KEY (participant_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
