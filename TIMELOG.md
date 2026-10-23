# PAA Time Log

Billed by the minute at $45/hr. Times are local Central (CST/CDT), 24-hour.

**Rules**
- Start, End and Minutes come from the automatic session log (`/billing wine-across-america <date>`), which records every prompt and reply.
- At session end, copy the session row(s) and add a one-line client-friendly summary and the commit hash(es).
- A pause longer than 15 minutes closes the row and is not billed; a new row starts when work resumes.

| Date | Start | End | Minutes | Work summary | Commit(s) |
|------|-------|-----|---------|--------------|-----------|
| 2026-09-27 | 20:14 | 20:37 | 23 | Client feedback 9/22, Parts 1 and 2: removed the Warming row and fixed Dry/Sweet on the share card; smoothed the Structure sliders (labels under the track, no jitter); added New Message with member name search (private, respects directory settings), also used by Send to Member. Start reconstructed from the session transcript (first event 20:14:29). | 0a96aa5, 42592f3 |
| 2026-09-29 | 19:53 | 20:22 | 29 | Re-checked Structure slider tickets (already shipped 9/27); reviewed and committed bottom safe-area fixes (tab bar, entry footer, share screens) and hid subscription UI until purchases exist; built iOS build 53 (52 was already used 9/17) and submitted it to TestFlight (available 20:31 CST per David; not billed time). | ec53dcf, 06ea14c, 7c19bf9, 0416398 |
| 2026-10-04 | 22:37 | 22:44 | 7 | Ticket C (App Store blocker): removed all RevenueCat/payment remnants so the binary matches the "no payments" answer to Apple: deleted the stubbed subscription store and feature flag, the Upgrade/pricing/Pro/free-tier UI on Home, Search and Settings, the admin "Pro Subscribers" stat, and the RevenueCat env vars and doc references. Sommelier flow untouched. **Follow-up:** `subscription_tier` column retained in DB, unused by app. Drop post-launch via `025_drop_subscription_tier.sql` (renumbered; 024 is the user_profiles lockdown). **Before the drop,** recreate `user_activity_summary` with `security_invoker = true`. | c280f90 |
| 2026-10-05 | 18:33 | 18:34 | 1 | Checked the repo for anything depending on the unused `subscription_tier` column (nothing in code or SQL). | (none) |
| 2026-10-05 | 21:07 | 21:11 | 3 | Security audit (pre-submission): mapped every read of `user_profiles` / `user_activity_summary` in the app and the policies that expose member emails to all signed-in users. | (none) |
| 2026-10-05 | 21:28 | 21:44 | 16 | Security fix (pre-submission): migration `024_lock_down_user_profiles.sql` removes the open read-all policy on member profiles, keeps directory and messaging working through owner-run safe views, moves admin push tokens behind a locked-down function, adds a trigger so users can no longer grant themselves admin or sommelier status, and gives the App Review demo account `paa_som` its Admin panel access. Sommelier aroma unlock now requires approved status. **Migration applied live 10/5 and verified with tests T1-T12.** | 697bf8c |
| 2026-10-22 | 23:24 | 23:25 | 1 | Ticket C (share card): scoped what exports (only the bottom wine card; the radar/aroma view is Wine Detail only), then added a static share version of the card with the Profile radar, Aroma wheel, "Would I buy again?" verdict and Best Value badge, no info buttons, missing sections omitted. Used for both Share on Social and Send to PAA member / Share externally. Ticket D: switched Share externally (and the social fallback) from expo-sharing file share to react-native-share image share so Messenger treats the card as a photo; expo-sharing kept as fallback. Typecheck clean; not yet device-tested. Minutes per hook log at time of writing; may be updated by report. | (uncommitted) |

## Post-launch follow-ups

- `025_drop_subscription_tier.sql` (recreate `user_activity_summary` with `security_invoker = true` first).
- Move sommelier cert images to a private bucket with signed URLs.
- Send the admin new-application push server-side instead of from the client.
- Switch the `wine_entries` creator UPDATE policies from `is_creator` to `app_admins`.
- Remove the duplicate `wine_entries` owner policies (`entries_owner` and `wine_entries_owner_all`).
- Bring the repo .sql files (`DEPLOY.sql`, `shared_wines.sql`) in line with the live policies.
