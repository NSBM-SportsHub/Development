# Public home page and activities

The home page at `/` is available without an account. Visitors see Sign in; signed-in users see My workspace. Existing authentication, role and CSRF checks still apply to account actions.

## Announcement hero

Announcements with optional uploaded images populate the hero. Images fill the slide background, with a dark overlay behind the text. Pinned announcements appear first, followed by image update time. Slides advance every eight seconds and loop. Arrows, slide indicators, mouse dragging, keyboard arrows and phone swipes support manual navigation. Manual input restarts the timer; keyboard focus, dragging, touch, hidden tabs and reduced-motion preferences pause automatic rotation.

The Read announcement link opens a public `/news/{uuid}` page. Removing an image or deleting its announcement removes it from the public feed. Text-only announcements remain behind sign-in. Empty feeds and broken images have fallbacks. See [announcement images](announcement-images.md) for image limits, public visibility, upload recovery and API routes.

## Event promotions

Admins manage dated activities at `/admin/promotions`, reachable through More. Each eligible promotion appears once in the activity grid beneath the announcement hero. Featured promotions are highlighted rather than duplicated in another carousel. Display order, start time and ID determine listing order.

Published promotions are visible until their end time. Draft, expired and deleted promotions stay off the public page. Linked tournaments in draft, cancelled or completed state are also hidden. The manager explains each promotion's visibility and displays finished times in Sri Lanka time. The form prevents publishing an event with a past end time; existing event dates are never advanced automatically.

1. Create a tournament, trial, camp, sports day or other activity. Tournament promotions must link an existing tournament.
2. Enter the title, description, venue and start/end times. Inputs use the device timezone; public dates use Sri Lanka time. Review promotion times when a linked tournament changes.
3. Save a draft, then optionally upload a wide JPEG, PNG or WebP banner up to 5 MB. Banners reuse private server-side Cloudinary configuration. Without one, activity cards use built-in court artwork.
4. Enable Publish for everyone to see when ready. Highlight this promotion in the activity list distinguishes important cards. Lower display order appears first.

Event detail pages at `/events/{id}` are public only while their promotions are eligible. Tournament registration continues through the protected tournament page. Other activities provide participation instructions and club links rather than a new registration workflow.

The public page filters expired events every ten seconds and refreshes its API data every minute. Detail pages refresh each minute. Removing a promotion hides it immediately from new public reads and retains its record/image for recovery. Replacing/removing banners requests cleanup after the database commit; failed cleanup is logged without credentials.

## Play area and parrot

The separate Play break section below activities contains draggable cricket, tennis, volleyball, basketball and football balls, with an animated ant. Arrow keys move focused balls; dragging and throwing stay inside the arena. Empty space allows vertical touch scrolling. Drop them again replays the drop. Reduced-motion preferences disable decorative movement, and the simulation stops while off-screen or in a hidden tab.

The articulated green-and-yellow parrot flies across public and authenticated pages. Four seconds after scrolling stops, it approaches a suitable visible button; the tournament status dropdown is a fallback when Students have no visible tournament actions. While perched, it blinks, tilts its head, pecks, scratches one foot at a time and ruffles its feathers, with quiet pauses between gestures. Scrolling interrupts these smoothly. The illustration ignores pointer input and fades over interactive controls during flight. Hidden tabs suspend it; reduced-motion preferences hide it. The removed Pause animations button is not shown.

## Navigation and missing pages

Desktop workspace navigation expands on hover or keyboard focus. Phones and smaller touch screens use a fixed left icon rail. The menu toggle reveals labels; choosing a page, tapping outside or pressing Escape collapses it. The primary links, profile avatar, sign-out control and More menu remain accessible, including in short landscape viewports.

Unknown top-level and nested routes show a responsive 404 screen with home and workspace/sign-in recovery links instead of redirecting silently. `/404` previews the full page.

## Database setup

Migration `012_event_promotions.sql` adds the dated promotion table. Migration `013_announcement_images.sql` adds a separate image table linked to announcements. Setup creates these without altering or replacing existing application records. The current schema contains 21 tables. Use the repository's normal backup/restore process and run:

```text
php backend/bin/setup.php --existing-database
```

## Verification

- `npm run build --prefix frontend` and `npm test --prefix frontend`.
- `php backend/tests/configuration.php` for private configuration handling.
- `node backend/tests/integration.mjs` for real PHP/MySQL API, permission, upload-validation and persistence checks in an isolated database.
- `SPORTSHUB_API_PORT=8001 node backend/tests/api-verification.mjs` for the original API report cases on a free port.
- `node backend/tests/backup-restore.mjs` for schema/data fingerprints, including announcement image references.
- `node tests/browser-workflows.mjs` for the production build, real PHP/MySQL, public hero/activity flows, optional uploads with provider failures/stubs, 404 recovery, profiles and workspace navigation. On this workstation set `SPORTSHUB_BROWSER_CHANNEL=msedge` in the process environment.

Browser screenshots and release evidence remain in ignored `.artifacts/`. Test records use isolated databases. No test images are sent to a live Cloudinary account: successful provider responses and persistence use injected transport doubles or explicitly labelled browser fixture helpers. Live uploads still depend on the configured account.
