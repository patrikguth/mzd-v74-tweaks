# Launcher tweaks

Each immediate child folder contains manifest.conf, run.sh, README.md and assets/.
The launcher discovers these folders directly; grouping is manifest data.

Shared helpers live in `usb/lib/`. Keep the repository runtime layout intact on USB.
Status returns installed, uninstalled, unavailable or broken, with required
stderr reasons for the last two states. It uses RAM scratch space only.
Action reports are created under `reports/<tweak-id>/<action>-<timestamp>-<unique>/`
at the USB root. SSH runtime logs use `reports/ssh/runtime-<timestamp>-<unique>/`.
Command exports use `exports/<tweak-id>/`; launcher logs use `installer-logs/`.

Read [Contributing](CONTRIBUTING.md) and [Worker contract](Worker-contract.md). These are the maintained
workers for the new launcher; no older entrypoint or patch compatibility is kept.
