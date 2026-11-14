# Profile design preview and university branding

The new design is scoped to `/profile`. Other module layouts retain their existing design. Review the profile before extending this visual style elsewhere.

Open the profile by clicking the account avatar in the sidebar footer (or the account avatar in the phone header). The separate My profile navigation item has been removed. The avatar works as a keyboard-accessible link and indicates when the profile is the current page.

The profile uses a dark forest-green sports cover, lime actions, a pointer-responsive spotlight, floating court graphics, a moving court outline, staggered card entrances and hover effects. Account details and membership dates come from the signed-in user's real profile. Personal fields and password fields still open only when requested, with the existing save, cancel and validation behavior. The three shortcuts lead to existing role-appropriate pages; they do not introduce more sidebar items. Motion is disabled when the browser prefers reduced motion. The layout is checked at desktop, tablet, 390px and 320px phone widths.

## University logo

Admins can open **My profile → University logo → Change university logo** to upload a JPEG, PNG or WebP, up to 5 MB. **Use default logo** restores the original mark. These controls are separate from personal profile photos. Students and Coaches can see the shared branding but cannot upload or remove it.

| API | Access |
| --- | --- |
| `GET /api/branding` | Public; returns only `university_logo_url` and `updated_at` |
| `POST /api/branding/logo` | Active Admin session and CSRF token; multipart `logo` file |
| `DELETE /api/branding/logo` | Active Admin session and CSRF token; empty JSON object |

The logo uses the existing private Cloudinary configuration. Unlike profile photos, it keeps its proportions, fitting within 1024×512 without cropping; WebP supports a transparent logo background. Signed requests and responses, byte/dimension limits, account revalidation, singleton-row locking and cleanup behavior follow the existing image integration. Cloudinary secrets never reach the client. Public responses omit the internal asset ID and the Admin's ID.

Migration `011_site_branding.sql` adds a singleton `site_branding` table and does not modify existing tables. That migration brought fresh setup to 19 tables; the later [event-promotion migration](public-home-and-activities.md) brings it to 20. Local backup evidence is in the ignored `.artifacts/university-branding-backup-20261112-145044/` directory. The 18 pre-existing tables were backed up, restored to a separate verification database and compared before adding the new table. Existing definitions and records stayed unchanged.

Shared branding appears in the site mark, login/register branding, shared loading indicators and the startup screen. The logo is fetched publicly before sign-in; a cached public URL can appear immediately on later visits. The startup screen waits for session/branding readiness and briefly lets the logo paint. Logo preloading and branding fetches have bounded waits; unavailable branding does not prevent the application from opening. Broken images fall back to the original mark. Other open tabs refresh branding on focus or a storage notification.

## Checks and limits

The API suite tests anonymous access, Admin/Student/Coach permissions, CSRF, invalid images/fields, removal, preservation of a saved logo on failure, real MySQL persistence, request/response signatures, stale-account rejection and migration repeatability. Provider success is exercised with an injected Cloudinary transport double.

The browser suite checks the profile layout, real edit/save/password flows, reduced motion, Admin-only controls, logo persistence, branding visible to Students and guests, the same image on the loading screen, and graceful branding-service failure. Browser upload success uses a provider stub and real fixture database references. A real Cloudinary account upload remains a separate live check; offline tests do not claim it.

Preview screenshots are saved in ignored `.artifacts/profile-redesign-admin-desktop.png`, `.artifacts/profile-redesign-student-desktop.png`, `.artifacts/profile-redesign-mobile.png` and `.artifacts/university-branded-loading-screen.png`.
