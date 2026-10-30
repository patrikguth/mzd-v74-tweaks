"""Exercise literal logging config and actual launcher snapshots in isolation."""
from pathlib import Path
import os
import shlex
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
SHELL = 'C:/Program Files/Git/bin/bash.exe' if os.name == 'nt' else '/bin/sh'

def bp(p):
    s = Path(p).resolve().as_posix()
    return '/' + s[0].lower() + s[2:] if len(s) > 1 and s[1] == ':' else s

with tempfile.TemporaryDirectory(prefix='cmu-logging-') as directory:
    base = Path(directory)
    config = base / 'installer.conf'
    helper = shlex.quote(bp(ROOT / 'usb/lib/logging.sh'))
    def parse():
        return subprocess.run([SHELL, '-c', 'HERE=' + shlex.quote(bp(base)) +
            '; . ' + helper + '; mzd_logging_config || exit 1; printf "%s" "$MZD_LOG_LEVEL"'],
            capture_output=True, text=True, timeout=10)
    assert parse().stdout == 'debug'
    config.write_text('# No explicit logging level\n')
    assert parse().stdout == 'debug'
    assert 'logging=debug' in (ROOT / 'usb/installer.conf').read_text()
    for mode in ['normal', 'debug', 'off']:
        config.write_bytes(('# comment\r\nlogging=' + mode + '\r\n').encode())
        result = parse()
        assert result.returncode == 0 and result.stdout == mode, result
    for value in ['logging=debug\nlogging=off', 'logging=other', 'other=debug',
                  'logging=$(touch injection)', 'logging=debug; touch injection']:
        config.write_text(value + '\n')
        assert parse().returncode != 0, value
    assert not (base / 'injection').exists()
    # Release metadata is literal and safe to insert in HTML and log headers.
    version_helper = shlex.quote(bp(ROOT / 'usb/lib/version.sh'))
    def release():
        return subprocess.run([SHELL, '-c', '. ' + version_helper +
            '; mzd_installer_version ' + shlex.quote(bp(base))],
            capture_output=True, text=True, timeout=10)
    assert release().stdout == 'unknown\n'
    for value, expected in [('0.9.0\n', '0.9.0'), ('1.2.3\r\n', '1.2.3'),
                            ('$(touch injection)\n', 'unknown'),
                            ('0.9.0\nextra\n', 'unknown'), ('', 'unknown')]:
        (base / 'VERSION').write_bytes(value.encode())
        result = release()
        assert result.returncode == 0 and result.stdout == expected + '\n', result
    assert not (base / 'injection').exists()

    source = (ROOT / 'usb/autorun.sh').read_text()
    save = source[source.index('save_logs() {'):source.index('\nnative_surface() {')]
    state = base / 'state'; state.mkdir()
    for name in ['launcher.log', 'http.log', 'ui.log']:
        (state / name).write_text('example ' + name)
    for mode in ['normal', 'debug', 'off']:
        logs = base / mode; logs.mkdir()
        subprocess.run([SHELL, '-c',
            'STATE=' + shlex.quote(bp(state)) + '; LOG_DIR=' + shlex.quote(bp(logs)) +
            '; MZD_LOG_LEVEL=' + mode + '; sync() { :; }; ' + save + '; save_logs'],
            check=True, capture_output=True, timeout=10)
        assert sorted(p.name for p in logs.iterdir()) == ([] if mode == 'off' else ['http.log', 'launcher.log', 'ui.log'])
    assert 'INSTALLER_LOG=$STATE' in source
    assert 'SECONDS_WAITED % 30' in source
print('LOGGING_PASSED: normal/debug/off, CRLF, invalid/duplicate data rejection, RAM UI events and actual USB snapshots.')
