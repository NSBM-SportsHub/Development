-- Development-only demo clubs matching the frontend preview data (frontend/src/modules/sports-clubs/clubs.js).
-- Safe to re-run: existing clubs (matched by unique name) are left unchanged. Requires 001_sports.sql.
INSERT IGNORE INTO clubs (sport_id, name, status, image_url, schedule_text)
SELECT s.id, c.name, c.status, c.image_url, c.schedule_text
FROM (
    SELECT 'Athletics' AS sport, 'Athletic Club' AS name, 'recruiting' AS status, 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=900&q=85' AS image_url, 'Monday & Wednesday · 4:00 PM' AS schedule_text
    UNION ALL SELECT 'Badminton', 'Badminton Club', 'active', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=85', 'Tuesday & Thursday · 3:30 PM'
    UNION ALL SELECT 'Chess', 'Chess Club', 'recruiting', 'https://images.unsplash.com/photo-1586165368502-1bad197a6461?auto=format&fit=crop&w=900&q=85', 'Wednesday · 3:00 PM'
    UNION ALL SELECT 'Martial Arts', 'Martial Art Club', 'active', 'https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=900&q=85', 'Monday & Friday · 4:30 PM'
    UNION ALL SELECT 'Basketball', 'Basketball Club', 'recruiting', 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=85', 'Tuesday & Friday · 4:00 PM'
    UNION ALL SELECT 'Rugby', 'Rugby Club', 'active', 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=900&q=85', 'Monday & Thursday · 4:00 PM'
    UNION ALL SELECT 'Table Tennis', 'Table Tennis Club', 'full', 'https://images.unsplash.com/photo-1611251135345-18c56206b863?auto=format&fit=crop&w=900&q=85', 'Wednesday & Friday · 3:30 PM'
    UNION ALL SELECT 'Tennis', 'Tennis Club', 'recruiting', 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=900&q=85', 'Tuesday & Thursday · 4:00 PM'
    UNION ALL SELECT 'Volleyball', 'Volleyball Club', 'active', 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=900&q=85', 'Monday & Wednesday · 3:30 PM'
    UNION ALL SELECT 'Swimming', 'Swimming Club', 'recruiting', 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=900&q=85', 'Tuesday & Thursday · 6:00 AM'
    UNION ALL SELECT 'Cricket', 'Cricket Club', 'active', 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=900&q=85', 'Wednesday & Saturday · 3:30 PM'
) AS c
JOIN sports s ON s.name = c.sport;
