#!/bin/sh
# Restore originals archives the baseline before restoring the OEM settings.
set -u
SELF=$(readlink -f "$0") || exit 1
HERE=$(dirname "$SELF")
ROOT=$(CDPATH= cd "$HERE/../.." && pwd) || exit 1
. "$ROOT/lib/report.sh" || exit 1
. "$ROOT/lib/system.sh" || exit 1
. "$ROOT/lib/manifest.sh" || exit 1
mzd_manifest_load "$HERE/manifest.conf" || exit 1
. "$HERE/touch.sh" || exit 1
check() {
    touch_require || return 1
    if [ ! -e "$TOUCH_STATE" ] && grep -qF 'MZD touch-while-driving:' "$APP"; then
        printf 'Touch patch has no original settings backup; manual recovery required.\n' >&2
        return 1
    fi
}
[ "$#" = 1 ] || exit 1
case "$1" in
    check) check; exit $? ;;
    prepare|finish) ;;
    *) exit 1 ;;
esac
[ "${ACTION:-}" = run ] && [ -d "${MZD_SYSTEM:-}" ] &&
    [ -d "${MZD_RESET_DIR:-}" ] || exit 1
check || exit 1
[ -e "$TOUCH_STATE" ] || exit 0
touch_baseline || exit 1
if [ "$1" = prepare ]; then
    cp "$TOUCH_STATE/original.txt" "$MZD_RESET_DIR/original.txt" &&
        cmp -s "$TOUCH_STATE/original.txt" "$MZD_RESET_DIR/original.txt" || exit 1
    sync
    entry_bus=$(touch_read bus_bcm_speed_restriction) || exit 1
    entry_lvds=$(touch_read lvds_speed_restriction) || exit 1
    interrupted() {
        failed=0
        touch_set bus_bcm_speed_restriction "$entry_bus" || failed=1
        touch_set lvds_speed_restriction "$entry_lvds" || failed=1
        [ "$failed" = 0 ] || mzd_fatal 'Interrupted touch reset rollback failed. Do NOT reboot.'
        printf 'Touch reset interrupted; entry settings restored. Do NOT reboot.\n' >&2
        exit 2
    }
    trap interrupted INT TERM
    if ! touch_pair "$BASE_BUS" "$BASE_LVDS"; then
        failed=0
        touch_set bus_bcm_speed_restriction "$entry_bus" || failed=1
        touch_set lvds_speed_restriction "$entry_lvds" || failed=1
        [ "$failed" = 0 ] || mzd_fatal 'Touch reset rollback failed. Do NOT reboot.'
        exit 1
    fi
    trap - INT TERM
else
    cmp -s "$TOUCH_STATE/original.txt" "$MZD_RESET_DIR/original.txt" || exit 1
    [ "$(touch_read bus_bcm_speed_restriction)" = "$BASE_BUS" ] &&
        [ "$(touch_read lvds_speed_restriction)" = "$BASE_LVDS" ] ||
        mzd_fatal 'Original touch settings could not be verified. Do NOT reboot.'
    mzd_system_remount_rw /tmp/mnt/resources || exit 1
    touch_remove || exit 1
fi
