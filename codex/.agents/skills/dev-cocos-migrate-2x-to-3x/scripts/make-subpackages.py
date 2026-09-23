# Move the heavy asset bundles out of a mini-game build's main package.
#
#   python .migration/tools/make-subpackages.py build/bytedance-mini-game
#
# ByteDance caps the MAIN package at 4 MB and subpackages at 20 MB. Cocos allows only
# one compression type per bundle, so the build is produced with merge_dep (few files,
# everything in the main package) and this step relocates the four heavy bundles
# afterwards. Without it the main package is ~4.7 MB and the platform rejects it.
#
# Three things have to agree or the game boots to a black screen:
#   1. the files live under subpackages/<name>/ instead of assets/<name>/;
#   2. each subpackage's entry is renamed index.js -> game.js, which is the name the
#      platform loads for a subpackage root;
#   3. BOTH manifests list them — game.json "subpackages" (lowercase, as the shipped
#      build uses) and src/settings.json assets.subpackages.
#
# internal and main must STAY in assets/: main holds the start scene and is preloaded.
#
# Idempotent: running it twice is a no-op. Derived from the layout of the build that
# was verified working, not from guesswork.
import json
import os
import shutil
import sys

MOVE = ['font', 'framework', 'game', 'local']
KEEP = ['internal', 'main']
CEILING_MB = 4.0

build = sys.argv[1].rstrip('/\\')

game_json = os.path.join(build, 'game.json')
settings_json = os.path.join(build, 'src', 'settings.json')
for f in (game_json, settings_json):
    if not os.path.isfile(f):
        sys.exit('%s not found — wrong build directory?' % f)

assets = os.path.join(build, 'assets')
subs = os.path.join(build, 'subpackages')

moved, already = [], []
for name in MOVE:
    src = os.path.join(assets, name)
    dst = os.path.join(subs, name)
    if os.path.isdir(dst):
        already.append(name)
        continue
    if not os.path.isdir(src):
        sys.exit('bundle %r is neither in assets/ nor subpackages/ — build layout unexpected' % name)
    os.makedirs(subs, exist_ok=True)
    shutil.move(src, dst)
    entry = os.path.join(dst, 'index.js')
    if os.path.isfile(entry):
        shutil.move(entry, os.path.join(dst, 'game.js'))
    elif not os.path.isfile(os.path.join(dst, 'game.js')):
        sys.exit('bundle %r has no index.js nor game.js to serve as its entry' % name)
    moved.append(name)

for name in KEEP:
    if not os.path.isdir(os.path.join(assets, name)):
        sys.exit('bundle %r must stay under assets/ but is missing' % name)

with open(game_json, 'r', encoding='utf-8') as f:
    gj = json.load(f)
gj['subpackages'] = [{'root': 'subpackages/%s/' % n, 'name': n} for n in MOVE]
with open(game_json, 'w', encoding='utf-8') as f:
    json.dump(gj, f, ensure_ascii=False, indent=2)

with open(settings_json, 'r', encoding='utf-8') as f:
    st = json.load(f)
st.setdefault('assets', {})['subpackages'] = list(MOVE)
with open(settings_json, 'w', encoding='utf-8') as f:
    json.dump(st, f, ensure_ascii=False, separators=(',', ':'))


def measure(root, skip=None):
    total = files = 0
    for dirpath, dirnames, filenames in os.walk(root):
        if skip and os.path.abspath(dirpath).startswith(os.path.abspath(skip)):
            dirnames[:] = []
            continue
        for n in filenames:
            total += os.path.getsize(os.path.join(dirpath, n))
            files += 1
    return files, total


main_files, main_bytes = measure(build, skip=subs)
sub_files, sub_bytes = measure(subs) if os.path.isdir(subs) else (0, 0)

print('moved            : %s' % (', '.join(moved) or '(none)'))
if already:
    print('already in place : %s' % ', '.join(already))
print('main package     : %d files  %.2f MB   %s (ceiling %.2f MB)'
      % (main_files, main_bytes / 1048576.0,
         'OK' if main_bytes / 1048576.0 < CEILING_MB else 'OVER', CEILING_MB))
print('subpackages      : %d files  %.2f MB   (ceiling 20.00 MB)' % (sub_files, sub_bytes / 1048576.0))
print('game.json        : %s' % json.dumps(gj['subpackages'], ensure_ascii=False))
print('settings.json    : %s' % json.dumps(st['assets']['subpackages']))

sys.exit(0 if main_bytes / 1048576.0 < CEILING_MB else 1)
