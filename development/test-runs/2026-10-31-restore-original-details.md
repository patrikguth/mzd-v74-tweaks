# Quiet original-file recovery checks (issue #20)

Date: 2026-10-31. Installer version: 0.9.2.

The read-only restore check now returns `original` with exit 0 for an exact OEM
target, including when no .org backup exists. The detail view keeps its ordinary
description and hides Restore for that result. Modified targets retain the
existing recovery offer, warning and explicit confirmation. Recovery availability
alone does not disable Install; existing installation checks remain authoritative.
Direct Restore still refuses an already original target.

## Isolated verification

- `python tools/validate.py`: all 11 tweaks, metadata and shell structure passed.
- `tests/installer/test-ui.cjs`: passed, including stock/modified target details,
  Install availability, malformed original responses, stale replies and the
  existing recovery confirmation/failure cases.
- `python tests/contract/test_recovery.py`: 70 real adapter checks passed.
  Stock targets with/without backups produce no stderr and no file writes;
  explicit Restore remains refused. Windows skipped symlink-specific fixtures.
- `CMU_TEST_ONLY=list-beep python tests/contract/test_workers.py`: 37 real
  entrypoint checks passed, including saved uninstall and unrelated-edit retention.
  The initial broad worker run was stopped in favor of this focused lifecycle
  check. An initial focused attempt hit a process timeout; its repeat passed.
- `git diff --check`: passed.

## Emulation and vehicle limits

`python tests/transport/test-in-vm.py --transport` did not complete its 600-second
deadline. The isolated VM logged a 178-second soft lockup and completed five
initial checks before the timeout; this is not a passing transport result.
No transport implementation was changed. No live CMU operation or vehicle test
was performed, and this record does not establish vehicle verification.
