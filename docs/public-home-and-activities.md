# Public home page and activities

Open `/` to browse SportsHub without an account. Signed-in users see **My workspace**; visitors see **Sign in**. The workspace university logo links back to this home page. Registration, club membership and tournament actions retain their existing login, role and CSRF checks.

The hero combines an animated athlete/stadium illustration, subtle pointer tilt, activity and club calls to action, direct club/training/tournament links, and a spotlight linked to a real published event when available. Otherwise the spotlight invites the visitor to join the sporting community; it does not invent event data. The bird still perches on the hero title.

Cricket, tennis, volleyball, basketball, football and the ant now live in a separate **Play break** section (`#play-zone`) below the activity list. They are positioned inside that section and scroll away with it, rather than being fixed to the screen. Balls drop when the section enters view; **Drop them again** replays the drop. Dragging, throwing and arrow-key movement stay within the section. The ant keeps its variable pace, independent head/antenna motion and distance-based steps. A gentle light sweep and entry reveal animate the play area. The simulation stops while off-screen. The shared **Pause animations** button controls the bird, play section and repeating hero artwork; reduced-motion preference disables decorative animation. The play area loads separately from the initial hero.

Production-build UI evidence for the hero/play section is in `.artifacts/home-refresh-evidence.json`, with desktop, tablet, 390 px and 320 px screenshots. These checks use read-only API fixtures and do not modify the database.

Published promotions appear in a separate event carousel and activity cards. The first five featured, currently visible promotions rotate every six seconds in display order, then start time and ID order. Arrows, dots, a pause control and horizontal touch swipes are supported. Hover, keyboard focus, background tabs and reduced-motion preference pause automatic rotation. Upcoming events say **Coming up**; **Happening now** requires the start time to have passed and the end time still to be in the future.

The supplied green-and-yellow parrot illustration is represented by an articulated vector bird in `frontend/src/shared/Parrot.jsx`. It flies along changing curved paths, alternates flapping with gliding, and stays present across public and authenticated pages. Flight is approximately 30% faster than the first implementation. When the hero title is visible, it flies for six seconds before approaching, folding its wings and staying perched on “Move your.” Its feet follow the title through scrolling and responsive layout changes. It takes off when the title leaves the viewport or the user opens another page. It loads separately after the application starts. The original JPG is not modified. The bird and its wings ignore pointer input, and fade over interactive controls. **Pause animations** freezes the bird and the home-page sports effects together; other pages provide the same pause control. Hidden tabs suspend its simulation, and reduced-motion preference hides the decorative bird entirely. Frontend browser evidence in `.artifacts/parrot-evidence.json` and `.artifacts/parrot-perch-evidence.json` uses read-only API fixtures, so it verifies the UI behavior without making database/provider changes.

Expired records are excluded by the public SQL queries. The home page also filters its current data every ten seconds and refreshes from the API every minute, so an open page removes finished events. Public detail pages refresh each minute. Deleted, unpublished and expired promotions return 404 publicly. Linked tournaments in draft, cancelled or completed state are also hidden. Only explicitly published promotions are exposed; existing tournaments, announcements, training and personal information do not become public automatically.

## Admin instructions

1. Open **More → Home page promotions**, or **Manage promotions** on the public home page.
2. Create a tournament, trial, training camp, sports day or other activity promotion. Tournament promotions must link an existing tournament. Other activities use their own details and participation instructions.
3. Enter title, description, venue and start/end times. Inputs use the device timezone; public dates are displayed in Sri Lanka time. Promotion times are editorial fields: review them when a linked tournament's schedule changes.
4. Save a draft. Upload an optional wide JPEG, PNG or WebP banner (up to 5 MB) using the existing private Cloudinary configuration. Without a banner, the page uses built-in court artwork.
5. Choose **Publish for everyone to see** when the details are ready. A lower display order appears first. More than five featured records remain in the activity list; only the first five visible featured records enter the carousel.

Removal hides the promotion and retains its record and image reference for recovery. Removing a banner clears its reference and requests Cloudinary cleanup. Replacement cleans the previous asset after committing the new reference. Provider cleanup failures are logged without credentials. Soft-deleted promotions' retained images have no automatic purge job.

Custom activities currently provide published participation instructions and a link to explore clubs. This does not introduce a separate camp/trial registration workflow. Tournament registration uses the existing protected tournament page.

## Copilot animation review and fixes

The reviewed animation built successfully and produced no browser runtime errors, but had the following confirmed problems:

| Finding | Correction |
| --- | --- |
| The ant accumulated rotation and turned upside down | It stays upright and turns horizontally when changing direction |
| Fixed desktop starting positions left three balls off-screen on a 390 px phone with reduced motion | Resize-aware positions and bounds work even when motion is disabled |
| The whole arena disabled touch scrolling | Empty arena space allows vertical scrolling; only draggable balls capture dragging |
| Focusable ball buttons had no keyboard movement | Arrow-key movement, visible instructions and a pause control |
| Physics and React state updates ran every animation frame, including off-screen/reduced-motion work | Time-based simulation updates transforms directly; animation stops outside the viewport, in hidden tabs and for reduced motion |
| The tennis ball could be changed by the ant while being dragged | Dragged objects are protected from automated impulses; pointer tracking and cancellation are handled |
| The event carousel had been removed | Carousel restored beside the preserved sports arena |
| The home navigation's What’s on link changed the URL without scrolling | Native anchor navigation reaches the activity section |

The original files reviewed are preserved in ignored `.artifacts/copilot-home-before-review.jsx` and `.artifacts/copilot-events-before-review.css`. Browser-only review observations and screenshots are in `.artifacts/copilot-arena-review.json` and `.artifacts/copilot-arena-*.png`. These original observations describe the version before the fixes.

## Database safety

Migration `012_event_promotions.sql` creates one new table. It does not alter, drop or overwrite existing tables. Setup preflight checks its types and primary key if it already exists. Current fresh setup contains **20 tables**, from migrations 001–012.

Before applying it locally, the existing 19 tables were dumped, restored into a separate random verification database and compared by schema and data fingerprints. Setup then added an empty `event_promotions` table. All original table fingerprints remained identical. Private backup and comparison evidence is in ignored `.artifacts/events-backup-1794500161906/`; do not commit or share the SQL dump. No real promotions or demo activities were inserted into the working database.

Use the existing safe workflow on another development machine:

```text
php backend/bin/setup.php --existing-database
```

Back up and verify a restore first. Setup still stops for incompatible legacy definitions rather than changing them automatically. This feature does not repair Shahilan's earlier four-table legacy database.

## Verification

- `npm run build --prefix frontend`
- `npm test --prefix frontend` — 19 checks, including variable ant movement, smooth stopping at the screen edges, parrot flight/gliding bounds, title landing/perching and narrow-phone perching.
- `php backend/tests/configuration.php` — 35 checks.
- `node backend/tests/integration.mjs` — 192 scenarios, real PHP/MySQL, isolated database, inspected backend logs and unchanged working database.
- `node backend/tests/api-verification.mjs` on a free test port — all original 37 cases (15 previously failing + 22 previously passing), plus four supplementary checks.
- `node backend/tests/backup-restore.mjs` — all 20 tables restored with matching fingerprints, including a synthetic promotion.
- `SPORTSHUB_BROWSER_CHANNEL=msedge node tests/browser-workflows.mjs` — production-build browser checks for the public arena, responsive/reduced-motion layout, real admin create/edit/publish, public visibility, banner validation/failure, carousel auto-rotation, hover/focus pause, arrows, real browser touch swipe, guest login protection, removal, and the existing workspace workflows. See `.artifacts/browser-evidence.json` for the latest completed run and screenshots.

The expanded [API checklist](api-working-status-checklist.md) has **97 operations**. Offline evidence verifies 94 successful operations and marks three live Cloudinary uploads **NOT TESTED** (profile photo, university logo and event banner). Their authentication, CSRF, invalid-file and safe provider-failure responses are checked over HTTP. Successful signed-provider responses, persistence, replacement and rollback are checked separately using injected provider doubles; this is not a claim of live Cloudinary verification. Real upload verification still needs the configured provider and a test image.

No production changes, commits, pushes or merges are part of this work.
