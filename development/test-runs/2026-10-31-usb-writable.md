# Leave USB storage writable after installer operations

Date: 2026-10-31. Installer version: 0.9.1. Isolated host verification only.
No CMU command, remount or restart was performed during this change.

The supplied vehicle session logged an accepted Restart request followed by
`ERROR: Could not restore USB read-only state.` The launcher then suppressed
reboot. Raw vehicle evidence remains private.

Removed the USB read-only restoration from launcher Exit/Restart, export cleanup
and confirmed single-file recovery. USB read-write activation for report/export
writes remains. Writes are flushed; launcher flush failure still blocks reboot.
Internal mount restoration and watchdog cleanup remain unchanged in system.sh.
A subsequent boot mounts the USB anew according to the CMU's mount policy.
The SSH child's inherited startup-log descriptor is a separate unresolved issue;
this change removes the unnecessary USB remount dependency rather than fixing
that descriptor lifetime.

## Validation

- Manifest/USB structure and shell syntax: 11 tweaks passed.
- Actual restart event adapter / extracted launcher finish: passed, including
  refusal of USB remount commands, normal Exit, sync failure, launcher error and
  reboot failure. No USB remount command is executed by finish.
- Export entrypoints: 14 checks plus nested-installer output; passed with a fake
  mount command that refuses every USB read-only request.
- Single-file recovery: 68 adapter checks passed. A simulated USB-ro failure no
  longer makes successful recovery critical. Internal mounts still return ro;
  rollback/unknown-write failure handling is retained.
- Focused real patch worker and saved package: 37 checks passed, including
  internal mount cleanup, watchdog state, rollback and saved uninstall.
- Installer logging configuration and snapshots: passed.
- Full persistent package controller: 60 real adapter checks passed.
- ShellCheck (error severity) and git whitespace checks: passed.

The new behavior has not been vehicle-tested. Inherited writable descriptors and
other late restart failures still merit their separate follow-up work.
