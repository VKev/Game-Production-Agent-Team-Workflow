# Pack a mini-game build for upload.
#
# PowerShell's Compress-Archive writes entry names with BACKSLASHES, which is outside
# the ZIP spec (4.4.17.1 requires forward slashes) and platforms reject or mis-extract
# it. zipfile writes forward slashes, and game.json must sit at the archive ROOT with
# no wrapper directory, which is what the platform looks for.
import os
import sys
import zipfile

src = sys.argv[1]
out = sys.argv[2]

if not os.path.isfile(os.path.join(src, 'game.json')):
    sys.exit('game.json not found at the root of %s — wrong build directory' % src)

if os.path.exists(out):
    os.remove(out)

count = 0
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for root, dirs, files in os.walk(src):
        dirs.sort()
        for name in sorted(files):
            full = os.path.join(root, name)
            rel = os.path.relpath(full, src).replace(os.sep, '/')
            z.write(full, rel)
            count += 1

size = os.path.getsize(out)
with zipfile.ZipFile(out) as z:
    names = z.namelist()
    bad = [n for n in names if '\\' in n]
    root_files = [n for n in names if '/' not in n]

print('entries        : %d' % count)
print('archive        : %s' % out)
print('size           : %.2f MB' % (size / 1048576.0))
print('backslash names: %d  (must be 0)' % len(bad))
print('root files     : %s' % ', '.join(sorted(root_files)))
print('game.json at root: %s' % ('YES' if 'game.json' in names else 'NO'))
