# Database design evolution and supporting artifacts

The team's original `NSBM Assignment.drawio.png` is preserved as an early design artifact. This document explains how the running system differs; the original is not edited to imply it always matched the final implementation. The authoritative database is the 17 tables in migrations 001-009, documented in [the current ERD](database-erd.md).

| Original proposal | Implemented design | Reason / behavior |
| --- | --- | --- |
| UUID-labelled primary keys mixed with integer foreign keys | Matching `BIGINT UNSIGNED` IDs for core entities; announcements retain a UUID string ID | Consistent referenced types in canonical migrations; compatible PHP/PDO contracts |
| First/last names and a generic password string | `users.name`, a password hash, role/status and authentication version | Shared identity contract and session revocation; passwords are never stored as plaintext |
| Coach name and stored member totals on clubs | `club_coaches` assignments and counts from approved memberships | Permissions can be revoked and totals follow actual membership records |
| Boolean membership flags and member role | Explicit pending/approved/rejected/withdrawn/ended states; coach scope is a separate assignment | Retains review/reapplication history and avoids conflating club permissions with account role |
| Booking plus multiple booking-items | A facility or equipment resource per booking, time range, quantity and status | Atomic resource availability checks; resource locks prevent conflicting concurrent requests/approvals |
| Separate tournament-team and registration tables | Tournament entries plus entry members with eligibility/review rules | Supports individual/team sizes and validates the whole roster against the tournament sport |
| Separate match, results and participants tables | Match sides refer to approved entries; scores/results stored on matches; participants derive from entry rosters | Referential consistency, league/knockout standings, controlled result correction; roster appearance is not individual attendance |
| RSVP/attendance booleans | Unique session/participant attendance with present/late/absent/excused states | Source-based participation reporting; cancelled sessions do not count as attended |
| Training facility link and proposed equipment condition/checkout fields | Training session club/date/times/notes; equipment quantity and booking controls | The official minimum does not require facility-linked training reservations or physical issue/return tracking; these proposals are not claimed as implemented |
| Notification read boolean | Recipient-owned notification snapshots with read timestamps and unique event/recipient keys | Persisted delivery/read state and duplicate prevention |

Report and video credits should include actual R&D, database design, UI/UX, coding, integration and QA work. The R&D PDF names Jassim and Shahilan; other artifact credits must use the team's confirmed authorship. Original working ownership in README is a plan, not proof of completed individual work.

The R&D document contains proposed features beyond the official guideline, including CSV exports and booking reports. The current application provides participation/performance views; CSV export and a separate booking-report module are not asserted complete or official minimum gaps. Any desired additions should be agreed explicitly rather than inferred from a design proposal.
