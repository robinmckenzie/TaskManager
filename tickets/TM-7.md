# TM-7 - Confirm that a tester label is recorded from an iPad

Status: Deferred, verification pending

Priority: Low (P3)

Type: Defect

## User problem

The owner gives people a link such as `?user=Dad` so that their dictation
activity on the deployed app is recorded under their name. This lets the owner
tell his father's testing apart from Speechmatics' and from other testers'.

During an incidental test, the owner's father opened the app on an iPad with
`?user=Dad`, and his dictation activity was recorded as `PUBLIC` instead of
`Dad`. On Windows, `?user=Robin` was recorded correctly.

TM-5 then changed how labels are applied, so that a valid label in the page
address is used for that page without relying on the browser's storage, and
that change has been deployed. The affected iPad has not been retested, so it
is not known whether the change resolved what happened there. It is not known
to be defective. The cause of the original result was not established: a
failure to save the label in that browser, the link opening in another app's
built-in browser, and an altered link were all consistent with it.

Dictation itself is unaffected. This concerns only the label under which
activity and transcripts are recorded. It is not a release blocker for TM-4 or
TM-5.

## Requirements

- Dictation activity from the affected iPad, opened with a valid `?user=NAME` link, is recorded under that name and not as `PUBLIC`.
- The first step is verification on the affected iPad with the deployed app as it stands. No change is made unless that verification, or a comparable iPhone or iPad test, shows a label still being recorded incorrectly.
- If a label is still recorded incorrectly, the cause is established from evidence on the device before a fix is chosen, including how the link was opened: in Safari, in a private tab, or inside another app.
- Any fix keeps the existing label rules: a valid label in the address takes precedence over a stored one, labels persist where storage is available, `?user=PUBLIC` clears a stored label, and invalid labels are rejected.
- Behaviour in desktop browsers is unchanged.
- No IP addresses, user-agent strings, cookies, accounts or visitor identifiers are used to tell visitors apart.
- Keep the following outside this ticket: changes to dictation, to what is recorded, or to how recorded activity is stored.

## Acceptance criteria

- On the affected iPad, opening the deployed app with `?user=Dad` and dictating once records that session's activity and transcript under `Dad`.
- The result of that check, the date, and how the link was opened are recorded in this ticket.
- If the check passes, this ticket is closed with no code change.
- If the check fails, the cause is recorded before any fix, and after the fix the same check passes on the same device.
- A labelled link continues to be recorded correctly from a desktop browser.
