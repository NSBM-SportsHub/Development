CREATE TABLE IF NOT EXISTS announcement_images (
    announcement_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    cloud_name VARCHAR(100) NOT NULL,
    public_id VARCHAR(255) NOT NULL,
    version VARCHAR(30) NOT NULL,
    image_url VARCHAR(1000) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (announcement_id),
    CONSTRAINT fk_announcement_images_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (announcement_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
