# SSH Access

Enable native SSH on port 22. Wi-Fi is automatically turned on at every startup,
even if it was previously switched off. Login: cmu / jci.

The service also requests Wi-Fi client mode at each startup, allowing Mazda's
existing automatic connection to use a saved network. This includes startup
after a direct reboot that has lost the Wi-Fi checkbox state. Configure the
network and automatic connection in the Mazda menu beforehand.

Wi-Fi activation runs separately in the background after SSH has started. It
discovers wlan0 through Mazda's D-Bus service, retries at most twelve times,
and uses a two-second timeout for each request (at most eight interface IDs).
Failure leaves SSH running. It does not toggle Wi-Fi, change credentials or
keep enforcing the setting: manual switch-off lasts until the next startup.
Uninstall and Restore originals remove this behavior with the SSH payload;
they do not switch off an existing Wi-Fi connection.

- Firmware: 74.00.324
- Target: `/jci/scripts/stage_wifi.sh`
- Shared lock group: `stage_wifi`
- Restart required for UI behavior: false

Run `sh tweaks/ssh/run.sh status`, `install` or `uninstall` from the USB
repository layout. Public status reads the saved installation record; modifying actions perform a deep target check. A complete
reversible patch is installed; a supported forward patch is uninstalled.
Unsupported content is unavailable; demonstrable partial changes are broken.

SSH installed additionally requires matching service files and its enabled marker.
This persistent state does not assert a currently reachable port. Install starts
the owned service on port 22; login is cmu / jci. Uninstall removes its own hook,
payload, password overlay and firewall rule. An unrelated listener is not replaced.

Modifying actions recheck prerequisites, use exact reversible patches, retain a
verified OEM backup, preserve other tweaks and restore owned mount/watchdog state.
See ../Worker-contract.md and ../test-runs/ for protocol and evidence.
See the reviewed test records for the exact vehicle and isolated test scope.

## System reset

`reset.sh check|prepare|finish` integrates with System > Restore originals. It
validates the remaining payload, archives it on USB, disables and stops the owned
supervisor, then deletes only its verified payload after the startup file has
been restored. Native SSH and unknown files are left alone. A missing or altered
payload with active runtime can require manual review. File rollback does not
automatically restart SSH. Never invoke finish alone; use the System reset tool.

## Saved installation package

The matching worker, assets and shared helpers are saved under
`/tmp/mnt/data_persist/mzd-tweaks/installed/ssh/` before installation.
The live SSH listener payload remains under
`/tmp/mnt/resources/mzd-tweaks/ssh/`. `managed-paths.tsv` describes those
live paths for cross-tweak ownership checks; it does not choose the package store.

## Startup log lifetime

The supervisor writes startup progress to the installer's short-lived
`ssh-start.log` stream. Before creating the long-lived sshd/log-reader pipeline,
a subshell redirects its standard streams to `/dev/null`. sshd's stderr is then
routed into the reader pipe, and the reader uses `write_log` for the separate
optional USB runtime log. Detaching only the supervisor after forking would
leave the reader holding the inherited startup file open.

The supervisor still reports failed startup and tails available runtime
messages. Tests inspect real inherited descriptors using mock sshd/kernel
commands, verify runtime logging, and retain failure/stop coverage.
