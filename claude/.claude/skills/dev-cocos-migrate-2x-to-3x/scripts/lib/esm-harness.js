// Shared plumbing for the boot-order tests.
//
// Both tests answer the same kind of question: "in what order does this module graph
// actually evaluate, and does anything blow up on the way?" Neither `tsc --noEmit`
// nor the editor's diagnostics can answer it — the code compiles identically whether
// the order is right or wrong.
//
// The graphs under test import nothing from 'cc', so Node can evaluate the very
// modules the bundler emits. It has to run as real ESM: CommonJS require() evaluates
// in source position and would paper over exactly the bug being tested.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = path.resolve(__dirname, '..', '..', '..');
const TSC = path.join(PROJECT, 'node_modules', 'typescript', 'bin', 'tsc');

/**
 * Compile the given project-relative .ts files to ESM in a fresh temp dir.
 * Returns the directory; the caller is responsible for removing it.
 */
function compileToEsm(relativeFiles) {
    if (!fs.existsSync(TSC)) {
        console.error('typescript is not installed in this project — run: npm install --save-dev typescript');
        process.exit(2);
    }

    const files = relativeFiles.map((f) => path.join(PROJECT, f));
    const missing = files.filter((f) => !fs.existsSync(f));
    if (missing.length) {
        console.error('missing source file(s):\n  ' + missing.join('\n  '));
        process.exit(2);
    }

    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bootorder-'));
    execFileSync(
        process.execPath,
        [TSC, ...files, '--module', 'es2022', '--target', 'es2020', '--outDir', out, '--skipLibCheck'],
        { stdio: 'inherit' },
    );

    // tsc emits extensionless relative imports; Node's ESM resolver needs them.
    (function addExtensions(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, entry.name);
            if (entry.isDirectory()) { addExtensions(p); continue; }
            if (!entry.name.endsWith('.js')) continue;
            fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/(from\s+['"]\.{1,2}\/[A-Za-z0-9_/]+)(['"])/g, '$1.js$2'));
        }
    })(out);

    fs.writeFileSync(path.join(out, 'package.json'), JSON.stringify({ type: 'module' }));
    return out;
}

/** Write `source` into the compiled dir and run it as ESM. Returns its exit code. */
function runHarness(outDir, source) {
    const file = path.join(outDir, '__harness.mjs');
    fs.writeFileSync(file, source);
    try {
        execFileSync(process.execPath, [file], { stdio: 'inherit' });
        return 0;
    } catch (e) {
        return e.status || 1;
    }
}

module.exports = { PROJECT, compileToEsm, runHarness };
