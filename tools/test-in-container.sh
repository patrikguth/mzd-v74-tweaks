#!/bin/sh
# Run the repository checks in Linux containers that match CI.
# Works on macOS, Linux, WSL and Git Bash; needs only Docker on the host.
#
#   tools/test-in-container.sh                  all "Validate tweaks" steps
#   tools/test-in-container.sh workers          BusyBox worker suite only
#   tools/test-in-container.sh run CMD...       one command, CI runner image
#   tools/test-in-container.sh busybox CMD...   one command, BusyBox image
#
# CMU_TEST_ONLY=<tweak-id> limits the worker suite to one tweak.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
IMAGE=mzd-tweaks-test

usage() {
    sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
}

command -v docker >/dev/null 2>&1 || {
    echo "Docker is required. Install Docker Desktop, OrbStack or Colima." >&2
    exit 1
}
docker info >/dev/null 2>&1 || {
    echo "The Docker daemon is not running. Start Docker Desktop, OrbStack or 'colima start'." >&2
    exit 1
}

# Git Bash would rewrite the container paths; give Docker a Windows path.
MSYS_NO_PATHCONV=1
export MSYS_NO_PATHCONV
HOST_ROOT=$ROOT
if (cd "$ROOT" && pwd -W) >/dev/null 2>&1; then HOST_ROOT=$(cd "$ROOT" && pwd -W); fi

build() {
    docker build -q --target "$1" -t "$IMAGE:$1" -f "$HOST_ROOT/tools/container/Dockerfile" \
        "$HOST_ROOT/tools/container" >/dev/null
}

# Same isolation as the CI worker step: no network, read-only repository.
run_in() {
    target=$1; shift
    build "$target"
    docker run --rm --network none --read-only --cap-drop ALL \
        --security-opt no-new-privileges --user "$(id -u):$(id -g)" \
        --tmpfs /tmp:rw,exec,nosuid,size=512m \
        -e MZD_TEST_CONTAINER=1 -e CMU_TEST_ONLY="${CMU_TEST_ONLY:-}" \
        -v "$HOST_ROOT:/repo:ro" -w /repo "$IMAGE:$target" "$@"
}

workers() {
    echo "=== contract: BusyBox workers (python:3.12-alpine, CMU_TEST_BUSYBOX=1)"
    run_in workers python tests/contract/test_workers.py
}

case "${1:-all}" in
    all)
        status=0
        run_in ubuntu python tools/container/run-ci-steps.py || status=1
        workers || { echo "FAILED BusyBox worker suite"; status=1; }
        [ "$status" = 0 ] && echo "=== All checks passed in containers."
        exit "$status" ;;
    workers) workers ;;
    run) shift; [ $# -gt 0 ] || usage; run_in ubuntu "$@" ;;
    busybox) shift; [ $# -gt 0 ] || usage; run_in workers "$@" ;;
    -h|--help|help) usage ;;
    *) usage ;;
esac
