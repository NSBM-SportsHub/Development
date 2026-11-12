-- One university-wide logo, independent of any Admin's personal profile photo.
CREATE TABLE IF NOT EXISTS site_branding (
    id TINYINT UNSIGNED NOT NULL,
    cloud_name VARCHAR(100) NULL,
    public_id VARCHAR(255) NULL,
    version VARCHAR(30) NULL,
    logo_url VARCHAR(1000) NULL,
    updated_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT chk_site_branding_singleton CHECK (id = 1),
    CONSTRAINT chk_site_branding_logo CHECK (
        (cloud_name IS NULL AND public_id IS NULL AND version IS NULL AND logo_url IS NULL)
        OR (cloud_name IS NOT NULL AND public_id IS NOT NULL AND version IS NOT NULL AND logo_url IS NOT NULL)
    ),
    CONSTRAINT fk_site_branding_updated_by FOREIGN KEY (updated_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rerunning setup never replaces the saved logo.
INSERT IGNORE INTO site_branding (id) VALUES (1);
