"""Real export entrypoints/jobs with isolated source trees, USB and commands."""
from pathlib import Path
import os
import shutil
import shlex
import subprocess
import tempfile
import time
import zipfile
from cases import CASES

ROOT = Path(__file__).resolve().parents[2]
SHELL = 'C:/Program Files/Git/bin/bash.exe' if os.name == 'nt' else '/bin/sh'
assert {k for k, v in CASES.items() if v == 'export-command'} == {'backup-jci', 'logs-collector'}
def bp(p):
    s = Path(p).resolve().as_posix()
    return '/' + s[0].lower() + s[2:] if len(s) > 1 and s[1] == ':' else s
def write(p, text):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf-8', newline='\n'); p.chmod(0o755)
checks = 0
with tempfile.TemporaryDirectory(prefix='cmu-export-') as directory:
    base = Path(directory); usb = base/'usb'; source = base/'source'; bins = base/'bin'; state = base/'state'
    source.mkdir(); bins.mkdir(); state.mkdir()
    write(source/'first.log', 'first\n'); write(source/'nested/second log.txt', 'second\n')
    shutil.copytree(ROOT/'usb/lib', usb/'lib')
    shutil.copyfile(ROOT/'usb/installer.sh', usb/'installer.sh')
    version = base/'version'; mounts = base/'mounts'; events = base/'events'
    write(version, 'JCI_SW_VER="MAZ_CMU-150_74.00.324"\n')
    write(mounts, 'mock '+bp(usb)+' vfat ro 0 0\n')
    lib = usb/'lib/export.sh'
    text = lib.read_text().replace('/jci/version.ini', bp(version)).replace('/proc/mounts', bp(mounts))
    text = text.replace('/tmp/mnt/sd[a-z][0-9]*|/mnt/sd[a-z][0-9]*', shlex.quote(bp(usb)))
    write(lib, text)
    for id_ in ['backup-jci', 'logs-collector']:
        folder = usb/'tweaks'/id_; shutil.copytree(ROOT/'usb/tweaks'/id_, folder)
        manifest = folder/'manifest.conf'
        data = manifest.read_text().replace('target=/jci', 'target='+bp(source)).replace('target=/var/log/running_log', 'target='+bp(source))
        write(manifest, data)
        worker = folder/'run.sh'
        write(worker, worker.read_text().replace('#!/bin/sh\n', '#!/bin/sh\nPATH='+shlex.quote(bp(bins)+':/usr/bin:/bin')+'\nexport PATH\n', 1))
    # Both target and mock mount paths include no fixed drive-letter assumptions.
    write(bins/'mount', '''#!/bin/sh
[ "$3" = USB ] || { echo FORBIDDEN_MOUNT >> EVENTS; exit 90; }
echo mount >> EVENTS
awk -v mode="$2" '{$4=(mode=="rw,remount"?"rw":"ro"); print}' MOUNTS > NEXT
mv NEXT MOUNTS
'''.replace('USB',shlex.quote(bp(usb))).replace('EVENTS',shlex.quote(bp(events)))
          .replace('MOUNTS',shlex.quote(bp(mounts))).replace('NEXT',shlex.quote(bp(base/'mounts.next'))))
    write(bins/'sync', '#!/bin/sh\necho sync >> '+shlex.quote(bp(events))+'\n')
    for name in ['reboot','killall','iptables','sshd']:
        write(bins/name,'#!/bin/sh\necho FORBIDDEN >> '+shlex.quote(bp(events))+'\nexit 90\n')
    write(bins/'df', '#!/bin/sh\nprintf "Filesystem 1024-blocks Used Available Capacity Mounted\\nmock 999999 1 999998 1%% usb\\n"\n')
    # Real ZIP bytes are generated/verified using a portable stand-in, not a CMU zip binary.
    helper=base/'zip_mock.py'
    write(helper, '''import sys,os,zipfile,time
from pathlib import Path
def p(s):
 if os.name=='nt' and len(s)>3 and s[0]=='/' and s[2]=='/':s=s[1]+':'+s[2:]
 return Path(s)
base=p(sys.argv[1]);mode=sys.argv[2];args=sys.argv[3:]
if (base/('fail-'+mode)).exists():raise SystemExit(1)
if mode=='zip':
 time.sleep(0.2)
 with zipfile.ZipFile(p(args[-2]),'w',zipfile.ZIP_DEFLATED) as z:
  for f in p(args[-1]).rglob('*'):
   if f.is_file():z.write(f,f.as_posix())
else:
 with zipfile.ZipFile(p(args[-1])) as z:assert z.testzip() is None
''')
    for name in ['zip','unzip']:
        write(bins/name,'#!/bin/sh\nexec '+shlex.quote(bp(Path(os.sys.executable)))+' '+shlex.quote(bp(helper))+' '+shlex.quote(bp(base))+' '+name+' "$@"\n')
    env=dict(os.environ,INSTALLER_STATE=bp(state))
    def command(id_,args,expected=0):
        global checks
        r=subprocess.run([SHELL,bp(usb/'tweaks'/id_/'run.sh')]+args,env=env,capture_output=True,text=True,timeout=20)
        assert r.returncode==expected,(id_,args,r.returncode,r.stdout,r.stderr)
        assert not events.exists() or 'FORBIDDEN' not in events.read_text()
        checks+=1;return r
    original={p.relative_to(source).as_posix():p.read_bytes() for p in source.rglob('*') if p.is_file()}
    for id_ in ['backup-jci','logs-collector']:
        if events.exists():events.unlink()
        snapshot={p.relative_to(usb).as_posix():p.read_bytes() for p in usb.rglob('*') if p.is_file()}
        assert command(id_,['status']).stdout=='uninstalled\n'
        assert not events.exists() and not (usb/'exports').exists() if id_=='backup-jci' else not events.exists()
        assert snapshot=={p.relative_to(usb).as_posix():p.read_bytes() for p in usb.rglob('*') if p.is_file()}
        command(id_,[]); command(id_,['--help']); command(id_,['install'],1)
        r=command(id_,['run']);assert 'Saved to USB:' in r.stdout
        assert ' ro ' in mounts.read_text()
        complete=list((usb/'exports'/id_).glob('*-complete'));assert len(complete)==1
        if id_=='backup-jci':
            with zipfile.ZipFile(complete[0]/'jci.zip') as z:assert z.testzip() is None and len(z.namelist())==2
        else:
            assert (complete[0]/'logs/nested/second log.txt').read_text()=='second\n'
        command(id_,['run']);assert len(list((usb/'exports'/id_).glob('*-complete')))==2
    write(base/'fail-zip','yes');command('backup-jci',['run'],1);(base/'fail-zip').unlink()
    assert len(list((usb/'exports/backup-jci').glob('*-complete')))==2
    assert list((usb/'exports/backup-jci').glob('*/.incomplete'))
    write(base/'fail-unzip','yes');command('backup-jci',['run'],1);(base/'fail-unzip').unlink()
    assert len(list((usb/'exports/backup-jci').glob('*-complete')))==2
    # Jobs use the real adapter and return immediately, allowing serial polling.
    adapter=usb/'installer.sh'
    write(adapter,adapter.read_text().replace('#!/bin/sh\n','#!/bin/sh\nPATH='+shlex.quote(bp(bins)+':/usr/bin:/bin')+'\nexport PATH\n',1))
    def job(args):
        r=subprocess.run([SHELL,bp(adapter)]+args,env=env,capture_output=True,text=True,timeout=20)
        assert r.returncode==0,(args,r.stdout,r.stderr);return r.stdout
    token=job(['start-run','backup-jci']).strip();assert token.startswith('job.')
    statuses=[]
    for _ in range(100):
        result=job(['job-status',token]);statuses.append(result)
        if result.startswith('done\n'):break
        time.sleep(0.05)
    assert result=='done\n0\n',statuses
    assert any(s.startswith('running\n') for s in statuses), 'No independent progress polling occurred.'
    assert 'Saved to USB:' in job(['job-output',token,'stdout'])
    assert job(['job-output',token,'stderr'])==''
    assert not (state/'active-job').exists()
    # A nested installer still exports at the originating USB root.
    nested = usb / 'nested installer'
    shutil.copytree(usb / 'lib', nested / 'lib')
    shutil.copytree(usb / 'tweaks/logs-collector', nested / 'tweaks/logs-collector')
    before = set((usb / 'exports/logs-collector').glob('*-complete'))
    result = subprocess.run([SHELL, bp(nested / 'tweaks/logs-collector/run.sh'), 'run'],
                            env=env, capture_output=True, text=True, timeout=20)
    assert result.returncode == 0, (result.stdout, result.stderr)
    created = set((usb / 'exports/logs-collector').glob('*-complete')) - before
    assert len(created) == 1 and bp(next(iter(created))) in result.stdout
    assert not (nested / 'exports').exists()
    assert original=={p.relative_to(source).as_posix():p.read_bytes() for p in source.rglob('*') if p.is_file()}
print('EXPORT_COMMANDS_PASSED:',checks,'entrypoint checks, read-only sources, USB-only unique outputs, ZIP validation/failure and live jobs.')
