# Cloudinary profile photos

Open **My profile → Edit profile** to choose a JPEG, PNG or WebP image up to 5 MB. Choose **Upload photo** to save it, or **Remove photo** to return to initials. Photo changes save immediately and independently of the contact-details form. Cancelling a file selection does not upload it. Saving or cancelling contact details closes the editor as before.

The profile hero and shared account avatars use the saved image. If image delivery fails, the avatar falls back to initials.

## Private configuration

Add these settings to `backend/.env` using values from your Cloudinary product environment:

```dotenv
SPORTSHUB_CLOUDINARY_CLOUD_NAME=your_cloud_name
SPORTSHUB_CLOUDINARY_API_KEY=your_api_key
SPORTSHUB_CLOUDINARY_API_SECRET=your_api_secret
SPORTSHUB_CLOUDINARY_FOLDER=nsbm-sportshub/profiles
```

Do not add these to the frontend environment or use a `VITE_` prefix. No unsigned upload preset is needed. Credentials are used only by PHP; they are not sent to the browser, stored in photo records, or included in API errors. The integration follows Cloudinary's [signed Upload API](https://cloudinary.com/documentation/authentication_signatures) and [upload/response parameters](https://cloudinary.com/documentation/image_upload_api_reference).

PHP needs cURL with TLS verification and trusted CA certificates, `upload_max_filesize=5M` or higher, and `post_max_size=6M` or higher. `getimagesize` is used for initial image checks; a GD dependency is not needed. Restart the PHP server after changing its environment or `php.ini`.

## Database setup

Back up an existing database before running:

```sh
php backend/bin/setup.php --existing-database
```

Migration `010_user_profile_photos.sql` creates one additional table, `user_profile_photos`, with one photo reference per user and a foreign key to `users`. Existing user columns, data and all other tables remain unchanged. A fresh setup now has 18 tables. Setup checks the new table's types and unique user index if it already exists and stops on incompatibility. Older incompatible legacy databases still require their separately reviewed compatibility migration; this change does not silently upgrade them.

The local development database was backed up, restored into a separate verification database, compared table-for-table, then migrated. Ignored backup evidence is under `.artifacts/profile-photo-backup-20261112-131050/`. All original 17 table definitions and row fingerprints were unchanged after migration. Keep the SQL backup private; it contains existing data.

## API and behavior

| Operation | Behavior |
| --- | --- |
| `POST /api/users/me/photo` | Authenticated, CSRF-protected multipart upload with exactly one `photo` file. Returns 201 and the current public user profile. |
| `DELETE /api/users/me/photo` | Authenticated, CSRF-protected removal, with an empty JSON object. Returns 200 and the current public user profile; repeated removal is safe. |
| Existing session/profile APIs | Include nullable `photo_url`; Cloudinary credentials and internal asset references stay private. |

Both Student and Admin accounts can manage their own image. A Coach uses the same personal-profile controls. The upload endpoint cannot target another user, accept arbitrary remote URLs, or accept client-supplied public IDs. It checks actual image headers, bytes, dimensions (maximum 8000 pixels per side and 16 million pixels), session and CSRF. Cloudinary decodes and converts the image into a 512×512 WebP. PHP sends files only to the fixed Cloudinary HTTPS endpoint, signs upload parameters and verifies the response signature before saving a reference. The delivery URL is built from verified fields rather than trusting a supplied URL.

Every upload gets a new random public ID; it cannot overwrite an existing asset. A user-row lock serializes reference updates/removal, with a session-version check after the external upload. Provider/upload failures preserve the existing photo. Database save failures attempt cleanup of the newly uploaded image. Replacements/removals attempt deletion of the previous asset with CDN invalidation after the database change commits.

If old-asset cleanup fails, the saved profile change remains successful and a **profile photo cleanup pending** log entry identifies the Cloudinary public ID for manual cleanup. There is no automatic retry queue. This also applies if the Cloudinary environment changes or its credentials are removed. Removing a photo stops its use in SportsHub immediately, but CDN invalidation can take time. Account archival retains its photo reference with the account history; it is not automatic Cloudinary account erasure.

Missing/invalid Cloudinary configuration returns a safe 503 for uploads. Missing session/CSRF returns 401/403. Unsupported request media returns 415, invalid files/fields return 422, oversized HTTP/PHP uploads return 413, and provider/network failures return 502. The rest of the application continues working when Cloudinary is unconfigured.

## Verification and live check still required

Automated offline checks cover configuration precedence, multipart/CSRF handling, file validation, permissions, real MySQL persistence/removal, signed requests/responses, replacement, rollback, missing configuration, provider failure and avatar fallback. Service success uses an injected transport double confined to CLI tests; browser upload success is explicitly stubbed, with references persisted in its isolated database. Neither test claims an upload to a real Cloudinary account.

After adding credentials and restarting PHP:

1. Sign in as a Student, open Edit profile, upload a small valid image and confirm a 201 response.
2. Reload the profile and sign in again; check the photo remains in the hero and account avatar.
3. Replace the image; confirm the new image displays and the previous Cloudinary asset is removed.
4. Remove the photo; confirm initials return and the asset is removed or its cleanup failure is logged.
5. Repeat upload/removal for an Admin account and check an invalid file is rejected.

The API checklist now has 86 operations. Without real credentials, successful live photo upload remains **Not checked**. Offline operation evidence records its expected safe 503 and leaves its live success marked **NOT TESTED**.
