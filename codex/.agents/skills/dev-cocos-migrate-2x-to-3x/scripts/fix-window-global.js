// Replace every bare `window` identifier with `globalThis`.
//
// PORT-CONVENTIONS told every wave to write `const w = window as any;` at module scope.
// That is fine in a browser and FATAL in a mini-game: the TikTok/ByteDance runtime has
// no `window` binding, so the module throws ReferenceError while being evaluated and
// the engine reports "Unable to instantiate chunks:///_virtual/<file>.ts". Because the
// mocks sit at the head of the boot chain, the whole game fails to start on device.
//
// `globalThis` is standard ES2020 and present in every JS runtime, browsers included.
// Property reads like `w.window` or the string 'window' are left alone.
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
const APPLY = process.argv[3] === '--apply';

function walk(d, out = []) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.ts')) out.push(p);
    }
    return out;
}

// a bare `window` is one not preceded by `.` or a word char, and not inside quotes
const BARE = /(^|[^.\w$'"`])window\b/g;

let changedFiles = 0, changedSites = 0;
const report = [];

for (const f of walk(ROOT)) {
    const src = fs.readFileSync(f, 'utf8');
    const lines = src.split('\n');
    let hits = 0;

    const out = lines.map((line) => {
        // skip pure comment lines so the explanations keep saying "window"
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return line;
        return line.replace(BARE, (m, pre) => {
            // leave string literals like 'window' alone
            hits++;
            return pre + 'globalThis';
        });
    });

    if (hits) {
        changedFiles++;
        changedSites += hits;
        report.push('  ' + String(hits).padStart(3) + '  ' + path.relative(ROOT, f).replace(/\\/g, '/'));
        if (APPLY) fs.writeFileSync(f, out.join('\n'));
    }
}

console.log((APPLY ? 'APPLIED' : 'DRY RUN') + ': ' + changedSites + ' sites in ' + changedFiles + ' files');
report.forEach((r) => console.log(r));
