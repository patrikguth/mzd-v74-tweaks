# SSH startup-log descriptor lifetime

Date: 2026-10-31. SSH tweak version: 0.8.7. Isolated host tests only; no vehicle
service, real sshd, mount, firewall or restart was used.

## Change

Detach stdin/stdout/stderr inside the background pipeline subshell before
forking sshd and its log reader. The reader's standard output and error no longer
inherit ssh-start.log from the installer. sshd stderr still reaches the pipe;
write_log still writes to the separate runtime log. The supervisor keeps its
short startup stream for progress/failure and detaches it after readiness.

## Verification

- Actual service.sh with mocked kernel/network/sshd: passed.
- Real reader stdout and stderr descriptors observed as /dev/null.
- Daemon stderr no longer references ssh-start.log.
- Startup progress and explicit daemon failure diagnostics retained.
- Runtime daemon messages reach the separate USB runtime log.
- Existing network, firewall, duplicate-start, rollback and owned-stop cases pass.
- Negative control: the updated test run against HEAD's old service source
  fails at reader-stdout, showing the inherited ssh-start.log descriptor. The
  corrected source passes the same test.
- Worker/saved-uninstall checks: 46 real-entrypoint checks passed.
- Full persistent package checks: 60 real adapter checks passed.
- Manifest/USB validation (11 tweaks), ShellCheck error checks and git whitespace
  checks: passed.

No firmware patch or OEM backup fingerprint changed. Vehicle descriptor/remount
confirmation remains untested. The independent USB-remount removal in installer
0.9.1 remains in place.
