# Announcement images and the home page

Admins can attach an optional JPEG, PNG or WebP image (up to 5 MB) when creating or editing an announcement. Images can be previewed, replaced or removed. The form explains that an image makes the announcement public on the home page. Text-only announcements continue to require sign-in.

The home-page hero displays announcements with images, pinned first, then by image update time. Uploaded images fill each slide's background, with a dark overlay behind the announcement text. Slides advance every eight seconds and loop back after the last announcement. Visitors can also swipe, drag, use the arrow buttons or slide indicators, or focus the carousel and use the left/right arrow keys. Manual navigation restarts the eight-second timer. Rotation pauses while dragging, touching, using keyboard focus, or viewing another browser tab. Reduced-motion preferences disable automatic rotation and smooth scrolling. A single announcement stays in place. A news-themed welcome appears when no image announcements exist; missing images and unavailable data have fallbacks.

“Read announcement” opens `/news/{announcement UUID}`, which works without signing in. Deleted announcements and announcements whose images have been removed disappear from the public feed and return 404 from public detail reads. Event promotions appear once in the activity grid below the hero. Featured promotions are highlighted there instead of being duplicated in a separate event carousel.

## API

| Endpoint | Access | Behavior |
| --- | --- | --- |
| `GET /api/public/announcements` | Public | `{ announcements: [...] }` containing non-deleted announcements with images. No query parameters. |
| `GET /api/public/announcements/{uuid}` | Public | One non-deleted image announcement; otherwise 404. |
| `POST /api/announcements/{uuid}/image` | Admin + CSRF | Multipart upload with one `image` field. Returns the updated announcement with `image_url` (201). |
| `DELETE /api/announcements/{uuid}/image` | Admin + CSRF | Removes the image and public hero entry, preserving announcement text. Returns the updated announcement (200). |

Existing announcement reads include nullable `image_url`. Existing JSON create/update requests still accept only their original text, club and pin fields; clients cannot supply arbitrary image URLs. The frontend saves text first, then uploads the optional image. If upload fails, the form retains the saved announcement ID so retrying updates that record instead of creating a duplicate.

Image uploads reuse the server's existing `SPORTSHUB_CLOUDINARY_*` configuration and validation, with a 2000 × 1200 maximum bounding box that preserves image proportions. Responses are signed and verified. Replacing/removing images cleans up old assets; rolled-back uploads clean up the new asset. Admin role and session version are revalidated under a database lock after provider calls. Soft-deleted announcements retain their assets for recovery while public reads exclude them.

## Setup and verification

Run `php backend/bin/setup.php --existing-database` to apply migration `013_announcement_images.sql`. It adds a separate image table with a foreign key to announcements; existing announcement records are preserved. Portable PHP users can use `& ./.tools/php/php.exe` instead of `php` from the repository root.

`node backend/tests/integration.mjs` exercises the new HTTP routes and `backend/tests/announcement-images.php` using an isolated database and a Cloudinary transport double. It checks optional images, permissions/CSRF, validation, persistence, replacement/removal, public visibility, provider failures and revoked sessions. It does not upload test images to a live provider.
