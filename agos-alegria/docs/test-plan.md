# Test plan and acceptance checklist

Run on the emulators first, then on the staging/production project with real phones. Tick every box before public launch.

## A. Install and access
- [ ] Opens over HTTPS on a shared link; Lighthouse "Installable" passes.
- [ ] Android Chrome: install prompt or menu "Install app" works; icon and standalone window appear.
- [ ] iPhone Safari: Share → Add to Home Screen works; icon correct.
- [ ] Welcome screen appears once; language switch (English/Cebuano/Filipino) persists after reload.
- [ ] Airplane mode: app shell opens, offline banner shows, submitting fails with a clear "not sent" message and **no** reference number.

## B. Resident flow
- [ ] Submit a valid request → reference number shown, copy button works, request appears in the staff console.
- [ ] Missing/invalid fields show plain-language errors; consent required.
- [ ] Same contact + purok within 48 h → flagged *possible duplicate* (not rejected).
- [ ] Tracking with the reference shows status, last-updated time and only **public** notes; wrong number gives a neutral error.
- [ ] After 60 track attempts/hour from one address the function rate-limits.
- [ ] My requests lists saved references on this phone and can remove them.
- [ ] Slow 3G throttling: pages stay usable; failed loads show retry.

## C. Roles and permissions (use the emulator and a rules test script)
- [ ] Anonymous user cannot read `waterRequests`, `requestPrivateDetails`, `statusHistory`, `users`, `auditLogs` or `rateLimits`, and cannot write to any collection.
- [ ] Anonymous user **can** read published announcements, schedules, published water points, barangays, settings, public stats.
- [ ] Coordinator A cannot read, update or reveal contacts for barangay B requests, or write B's announcements, schedules, water points, deliveries.
- [ ] Coordinator cannot set *Scheduled / In progress / Resolved / Unable to fulfill*; municipal admin can.
- [ ] Provider cannot read requests or contact details; can update only own deliveries' allowed fields.
- [ ] Municipal admin cannot create administrator accounts; system admin can; nobody can demote or deactivate themselves.
- [ ] Deactivated staff are locked out immediately (existing session cannot read requests).
- [ ] Setting `updatedBy` to someone else's uid on any write is rejected.
- [ ] Every status change, contact reveal, account change and operational edit has an audit entry.

## D. Operations
- [ ] Status changes follow the allowed transitions; resolved/referred/unable require a resident-visible note.
- [ ] A schedule cannot be saved as *Completed* without quantity distributed and an outcome note.
- [ ] A planned schedule is labelled "planned, not yet confirmed" to the public; a changed confirmed schedule shows the change note.
- [ ] Dashboard counts match the Requests list; outstanding includes *Referred* and *Unable to fulfill*.
- [ ] Reports: totals by barangay, time to verify, quantity delivered; CSV opens in Excel; a request note beginning with `=` is neutralized.
- [ ] The public shortage level on Water Points changes when requests are opened/closed, and shows no counts.
- [ ] Home and Schedule show a "last updated" time that moves when a schedule or announcement is edited.
- [ ] A maintenance notice set in Settings appears as a banner for residents.

## E. Accessibility and quality
- [ ] Keyboard-only use of the form and console; visible focus.
- [ ] Status badges carry icon and words, not colour alone.
- [ ] Text readable at 200% zoom; touch targets ≥ 44 px.
- [ ] Screen reader pass (TalkBack/VoiceOver) on request and track screens.

## F. Pilot exit criteria (plan §16)
- [ ] Working HTTPS URL; installable on the chosen devices.
- [ ] Residents submit and track; staff verify, update and export.
- [ ] Permissions and server-side validation tested (section C).
- [ ] Privacy notice approved and published.
- [ ] Pilot shows the workflow is usable and staff know how to run it.
