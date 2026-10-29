-- clubs.id is the referenced key for club-specific announcements.
CREATE TABLE IF NOT EXISTS clubs (
    id INT NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcements (
    announcement_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    club_id INT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    is_pinned TINYINT(1) NOT NULL DEFAULT 0,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (announcement_id),
    KEY idx_announcements_club_id (club_id),
    KEY idx_announcements_visibility (is_deleted, is_pinned),
    CONSTRAINT fk_announcements_club FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
