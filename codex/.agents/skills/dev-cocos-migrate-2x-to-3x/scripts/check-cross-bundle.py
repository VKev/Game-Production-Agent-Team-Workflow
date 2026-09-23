# A script in bundle A that imports a script in bundle B fails at runtime unless B is
# already loaded. SystemJS cannot resolve the chunks:/// specifier, falls back to
# <script src="chunks:///_virtual/X.ts">, and the load errors out as "SystemJS Error#3
# ... did not instantiate". That is exactly the crash reported on TikTok iOS.
#
# main is loaded first (it holds the start scene), so an import from main into any
# other bundle is fatal at boot. Report every cross-bundle edge and mark the fatal ones.
import os
import io
import json
import re

ASSETS = 'assets'
SEP = chr(92)  # backslash, kept out of string literals so the file survives heredocs


def norm(p):
    return os.path.normpath(p).replace(SEP, '/')


bundles = {}
for root, dirs, files in os.walk(ASSETS):
    for f in files:
        if not f.endswith('.meta'):
            continue
        target = os.path.join(root, f[:-5])
        if not os.path.isdir(target):
            continue
        try:
            m = json.load(io.open(os.path.join(root, f), encoding='utf-8'))
        except Exception:
            continue
        ud = m.get('userData') or {}
        if ud.get('isBundle'):
            bundles[norm(target)] = ud.get('bundleName') or os.path.basename(target)

print('bundle roots:')
for k in sorted(bundles):
    print('   %-30s -> %s' % (k, bundles[k]))
print('   %-30s -> %s' % ('(everything else)', 'main'))
print('')


def bundle_of(path):
    p = norm(path)
    best, name = '', 'main'
    for root in bundles:
        if p == root or p.startswith(root + '/'):
            if len(root) > len(best):
                best, name = root, bundles[root]
    return name


IMP = re.compile(r"""^\s*(?:import|export)[^'"]*from\s+['"](\.[^'"]+)['"]""", re.M)

edges = []
for root, dirs, files in os.walk(ASSETS):
    for f in files:
        if not f.endswith('.ts'):
            continue
        src = os.path.join(root, f)
        b_src = bundle_of(src)
        try:
            text = io.open(src, encoding='utf-8').read()
        except Exception:
            continue
        for spec in IMP.findall(text):
            tgt = os.path.normpath(os.path.join(root, spec))
            cand = [tgt + '.ts', tgt + '.js', os.path.join(tgt, 'index.ts')]
            real = None
            for c in cand:
                if os.path.isfile(c):
                    real = c
                    break
            if real is None:
                continue
            b_tgt = bundle_of(real)
            if b_tgt != b_src:
                edges.append((b_src, norm(src), b_tgt, norm(real)))

print('CROSS-BUNDLE IMPORTS: %d' % len(edges))
fatal = 0
for a, s, b, t in sorted(edges):
    mark = ''
    if a == 'main':
        mark = '   <== FATAL AT BOOT (main loads first)'
        fatal += 1
    print('   [%s] %s' % (a, s))
    print('      -> [%s] %s%s' % (b, t, mark))
print('')
print('fatal (main -> other bundle): %d' % fatal)
