# Three-second installer start delay

Date: 2026-10-31. Installer version: 0.9.2 (unreleased working tree).

At the user's request, autorun waits three seconds before starting the transport,
preparing the Opera session or launching the installer browser. Existing logging
initialization precedes the wait so launcher.log records the delay. Surface and
keyboard activation retain their existing sequence; no repeated activation or
background surface monitor was added.

This is a timing mitigation, not a verified GUI-readiness handshake or proof that
all startup races are eliminated. It also delays startup on ordinary USB insertion.
The initial implementation was local; the authorized USB deployment is recorded below.

Installer UI and browser transport tests passed. The earlier experimental
JavaScript activation delay was removed; the final delay is in autorun.sh only.

## Bench USB deployment and first boot

At the user's request, compared all 93 local runtime files with the attached
installer USB. Only autorun.sh, VERSION, lib/recovery.sh and ui/app.js differed.
Archived the previous four files privately, staged their replacements on the
USB, verified hashes before and after publication by rename, flushed writes,
and requested the authorized reboot. Internal CMU files were not changed.

SSH returned after reboot. The launcher log reports version 0.9.2 and the
three-second wait at 00:00:28, followed by transport/browser startup at 00:00:34
and the secondary visibility request at 00:00:44. UI readiness was recorded at
00:00:43, with a successful native method reply. This confirms execution of
the delayed launcher on the bench. The user confirmed that the installer appears
with a delay and is usable. One successful boot does not establish elimination
of the intermittent race.
