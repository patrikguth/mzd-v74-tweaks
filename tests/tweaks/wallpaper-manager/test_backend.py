"""Pure Lua 5.1 wallpaper domain tests with a generated synthetic PNG."""
from pathlib import Path
import shutil,struct,subprocess,tempfile,zlib
ROOT=Path(__file__).resolve().parents[3]
def fixture_png():
    def chunk(kind,data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    pixels=zlib.compress((b'\0'+b'\0'*800*4)*480)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',800,480,8,6,0,0,0))+chunk(b'IDAT',pixels)+chunk(b'IEND',b'')
def main():
    lua=shutil.which('lua5.1') or shutil.which('lua')
    if not lua:raise SystemExit('Lua 5.1 is required for the backend test.')
    with tempfile.TemporaryDirectory(prefix='wallpaper-domain-') as directory:
        image=Path(directory)/'generated.png';image.write_bytes(fixture_png())
        module=(ROOT/'usb/tweaks/wallpaper-manager/assets/service').as_posix()
        subprocess.run([lua,'-e','package.path='+repr(module+'/?.lua;')+'..package.path',str(Path(__file__).with_name('store.lua')),str(image)],check=True,timeout=60)
if __name__=='__main__':main()
