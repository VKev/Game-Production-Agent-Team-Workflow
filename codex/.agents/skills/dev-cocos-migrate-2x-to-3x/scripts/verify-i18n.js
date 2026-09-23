// Every user-facing Vietnamese string must have a translation entry.
//
//   node .migration/tools/verify-i18n.js
//
// Two sources feed the UI and both have to be covered, or switching language leaves
// half the screen in Vietnamese:
//   1. code — tips.show(...) and Label assignments, wrapped as I18n.t("...");
//   2. prefabs/scenes — Label._string authored into the asset, translated at runtime
//      by I18n.localizeTree() at each instantiate site and by the LocalizeLabels
//      component on Game.scene's Canvas.
//
// Code literals carry JS escapes ("v\xe0ng") while prefabs hold decoded text; the
// runtime sees the decoded form in both cases, so keys are compared decoded. Getting
// that wrong makes half the lookups miss silently.
//
// Diagnostics such as "[popup] không nạp được ..." go to the console, not the screen,
// and are deliberately NOT required to be translated.
const fs = require('fs');
const path = require('path');

const VIET = /[À-ɏḀ-ỿ]/;
const I18N_DIR = 'assets/local/i18n';

const decode = (s) => s.replace(
    /\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})/g,
    (m, u, x) => String.fromCharCode(parseInt(u || x, 16)),
);

const vi = JSON.parse(fs.readFileSync(path.join(I18N_DIR, 'vi.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(I18N_DIR, 'en.json'), 'utf8'));

const rows = [];
let missing = 0;

// --- 1. strings the code routes through I18n.t(...) ---------------------------
const wrapped = new Set();
const walkTs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walkTs(p);
    if (!e.name.endsWith('.ts')) return;
    const src = fs.readFileSync(p, 'utf8');
    const re = /I18n\.t\("((?:[^"\\]|\\.)*)"\)/g;
    let m;
    while ((m = re.exec(src))) wrapped.add(decode(m[1]));
});
['assets/game', 'assets/framework', 'assets/scripts'].filter(fs.existsSync).forEach(walkTs);

for (const s of wrapped) {
    if (vi[s] === undefined) { missing++; rows.push(['MISSING-VI', 'code', s]); }
    else if (en[s] === undefined) { missing++; rows.push(['MISSING-EN', 'code', s]); }
}

// --- 2. Vietnamese Labels authored in prefabs and scenes ----------------------
const assets = [];
const collect = (dir, ext) => fs.existsSync(dir) && fs.readdirSync(dir)
    .filter((f) => f.endsWith(ext)).forEach((f) => assets.push(path.join(dir, f)));
collect('assets/local/prefab', '.prefab');
collect('assets/page', '.scene');
collect('assets/temp', '.scene');

const authored = new Set();
for (const f of assets) {
    for (const o of JSON.parse(fs.readFileSync(f, 'utf8'))) {
        if (o && o.__type__ === 'cc.Label' && o._string && VIET.test(o._string)) authored.add(o._string);
    }
}
for (const s of authored) {
    if (vi[s] === undefined) { missing++; rows.push(['MISSING-VI', 'asset', s]); }
    else if (en[s] === undefined) { missing++; rows.push(['MISSING-EN', 'asset', s]); }
}

// --- 3. the English table has to actually be English --------------------------
// An entry equal to its Vietnamese key means nobody translated it; the lookup would
// "work" and the screen would stay Vietnamese, which is the failure this catches.
const identical = Object.keys(en).filter((k) => en[k] === k);

for (const [kind, where, s] of rows) console.log('  ' + kind + '  (' + where + ')  ' + JSON.stringify(s));
console.log('');
console.log('table entries (vi/en)             : ' + Object.keys(vi).length + ' / ' + Object.keys(en).length);
console.log('strings wrapped in code           : ' + wrapped.size);
console.log('Vietnamese Labels in prefabs      : ' + authored.size);
console.log('missing translations              : ' + missing);
console.log('en entries identical to Vietnamese: ' + identical.length + (identical.length ? '  <-- untranslated' : ''));
process.exit(missing === 0 && identical.length === 0 ? 0 : 1);
