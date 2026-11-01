#!/bin/sh
# Shared GUI service lifecycle. Never touches SSH or the native MMUI services.
set -eu
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH
HERE=$(CDPATH= cd "$(dirname "$0")" && pwd -P)
RUNTIME=${HERE%/service}
DATA=${RUNTIME%/mzd-gui-runtime}
RAM=/tmp/mzd-gui-service
STORE=/tmp/mnt/data_persist/mzd-tweaks/gui-data
ram_owned() {
    [ -d "$RAM" ] && [ ! -L "$RAM" ] && [ -f "$RAM/owner" ] && [ ! -L "$RAM/owner" ] || return 1
    printf 'MZD_GUI_RAM_V1\n' | cmp -s - "$RAM/owner"
}
owned_alive() {
    [ -f "$RAM/pid" ] && [ ! -L "$RAM/pid" ] || return 1
    pid=$(cat "$RAM/pid")
    case "$pid" in ''|*[!0-9]*) return 1 ;; esac
    [ "$pid" -gt 1 ] && kill -0 "$pid" 2>/dev/null &&
        tr '\000' '\n' < "/proc/$pid/cmdline" | awk -v expected="$HERE/server.lua" '$0==expected {found=1} END {exit !found}'
}
check() {
    [ "$(readlink -f "$RUNTIME")" = "$RUNTIME" ] && [ -d "$STORE" ] && [ ! -L "$STORE" ] || return 1
    [ -f "$DATA/mzd-gui-services.tsv" ] && [ ! -L "$DATA/mzd-gui-services.tsv" ] || return 1
    command -v lua >/dev/null && command -v sync >/dev/null && command -v df >/dev/null
}
case "${1:-}" in
    check) check ;;
    stop)
        [ ! -e "$RAM" ] || ram_owned || exit 1
        [ ! -L "$RAM" ] || exit 1
        if owned_alive; then
            kill -TERM "$pid" || exit 1
            n=0
            while owned_alive && [ "$n" -lt 10 ]; do sleep 1; n=$((n+1)); done
            if owned_alive; then printf 'GUI service did not stop; files retained.\n' >&2; exit 1; fi
        elif [ -f "$RAM/pid" ]; then
            candidate=$(cat "$RAM/pid")
            case "$candidate" in ''|*[!0-9]*) exit 1 ;; esac
            if kill -0 "$candidate" 2>/dev/null; then printf 'Foreign process at GUI service PID; nothing stopped.\n' >&2; exit 1; fi
        fi
        if [ -d "$RAM" ]; then
            for file in pid connection.js connection.new; do [ ! -L "$RAM/$file" ] || exit 1; rm -f "$RAM/$file"; done
        fi
        ;;
    boot)
        check || exit 1
        owned_alive && exit 0
        [ ! -e "$RAM" ] || { [ -d "$RAM" ] && [ ! -L "$RAM" ]; }
        umask 077
        if [ ! -d "$RAM" ]; then mkdir "$RAM"; printf 'MZD_GUI_RAM_V1\n' > "$RAM/owner"; fi
        ram_owned || exit 1
        [ ! -f "$RAM/pid" ] || { candidate=$(cat "$RAM/pid"); case "$candidate" in ''|*[!0-9]*) exit 1 ;; esac; ! kill -0 "$candidate" 2>/dev/null; }
        for file in pid connection.js connection.new; do [ ! -L "$RAM/$file" ] || exit 1; rm -f "$RAM/$file"; done
        [ ! -L "$RAM/service.log" ] && [ ! -L "$RAM/service.previous.log" ] && [ ! -L "$RAM/lock" ] || exit 1
        if [ -f "$RAM/service.log" ]; then mv "$RAM/service.log" "$RAM/service.previous.log"; fi
        # Close inherited installer descriptors; the child must survive launcher exit.
        exec lua "$HERE/server.lua" "$DATA/mzd-gui-modules" "$DATA/mzd-gui-services.tsv" "$STORE" </dev/null >"$RAM/service.log" 2>&1
        ;;
    *) printf 'Usage: sh supervisor.sh <check|boot|stop>\n' >&2; exit 1 ;;
esac
