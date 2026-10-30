# Report and log path cleanup

Date: 2026-10-31 (work started 2026-10-30). Isolated local tests only; no CMU
changes or vehicle test were performed for this change.

## Resulting USB layout

- Action reports: `reports/<id>/<action>-<timestamp>-<unique>/`, including run.log,
  status.txt, diagnostics and rollback archives.
- Recovery: `reports/restore-file-<id>/restore-original-.../`.
- SSH runtime: `reports/ssh/runtime-<timestamp>-<unique>/run.log`.
- SSH USB marker: `mzd-ssh-log-marker.txt`.
- Command exports: `exports/<id>/` at the originating USB mount root, including
  when the installer itself is in a nested directory.
- Installer session logs: existing `installer-logs/`, verified and retained.

Worker success/error messages derive their paths from the actual report folder.
Tests verify generated files and displayed paths for successful, repeated and
failed actions. Status remains read-only. SSH runtime folders use mktemp rather
than a reusable PID name. Tweak versions were advanced to adopt updated helper
snapshots. Older saved uninstall packages retain their original helper layout;
existing reports are not migrated or deleted.

## Verification

- Manifest/USB validation: 12 tweaks passed before the temporary trace draft was removed; 11 tweaks passed after removal.
- Worker suite: 248 real-entrypoint checks passed (plus cluster package checks).
- Package controller: 60 checks passed.
- Settings: 42 checks passed.
- Target recovery: 68 checks passed.
- Recovery mount roles: 45 checks passed.
- Restore originals: 15 scenarios passed.
- Export commands: 14 entrypoint checks plus nested-installer export passed.
- Real SSH supervisor with fake network/kernel commands: passed.
- Shim lifecycle: 6 controller operations plus 30 transform checks passed.
- Final report messages and current example consistency: passed.
- Launcher logging configuration/snapshots: passed.
- ShellCheck error-severity checks and git whitespace checks: passed.
- Legacy diffpatch path scan in runnable USB: no matches.

No firmware patch payload or OEM backup fingerprint was changed by this task.
