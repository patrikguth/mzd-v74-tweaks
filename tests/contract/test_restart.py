"""Actual event adapter and launcher cleanup; reboot/mount/sync are fake commands."""
from pathlib import Path
import os
import shlex
import shutil
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[2]
SHELL='C:/Program Files/Git/bin/bash.exe' if os.name=='nt' else '/bin/sh'
def bp(p):
 s=Path(p).resolve().as_posix()
 return '/'+s[0].lower()+s[2:] if len(s)>1 and s[1]==':' else s

def write(p,s):
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf-8',newline='\n');p.chmod(0o755)
with tempfile.TemporaryDirectory(prefix='cmu-restart-') as folder:
 base=Path(folder);usb=base/'usb';state=base/'state';logs=base/'logs';bins=base/'bin';events=base/'events'
 for p in [state,logs,bins]:p.mkdir()
 shutil.copytree(ROOT/'usb/lib',usb/'lib')
 source=(ROOT/'usb/installer.sh').read_text()
 prefix='PATH='+shlex.quote(bp(bins)+':/usr/bin:/bin')+'\nexport PATH\n'
 write(usb/'installer.sh',source.replace('#!/bin/sh\n','#!/bin/sh\n'+prefix,1))
 for name in ['sync','reboot','mount']:
  write(bins/name,'#!/bin/sh\necho '+name+' >> '+shlex.quote(bp(events))+'\n'+
   '[ ! -f '+shlex.quote(bp(base/('fail-'+name)))+' ]\n')
 def adapter(args):
  env=dict(os.environ,INSTALLER_STATE=bp(state),INSTALLER_LOG=bp(logs))
  return subprocess.run([SHELL,bp(usb/'installer.sh'),*args],env=env,capture_output=True,text=True,timeout=10)
 result=adapter(['event','restart','User confirmed']);assert result.returncode==0,(result.stdout,result.stderr)
 assert (state/'ui-restart').exists() and (state/'ui-close').exists() and not events.exists()
 assert 'restart User confirmed' in (logs/'ui.log').read_text()
 for p in [state/'ui-restart',state/'ui-close']:p.unlink()
 (state/'active-job').mkdir()
 assert adapter(['event','restart']).returncode==1
 assert not (state/'ui-restart').exists() and not (state/'ui-close').exists()
 (state/'active-job').rmdir()
 assert adapter(['event','close']).returncode==0
 assert (state/'ui-close').exists() and not (state/'ui-restart').exists()
 # Exercise the actual finish function without running the vehicle-only bootstrap.
 launcher=(ROOT/'usb/autorun.sh').read_text()
 finish=launcher[launcher.index('finish() {'):launcher.index('\nfail() {')]
 for scenario in ['restart','normal-exit','launcher-error','usb-ro-unavailable','sync-error','reboot-error']:
  if events.exists():events.unlink()
  for name in ['fail-mount','fail-sync','fail-reboot']:
   p=base/name
   if p.exists():p.unlink()
  request=state/'ui-restart'
  if request.exists():request.unlink()
  if scenario!='normal-exit':write(request,'')
  if scenario=='usb-ro-unavailable':write(base/'fail-mount','')
  if scenario=='reboot-error':write(base/'fail-reboot','')
  if scenario=='sync-error':write(base/'fail-sync','')
  driver=base/'finish.sh'
  write(driver,'#!/bin/sh\nset -u\n'+prefix+
   'STATE='+shlex.quote(bp(state))+'\nHERE='+shlex.quote(bp(usb))+'\n'+
   'ACTIVE=0; OPERA_PID=; HTTP_PID=; BRIDGE_PID=\n'+
   'checkpoint() { echo checkpoint >> '+shlex.quote(bp(events))+'; }\n'+
   'save_logs() { echo logs >> '+shlex.quote(bp(events))+'; }\n'+finish+'\ntrap finish 0\nexit '+('1' if scenario=='launcher-error' else '0')+'\n')
  result=subprocess.run([SHELL,bp(driver)],capture_output=True,text=True,timeout=10)
  sequence=events.read_text().splitlines()
  assert result.returncode==(0 if scenario in ['restart','normal-exit','usb-ro-unavailable'] else 1),(scenario,result.stderr,sequence)
  if scenario in ['restart','reboot-error','usb-ro-unavailable']:
   assert sequence[-2:]==['sync','reboot'],(scenario,sequence)
   assert sequence.index('logs')<sequence.index('reboot')
  else:assert 'reboot' not in sequence,(scenario,sequence)
  assert 'mount' not in sequence, 'USB remount must not block Exit/Restart'
print('RESTART_LIFECYCLE_PASSED: explicit request, active-job refusal, normal Exit, USB-ro refusal cannot block reboot, flush order, error suppression and reboot failure. No actual restart executed.')
