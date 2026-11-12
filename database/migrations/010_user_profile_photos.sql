-- Additive storage for Cloudinary references. Existing users and records are unchanged.
CREATE TABLE IF NOT EXISTS user_profile_photos (
    user_id BIGINT UNSIGNED NOT NULL,
    cloud_name VARCHAR(100) NOT NULL,
    public_id VARCHAR(255) NOT NULL,
    version VARCHAR(30) NOT NULL,
    photo_url VARCHAR(1000) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_profile_photos_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
