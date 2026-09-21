'use strict';

// Test cho bản Cocos Creator 2.x của minigame-pack. Chạy bằng node thuần:
//
//     node packages/minigame-pack/test.js
//
// Script này di chuyển thư mục và ghi đè game.json/settings — nên mọi đường ghi
// phải có test. Tất cả diễn ra trên build giả dưới os.tmpdir().

const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const SRC = __dirname;
const FIXTURE = path.join(os.tmpdir(), `minigame-pack-2x-test-${process.pid}`);

let pass = 0;
let fail = 0;

function group(name) {
    console.log(`\n${name}`);
}
function check(name, cond, extra) {
    if (cond) {
        pass++;
        console.log(`  ✔ ${name}`);
    } else {
        fail++;
        console.log(`  ✘ ${name}${extra ? `\n      ${extra}` : ''}`);
    }
}

// main.js require('electron') ở top-level.
const electronStub = { shell: {}, dialog: {} };
const realLoad = Module._load;
Module._load = function (request) {
    if (request === 'electron') return electronStub;
    return realLoad.apply(this, arguments);
};

const pack = require('./pack');
const main = require('./main');

// ─── fixture ─────────────────────────────────────────────────────────────────

/**
 * Dựng một thư mục build mini-game giả.
 * @param {'js'|'json'|'none'} settingsKind hình dạng engine settings
 */
function makeBuild(name, settingsKind, opts) {
    const o = opts || {};
    const dir = path.join(FIXTURE, name);
    fs.rmSync(dir, { recursive: true, force: true });
    const mk = (rel, content) => {
        const p = path.join(dir, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, content);
    };

    mk('game.json', JSON.stringify({ deviceOrientation: 'landscape', appid: 'x' }, null, 2));
    mk('game.js', '// entry');
    // bundle chính + internal không bao giờ bị chuyển
    mk('assets/main/config.json', '{}');
    mk('assets/internal/config.json', '{}');
    // bundle cần chuyển xuống subpackage
    mk(`assets/${o.bundle || 'res'}/config.json`, '{}');
    mk(`assets/${o.bundle || 'res'}/${o.entry || 'index.js'}`, '// bundle entry');
    mk(`assets/${o.bundle || 'res'}/import/aa/x.json`, '{}');

    if (settingsKind === 'js') {
        mk('src/settings.js', `window._CCSettings = ${JSON.stringify({ launchScene: 'db://a.fire', subpackages: [] })};`);
    } else if (settingsKind === 'json') {
        mk('src/settings.json', JSON.stringify({ assets: { subpackages: [] } }));
    }
    return dir;
}

// ══ 1. package.json ↔ main.js ════════════════════════════════════════════════

function manifestSuite() {
    group('package.json ↔ main.js · menu item có handler');
    const pkg = JSON.parse(fs.readFileSync(path.join(SRC, 'package.json'), 'utf8'));
    const menu = pkg['main-menu'] || {};
    const handlers = Object.keys(main.messages);

    check('dùng định dạng 2.x (main-menu)', !!pkg['main-menu'] && !pkg.contributions);
    check('KHÔNG khai báo contributions.builder (3.x-only)', !(pkg.contributions && pkg.contributions.builder));
    check('main trỏ tới main.js', pkg.main === 'main.js');

    for (const [label, def] of Object.entries(menu)) {
        const msg = def.message || '';
        const bare = msg.slice(pkg.name.length + 1);
        check(`"${label.split('/').pop()}" → ${msg}`,
            msg.startsWith(`${pkg.name}:`) && handlers.includes(bare),
            `messages thiếu khoá "${bare}"`);
    }
    check('có handler cho builder:build-finished', handlers.includes('builder:build-finished'));
}

// ══ 2. parse engine settings ═════════════════════════════════════════════════

function settingsSuite() {
    group('pack.js · parseSettingsJs');
    const clean = 'window._CCSettings = {"subpackages":["res"],"a":1};';
    check('JSON thuần', pack.parseSettingsJs(clean, 'x').subpackages[0] === 'res');

    const withNewline = 'window._CCSettings = {"subpackages":[]};\n';
    check('có newline cuối', Array.isArray(pack.parseSettingsJs(withNewline, 'x').subpackages));

    const noSemi = 'window._CCSettings = {"subpackages":[]}';
    check('không có dấu chấm phẩy', Array.isArray(pack.parseSettingsJs(noSemi, 'x').subpackages));

    // object literal kiểu JS: key không trích dẫn → JSON.parse hỏng, vm cứu
    const jsLiteral = 'window._CCSettings = {subpackages:["res"],debug:false};';
    check('object literal JS (key không trích dẫn)',
        pack.parseSettingsJs(jsLiteral, 'x').subpackages[0] === 'res');

    let threw = false;
    try {
        pack.parseSettingsJs('var x = 1;', 'x');
    } catch (e) {
        threw = true;
    }
    check('không nhận ra dạng → ném lỗi', threw);

    group('pack.js · readSettings chọn đúng file');
    const jsDir = makeBuild('b-js', 'js');
    check('2.x → src/settings.js', pack.readSettings(jsDir).kind === 'js');
    const jsonDir = makeBuild('b-json', 'json');
    check('3.x → src/settings.json', pack.readSettings(jsonDir).kind === 'json');
    const noneDir = makeBuild('b-none', 'none');
    let threw2 = false;
    try {
        pack.readSettings(noneDir);
    } catch (e) {
        threw2 = true;
    }
    check('không có file nào → ném lỗi rõ ràng', threw2);

    group('pack.js · danh sách subpackage nằm khác chỗ giữa 2 đời');
    const sJs = pack.readSettings(jsDir);
    pack.setSubpackageNames(sJs, ['res']);
    check('2.x ghi vào settings.subpackages', sJs.data.subpackages[0] === 'res');
    check('2.x KHÔNG tạo settings.assets', sJs.data.assets === undefined);

    const sJson = pack.readSettings(jsonDir);
    pack.setSubpackageNames(sJson, ['res']);
    check('3.x ghi vào settings.assets.subpackages', sJson.data.assets.subpackages[0] === 'res');

    group('pack.js · settings.js ghi lại vẫn đọc lại được');
    pack.writeSettings(sJs);
    const reread = pack.readSettings(jsDir);
    check('round-trip giữ nguyên subpackages', reread.data.subpackages[0] === 'res');
    check('round-trip giữ nguyên khoá khác', reread.data.launchScene === 'db://a.fire');
    check('vẫn là dạng window._CCSettings',
        fs.readFileSync(path.join(jsDir, 'src/settings.js'), 'utf8').startsWith('window._CCSettings ='));
}

// ══ 3. đóng gói end-to-end trên build 2.x ════════════════════════════════════

function packSuite() {
    group('pack.js · packSubpackages trên build 2.x');
    const dir = makeBuild('e2e', 'js');
    const r = pack.packSubpackages(dir);

    check('nhận ra engine settings kiểu 2.x', r.settingsKind === 'js');
    check('đã chuyển bundle "res"', r.moved.includes('res'), r.moved.join(','));
    check('assets/res/ không còn', !fs.existsSync(path.join(dir, 'assets/res')));
    check('subpackages/res/ đã có', fs.existsSync(path.join(dir, 'subpackages/res')));
    check('index.js đổi tên thành game.js', fs.existsSync(path.join(dir, 'subpackages/res/game.js')));
    check('index.js cũ đã đi', !fs.existsSync(path.join(dir, 'subpackages/res/index.js')));
    check('nội dung bundle theo cùng', fs.existsSync(path.join(dir, 'subpackages/res/import/aa/x.json')));

    check('assets/main/ KHÔNG bị chuyển', fs.existsSync(path.join(dir, 'assets/main/config.json')));
    check('assets/internal/ KHÔNG bị chuyển', fs.existsSync(path.join(dir, 'assets/internal/config.json')));

    const game = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8'));
    check('game.json khai báo subpackage', game.subpackages && game.subpackages[0].name === 'res');
    check('root đúng dạng subpackages/res/', game.subpackages[0].root === 'subpackages/res/');
    check('giữ nguyên khoá cũ trong game.json', game.appid === 'x');

    const st = pack.readSettings(dir);
    check('settings.js được cập nhật', st.data.subpackages.includes('res'));
    check('settings.js giữ khoá khác', st.data.launchScene === 'db://a.fire');

    group('pack.js · forcePortrait chạy SAU pack thì không mất subpackages');
    pack.forcePortrait(dir);
    const game2 = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8'));
    check('deviceOrientation = portrait', game2.deviceOrientation === 'portrait');
    check('subpackages còn nguyên', game2.subpackages && game2.subpackages[0].name === 'res');

    group('pack.js · idempotent');
    const r2 = pack.packSubpackages(dir);
    check('lần 2 không chuyển gì', r2.moved.length === 0);
    // Không truyền tên bundle → danh sách ứng viên lấy từ assets/, mà res đã rời
    // khỏi đó, nên nó không còn là ứng viên. Không có gì để chuyển, cũng không
    // có gì để "bỏ qua".
    check('lần 2 không có ứng viên nào', r2.skipped.length === 0, JSON.stringify(r2.skipped));
    // Còn khi gọi đích danh thì phải nói rõ vì sao bỏ qua.
    const r2b = pack.packSubpackages(dir, ['res']);
    check('gọi đích danh res → báo đã là subpackage', r2b.skipped.length === 1 && /đã là subpackage/.test(r2b.skipped[0]),
        JSON.stringify(r2b.skipped));
    check('subpackages/res/ vẫn còn', fs.existsSync(path.join(dir, 'subpackages/res/game.js')));
    const st2 = pack.readSettings(dir);
    check('không nhân đôi tên trong settings',
        st2.data.subpackages.filter((n) => n === 'res').length === 1);

    group('pack.js · entry có md5 (index.<hash>.js)');
    const dirMd5 = makeBuild('md5', 'js', { entry: 'index.a1b2c3d4.js' });
    pack.packSubpackages(dirMd5);
    check('đổi thành game.a1b2c3d4.js',
        fs.existsSync(path.join(dirMd5, 'subpackages/res/game.a1b2c3d4.js')));

    group('pack.js · từ chối an toàn');
    const noGame = path.join(FIXTURE, 'nogame');
    fs.mkdirSync(noGame, { recursive: true });
    let t1 = false;
    try {
        pack.packSubpackages(noGame);
    } catch (e) {
        t1 = /game\.json/.test(e.message);
    }
    check('thiếu game.json → lỗi nói rõ', t1);

    // Quan trọng: settings hỏng thì phải dừng TRƯỚC khi di chuyển file, không
    // được để build ở trạng thái nửa vời.
    const noSettings = makeBuild('nosettings', 'none');
    let t2 = false;
    try {
        pack.packSubpackages(noSettings);
    } catch (e) {
        t2 = /settings/.test(e.message);
    }
    check('thiếu settings → lỗi nói rõ', t2);
    check('KHÔNG di chuyển file nào khi settings hỏng',
        fs.existsSync(path.join(noSettings, 'assets/res/config.json'))
        && !fs.existsSync(path.join(noSettings, 'subpackages')));

    group('pack.js · build 3.x vẫn chạy được bằng file này');
    const d3 = makeBuild('e2e3', 'json');
    const r3 = pack.packSubpackages(d3);
    check('nhận ra settings 3.x', r3.settingsKind === 'json');
    check('chuyển được bundle', r3.moved.includes('res'));
    const s3 = pack.readSettings(d3);
    check('ghi vào assets.subpackages', s3.data.assets.subpackages.includes('res'));
}

// ══ 4. main.js · dò thư mục build từ event ═══════════════════════════════════

function mainSuite() {
    const { resolveBuildDir, platformOf } = main._internal;
    const dir = makeBuild('evt', 'js');

    group('main.js · resolveBuildDir dò nhiều hình dạng payload');
    check('payload.dest', resolveBuildDir({ dest: dir }) === dir);
    check('payload.buildPath', resolveBuildDir({ buildPath: dir }) === dir);
    check('payload.paths.buildDir', resolveBuildDir({ paths: { buildDir: dir } }) === dir);
    check('payload.options.buildPath', resolveBuildDir({ options: { buildPath: dir } }) === dir);
    check('payload.result.dest', resolveBuildDir({ result: { dest: dir } }) === dir);
    check('đường dẫn không có game.json → null',
        resolveBuildDir({ dest: path.join(FIXTURE, 'khong-ton-tai') }) === null);
    check('payload rỗng → null', resolveBuildDir(null) === null);

    group('main.js · platformOf');
    check('payload.platform', platformOf({ platform: 'wechatgame' }) === 'wechatgame');
    check('payload.options.platform', platformOf({ options: { platform: 'wechatgame' } }) === 'wechatgame');
    check('không rõ → null', platformOf({}) === null);

    group('main.js · id nền tảng Douyin đúng chuẩn');
    check("dùng 'bytedance-mini-game'", main._internal.MINIGAME_PLATFORMS.includes('bytedance-mini-game'));
    check("KHÔNG dùng 'bytedance'", !main._internal.MINIGAME_PLATFORMS.includes('bytedance'));

    group('main.js · build-finished bỏ qua nền tảng không phải mini-game');
    const web = makeBuild('web', 'js');
    main.messages['builder:build-finished'](null, { platform: 'web-mobile', dest: web });
    check('web-mobile: không đóng gói', fs.existsSync(path.join(web, 'assets/res/config.json')));
    check('web-mobile: không tạo subpackages', !fs.existsSync(path.join(web, 'subpackages')));

    group('main.js · build-finished đóng gói build mini-game');
    const wg = makeBuild('wg', 'js');
    main.messages['builder:build-finished'](null, { platform: 'wechatgame', dest: wg });
    check('wechatgame: đã đóng gói', fs.existsSync(path.join(wg, 'subpackages/res/game.js')));
}

// ─── chạy ────────────────────────────────────────────────────────────────────

fs.rmSync(FIXTURE, { recursive: true, force: true });
fs.mkdirSync(FIXTURE, { recursive: true });

manifestSuite();
settingsSuite();
packSuite();
mainSuite();

fs.rmSync(FIXTURE, { recursive: true, force: true });
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
