#!/bin/sh
# Independent SSH listener. Factory passwd and OEM sshd are never rewritten.
set -eu
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH
# BusyBox grep on the CMU has no -x option; compare complete lines with awk.
line_is() { awk -v expected="$1" '$0 == expected {found=1} END {exit !found}' "$2"; }
SELF_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd -P)
SELF="$SELF_DIR/service.sh"
RAM=/tmp/mzd-aio-ssh
ACCOUNT=/config-mfg/passwd
PASSWD_LINK=/etc/passwd
MOUNTS=/proc/mounts
PROC=/proc
CHAIN=MZD_AIO_SSH
CONFIG="$SELF_DIR/sshd_config"
LOG=''
WIFI_PID=''
write_log() { if [ -n "$LOG" ]; then printf '%s\n' "$*" >> "$LOG" 2>/dev/null || :; fi; }
wifi_bus() {
    method=$1; shift
    dbus-send --address=unix:path=/tmp/dbus_hmi_socket \
        --type=method_call --print-reply --reply-timeout=2000 \
        --dest=com.jci.blm_nms /com/jci/blm_nms "com.jci.blm_nms.$method" "$@"
}
wifi_enable_once() {
    # A bounded background request, never a toggle or a permanent Wi-Fi monitor.
    command -v dbus-send >/dev/null || return 0
    attempt=0
    while [ "$attempt" -lt 12 ]; do
        [ -f "$SELF_DIR/enabled" ] || return 0
        attempt=$((attempt+1))
        list=$(wifi_bus GetInterfaceList 2>/dev/null) || list=''
        ids=$(printf '%s\n' "$list" | awk '/^         int32 [0-9]+$/ && ++n<=8 {print $2}')
        for id in $ids; do
            params=$(wifi_bus GetInterfaceParams "int32:$id" 2>/dev/null) || continue
            printf '%s\n' "$params" | grep -q 'string "wlan0"' || continue
            result=$(wifi_bus WIFI_SetMode "int32:$id" int32:1 2>/dev/null) || continue
            if printf '%s\n' "$result" | awk '/^   int32 / && !seen {seen=1; code=$2} END {exit !(seen && code==0)}'; then
                write_log "Wi-Fi client mode accepted: interface=$id attempt=$attempt"
                return 0
            fi
        done
        sleep 2
    done
    write_log 'Wi-Fi startup request timed out; SSH remains running.'
    return 0
}
fail() {
    echo "SSH: $*" >&2
    write_log "SSH: $*"
    # Preserve sshd's own error before the supervisor removes RAM state.
    if [ -n "$LOG" ] && [ "$LOG" != /dev/null ] && [ -f "$LOG" ]; then
        printf 'SSH runtime diagnostics (%s):\n' "$LOG" >&2
        tail -n 20 "$LOG" >&2 || :
    fi
    exit 1
}
owned_alive() {
    [ -f "$1" ] || return 1
    PID=$(cat "$1")
    case "$PID" in ''|*[!0-9]*) return 1 ;; esac
    [ "$PID" -gt 1 ] && kill -0 "$PID" 2>/dev/null && tr '\000' ' ' < "$PROC/$PID/cmdline" | grep -qF "$2"
}
port_busy() {
    PORTS=$(netstat -lnt) || fail 'Could not check listening ports.'
    printf '%s\n' "$PORTS" | awk '$1 ~ /^tcp/ {n=split($4,a,":"); if(a[n]==22) found=1} END {exit !found}'
}
account_mounted() { awk -v p="$ACCOUNT" '$2==p {f=1} END {exit !f}' "$MOUNTS"; }
prerequisites() {
    [ "$(id -u)" = 0 ] || fail 'Root shell required.'
    for T in sshd awk grep sed tr cmp mount umount iptables netstat readlink; do command -v "$T" >/dev/null || fail "Missing tool: $T"; done
    SSHD=$(command -v sshd) || fail 'SSH executable is missing.'
    case "$SSHD" in /*) ;; *) fail 'SSH executable path is not absolute.' ;; esac
    [ "$(readlink "$PASSWD_LINK")" = "$ACCOUNT" ] || fail 'Unknown account file location.'
    awk -F: '$1=="cmu" {n++; if(NF!=7 || $3!=0 || $7!="/bin/sh") bad=1} END {exit !(n==1 && !bad)}' "$ACCOUNT" || fail 'cmu account does not match the verified layout.'
    [ -s /etc/ssh/ssh_host_rsa_key ] || fail 'OEM host key is missing.'
    [ -s "$SELF_DIR/password.hash" ] || fail 'Password definition is missing.'
    "$SSHD" -t -f "$CONFIG" || fail 'SSH configuration is not valid.'
    iptables -S INPUT >/dev/null || fail 'Could not inspect firewall.'
}
firewall() {
    if ! iptables -S "$CHAIN" >/dev/null 2>&1; then
        iptables -N "$CHAIN" || return 1
        iptables -A "$CHAIN" -j ACCEPT || return 1
    fi
    iptables -S INPUT > "$RAM/rules.txt" || return 1
    if ! grep -q -- "-j $CHAIN" "$RAM/rules.txt"; then
        iptables -I INPUT 1 -p tcp --dport 22 -j "$CHAIN" || return 1
    fi
}
remove_firewall() {
    while iptables -D INPUT -p tcp --dport 22 -j "$CHAIN" 2>/dev/null; do :; done
    iptables -F "$CHAIN" 2>/dev/null || :
    iptables -X "$CHAIN" 2>/dev/null || :
    iptables -S INPUT > "$RAM/rules.txt" || return 1
    if grep -q -- "-j $CHAIN" "$RAM/rules.txt"; then return 1; fi
}
teardown() {
    RESULT=0
    if [ -n "$WIFI_PID" ]; then
        # Never signal a recycled PID belonging to another process.
        if [ -r "$PROC/$WIFI_PID/stat" ] &&
            awk -v parent="$$" '$4==parent {ok=1} END {exit !ok}' "$PROC/$WIFI_PID/stat"; then
            kill "$WIFI_PID" 2>/dev/null || :
        fi
        wait "$WIFI_PID" 2>/dev/null || :
        WIFI_PID=''
    fi
    if owned_alive "$RAM/daemon.pid" "$CONFIG"; then kill "$PID" || RESULT=1; fi
    if account_mounted; then
        if [ -f "$RAM/owner" ] && [ "$(cat "$RAM/owner")" = "$SELF" ] && cmp -s "$ACCOUNT" "$RAM/passwd"; then
            umount "$ACCOUNT" || RESULT=1
            if command -v nscd >/dev/null; then nscd -i passwd 2>/dev/null || :; fi
        else
            echo 'SSH: Account overlay owned by another process is left unchanged.' >&2
            RESULT=1
        fi
    fi
    remove_firewall || RESULT=1
    if [ "$RESULT" = 0 ] && [ -d "$RAM" ]; then
        rm -f "$RAM/owner" "$RAM/passwd" "$RAM/supervisor.pid" "$RAM/daemon.pid" "$RAM/sshd.pid" "$RAM/ports.txt" "$RAM/rules.txt"
        rmdir "$RAM" || RESULT=1
    fi
    return "$RESULT"
}
stop_service() {
    if owned_alive "$RAM/supervisor.pid" "$SELF boot"; then
        STOP_PID=$PID
        kill "$STOP_PID"
        N=0
        while kill -0 "$STOP_PID" 2>/dev/null && [ "$N" -lt 10 ]; do sleep 1; N=$((N+1)); done
        if kill -0 "$STOP_PID" 2>/dev/null; then fail 'Managed SSH startup process did not terminate.'; fi
    fi
    if [ -d "$RAM" ]; then teardown || fail 'Could not fully stop SSH.'; fi
    echo 'SSH stopped; original accounts and firewall access restored.'
}
case "${1:-}" in
check)
    prerequisites
    if ! owned_alive "$RAM/supervisor.pid" "$SELF boot" && port_busy; then fail 'Port 22 is already in use. Existing service is left unchanged.'; fi
    echo 'SSH prerequisites checked.'; exit 0 ;;
status)
    if owned_alive "$RAM/supervisor.pid" "$SELF boot" && owned_alive "$RAM/daemon.pid" "$CONFIG"; then
        echo 'SSH is running: port 22, user cmu.'
        if command -v ip >/dev/null; then
            ip addr show 2>/dev/null | awk '/inet / {split($2,a,"/"); if(a[1]!="127.0.0.1") print "Connect: ssh cmu@" a[1]}' || :
        fi
        echo 'If no address is shown yet, check the Wi-Fi connection.'
        exit 0
    fi
    echo 'Managed SSH service is not running.'; exit 1 ;;
stop) stop_service; exit 0 ;;
boot) ;;
*) fail 'Usage: service.sh check|boot|status|stop' ;;
esac
[ -f "$SELF_DIR/enabled" ] || exit 0
if owned_alive "$RAM/supervisor.pid" "$SELF boot"; then echo 'Managed SSH service is already running.'; exit 0; fi
if [ -d "$RAM" ]; then stop_service; fi
umask 077
printf 'SSH startup phase: create runtime state\n' >&2
mkdir "$RAM" || fail 'Could not create SSH state directory.'
printf '%s\n' "$SELF" > "$RAM/owner"
printf '%s\n' "$$" > "$RAM/supervisor.pid"
finish() {
    CODE=$?
    trap - 0
    set +e
    teardown || CODE=1
    exit "$CODE"
}
trap finish 0
trap 'exit 0' INT TERM
# Runtime logs only on a matching attached USB; never in internal flash or RAM.
LOG=/dev/null
for U in "${2:-}" /tmp/mnt/sda1 /tmp/mnt/sdb1 /tmp/mnt/sdc1 /tmp/mnt/sdd1; do
    [ -n "$U" ] || continue
    if [ -f "$U/mzd-ssh-log-marker.txt" ] && line_is 'MZD-AIO-SSH-v1' "$U/mzd-ssh-log-marker.txt"; then
        if mkdir -p "$U/reports/ssh" &&
            D=$(mktemp -d "$U/reports/ssh/runtime-$(date +%Y%m%d-%H%M%S)-XXXXXX") &&
            : > "$D/run.log"; then LOG="$D/run.log"; break; fi
    fi
done
printf 'SSH startup phase: validate configuration and prerequisites\n' >&2
prerequisites
if port_busy; then fail 'Port 22 is already in use. Existing service is left unchanged.'; fi
account_mounted && fail 'Account file already has an overlay. Refusing a second overlay.'
printf 'SSH startup phase: prepare account overlay\n' >&2
PASSWORD_HASH=$(cat "$SELF_DIR/password.hash")
case "$PASSWORD_HASH" in '$5$'*) ;; *) fail 'Unknown password format.' ;; esac
awk -F: -v h="$PASSWORD_HASH" 'BEGIN {OFS=":"} $1=="cmu" {$2=h} {print}' "$ACCOUNT" > "$RAM/passwd"
unset PASSWORD_HASH
chmod 644 "$RAM/passwd"
mount -o bind "$RAM/passwd" "$ACCOUNT" || fail 'Could not set up password in RAM.'
cmp -s "$RAM/passwd" "$ACCOUNT" || fail 'Could not verify account overlay.'
if command -v nscd >/dev/null; then nscd -i passwd 2>/dev/null || :; fi
printf 'SSH startup phase: launch sshd\n' >&2
# Detach the whole long-lived pipeline before forking either child. Detaching
# only the supervisor later leaves the log reader holding ssh-start.log open.
(
    exec </dev/null >/dev/null 2>&1
    "$SSHD" -D -e -f "$CONFIG" 2>&1 | while IFS= read -r LINE; do write_log "$LINE"; done
) &
sleep 1
[ -s "$RAM/sshd.pid" ] || fail 'SSH could not open port 22.'
DAEMON=$(cat "$RAM/sshd.pid")
case "$DAEMON" in ''|*[!0-9]*) fail 'SSH returned an invalid process ID.' ;; esac
printf '%s\n' "$DAEMON" > "$RAM/daemon.pid"
owned_alive "$RAM/daemon.pid" "$CONFIG" || fail 'SSH could not open port 22.'
printf 'SSH startup phase: configure firewall\n' >&2
firewall || fail 'Could not allow port 22 through the firewall.'
write_log 'SSH started: port 22, user cmu. Log in with the agreed default password.'
# Startup is complete: release the installer's startup-log streams.
exec >/dev/null 2>&1
wifi_enable_once >/dev/null 2>&1 &
WIFI_PID=$!
while kill -0 "$DAEMON" 2>/dev/null; do
    firewall || write_log 'Firewall will be checked again on the next iteration.'
    sleep 5 &
    wait $! || :
done
fail 'SSH process exited.'
