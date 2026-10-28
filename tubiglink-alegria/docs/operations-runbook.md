# Operations runbook

An out-of-date app is worse than none. Ownership and routine matter as much as the code.

## Daily routine
| When | Who | Task |
| --- | --- | --- |
| Start of day | Each coordinator | Open **Requests**, filter *Submitted* and *Under verification* in your barangay; verify or refer each; add a resident-visible note for every closure or referral. |
| Start of day | Municipal team | Dashboard: check unverified and outstanding counts and "oldest open"; review *Unable to fulfill* and *Referred* cases. |
| When anything changes | Authorized publisher | Update the schedule or announcement; for a changed confirmed schedule write the change note (residents see it). |
| End of day | Municipal team | Check that nothing outdated is still showing: complete or cancel past schedules (with outcome or reason) and archive old announcements. Residents see a "last updated" time on Home and Schedule, so a stale page is visible to them. |
| Weekly | Municipal team | Review reports (outstanding by barangay, time to verify, quantities delivered); export CSV for the meeting. |
| Monthly | Municipal team + technical admin | Review audit log, accounts and the impact indicators in the plan. |

## Escalation
Define in `docs/requirements-and-workflow.md` §3. Suggested: unverified > [24 h] → municipal office; verified and unfulfilled > [72 h] → mayor's office / provider referral; any request tagged as health-critical → phone call, not only the app.

## Staff accounts
* New: municipal administrator creates the account in **Staff**; the console shows a one-time password-setup link, which must be shared privately.
* Role change or leaving: deactivate in **Staff** the same day. Access ends immediately.
* Review all active accounts monthly. Administrator accounts need multi-factor sign-in (see README).

## Incidents
| Situation | Action |
| --- | --- |
| App down | Switch to phone / walk-in intake; post the hotline in barangay channels; technical admin checks Firebase status and function logs. |
| Wrong schedule published | Edit it (change note required for confirmed ones) or cancel with a reason; add an announcement. |
| Suspected data exposure | Technical admin disables affected accounts, preserves logs, informs the privacy officer immediately; follow the breach procedure (NPC notification rules apply). |
| Spam or abuse requests | Mark as duplicate/refer with note; the function already rate-limits per network address; enable App Check enforcement. |
| Lost admin access | Another system administrator resets; if none, re-run `bootstrap-admin` with the service account. |

## Backups and recovery
Enable Firestore point-in-time recovery and a scheduled export to a locked-down bucket. Test a restore into a separate project once before launch. Keep service-account keys out of the repository and off shared drives.

## Costs
Set a Firebase budget alert. Request volume for one municipality is small; the usual cost drivers are Functions invocations and Firestore reads from dashboards left open on many screens.
