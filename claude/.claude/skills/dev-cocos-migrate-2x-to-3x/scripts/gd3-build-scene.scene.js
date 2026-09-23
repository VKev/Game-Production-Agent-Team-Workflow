// Runs INSIDE the Cocos 3.8 editor SCENE context (execute_javascript, context "scene").
// Rebuilds one scene from .migration/dump/<Name>.json into the currently open scene.
// The caller creates and opens the empty scene first, and saves it afterwards.
//
// Contract: evaluated with (cc, Editor, args) in scope; returns a report object.
// args = { projectRoot, dumpName: "Game" | "Temp" }.
//
// Canvas and Camera are built here with 3.x semantics rather than copied from the 2.x
// dump, because the fields that carried their behaviour in 2.4 are gone:
//   - cc.Canvas._designResolution / _fitWidth / _fitHeight moved to project settings
//     and view.setDesignResolutionSize (PORT-CONVENTIONS trap 12).
//   - cc.Camera._depth became priority, _backgroundColor became clearColor, and a 2D
//     camera needs z=1000 with near=1/far=1000 to actually see content sitting at z=0.
//
// Layers are the reason this file exists. Creator's own scene-2d template puts the
// Canvas subtree on UI_2D (1 << 25) and gives the camera visibility
// DEFAULT | UI_2D | IGNORE_RAYCAST. A node left on the cc.Node default layer (DEFAULT,
// 1 << 30) is culled by that camera and simply never drawn — no error, no warning, and
// validate_scene stays green.

const fs = require('fs');
const path = require('path');

const UI_2D = cc.Layers.Enum.UI_2D;
const DEFAULT_LAYER = cc.Layers.Enum.DEFAULT;
const CAMERA_VISIBILITY = DEFAULT_LAYER | UI_2D | cc.Layers.Enum.IGNORE_RAYCAST; // 1108344832

const ROOT = args.projectRoot;
const dump = JSON.parse(fs.readFileSync(path.join(ROOT, '.migration', 'dump', args.dumpName + '.json'), 'utf8'));
const out = { scene: args.dumpName, warnings: [], built: [], wired: [] };

const sceneRootSpec = dump.roots.find((r) => r.scene);
if (!sceneRootSpec) throw new Error(args.dumpName + '.json has no scene root');
const canvasSpec = sceneRootSpec.scene.children.find((c) => c.components.some((x) => x.type === 'cc.Canvas'));
if (!canvasSpec) throw new Error(args.dumpName + '.json has no node carrying cc.Canvas');

const scene = cc.director.getScene();

// --- Canvas ------------------------------------------------------------------
const canvas = new cc.Node(canvasSpec.name);
canvas.layer = UI_2D;
scene.addChild(canvas);
canvas.setPosition(canvasSpec.position[0], canvasSpec.position[1], canvasSpec.position[2]);
const canvasUi = canvas.addComponent(cc.UITransform);
if (canvasSpec.contentSize) canvasUi.setContentSize(canvasSpec.contentSize[0], canvasSpec.contentSize[1]);
if (canvasSpec.anchorPoint) canvasUi.setAnchorPoint(canvasSpec.anchorPoint[0], canvasSpec.anchorPoint[1]);
const canvasComp = canvas.addComponent(cc.Canvas);
canvasComp.alignCanvasWithScreen = true;

// --- Camera ------------------------------------------------------------------
const cameraSpec = canvasSpec.children.find((c) => c.components.some((x) => x.type === 'cc.Camera'));
const cameraProps = cameraSpec ? (cameraSpec.components.find((x) => x.type === 'cc.Camera').props || {}) : {};
const cameraNode = new cc.Node(cameraSpec ? cameraSpec.name : 'Main Camera');
cameraNode.layer = DEFAULT_LAYER;
canvas.addChild(cameraNode);
cameraNode.setPosition(0, 0, 1000);
const camera = cameraNode.addComponent(cc.Camera);
camera.projection = 0; // ORTHO
camera.orthoHeight = (canvasSpec.contentSize ? canvasSpec.contentSize[1] : 1334) / 2;
camera.near = 1;
camera.far = 1000;
camera.priority = 0;
camera.visibility = CAMERA_VISIBILITY;
if (typeof cameraProps._clearFlags === 'number') camera.clearFlags = cameraProps._clearFlags;
const bg = cameraProps._backgroundColor && cameraProps._backgroundColor.$color;
if (bg) camera.clearColor = new cc.Color(bg.r, bg.g, bg.b, bg.a);
canvasComp.cameraComponent = camera;
out.built.push('Canvas + ' + cameraNode.name + ' (visibility ' + CAMERA_VISIBILITY + ')');

// --- the rest of the Canvas subtree, through the shared builder ---------------
const subtreePaths = canvasSpec.children.filter((c) => c !== cameraSpec).map((c) => c.path);
if (subtreePaths.length) {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const buildTree = new AsyncFunction('cc', 'Editor', 'args', fs.readFileSync(path.join(ROOT, '.migration', 'tools', 'build-prefab.scene.js'), 'utf8'));
    const report = await buildTree(cc, Editor, {
        dumpFile: path.join(ROOT, '.migration', 'dump', args.dumpName + '.json'),
        subtreePaths: subtreePaths,
        parentUuid: canvas.uuid,
    });
    for (const w of report.warnings) out.warnings.push(w);
    if (report.assetsFailed.length) out.warnings.push('assetsFailed: ' + report.assetsFailed.join(' | '));
    out.built.push(subtreePaths.join(', ') + ' (' + report.deferredRefs + ' deferred refs)');
}

// --- Canvas-level components the builder deliberately skipped -----------------
// Resolve a dump path ("New Node/Canvas/Item/Area") against the tree just built.
function nodeAtDumpPath(p) {
    const parts = String(p).split('/').slice(2); // drop "<scene root>/Canvas"
    let n = canvas;
    for (const part of parts) {
        const hits = n.children.filter((c) => c.name === part);
        if (hits.length === 0) return null;
        if (hits.length > 1) out.warnings.push('ambiguous path segment "' + part + '" in ' + p + ' (' + hits.length + ' siblings) — took the first');
        n = hits[0];
    }
    return n;
}

for (const c of canvasSpec.components) {
    if (c.type === 'cc.Canvas' || c.type === 'cc.Camera') continue;
    const p = c.props || {};
    try {
        if (c.type === 'cc.Widget') {
            const w = canvas.addComponent(cc.Widget);
            if (typeof p._alignFlags === 'number') w.alignFlags = p._alignFlags;
            if (typeof p.alignMode === 'number') w.alignMode = p.alignMode;
            if (typeof p._top === 'number') w.top = p._top;
            if (typeof p._bottom === 'number') w.bottom = p._bottom;
            if (typeof p._left === 'number') w.left = p._left;
            if (typeof p._right === 'number') w.right = p._right;
            out.built.push('Canvas cc.Widget alignFlags=' + p._alignFlags);
            continue;
        }
        if (c.kind !== 'script') { out.warnings.push('UNHANDLED Canvas component ' + c.type); continue; }

        const Ctor = cc.js.getClassByName(c.scriptClassName);
        if (!Ctor) { out.warnings.push('script class not registered: ' + c.scriptClassName); continue; }
        const comp = canvas.addComponent(Ctor);
        for (const [k, v] of Object.entries(p)) {
            if (v && v.$nodePath) {
                const target = nodeAtDumpPath(v.$nodePath);
                if (target) { comp[k] = target; out.wired.push(c.scriptClassName + '.' + k + ' -> ' + v.$nodePath); }
                else out.warnings.push('node ref ' + v.$nodePath + ' not found for ' + c.scriptClassName + '.' + k);
                continue;
            }
            if (v && typeof v === 'object') continue;
            try { comp[k] = v; } catch (e) { out.warnings.push('set ' + c.scriptClassName + '.' + k + ' failed: ' + String(e).slice(0, 80)); }
        }
        out.built.push('Canvas script ' + c.scriptClassName);
    } catch (e) {
        out.warnings.push('Canvas component ' + (c.scriptClassName || c.type) + ' threw: ' + String(e).slice(0, 160));
    }
}

// --- the assertion this whole rebuild is for ---------------------------------
let wrongLayer = [];
(function walk(n) {
    if (n !== cameraNode && n.layer !== UI_2D) wrongLayer.push(n.name);
    n.children.forEach(walk);
})(canvas);
out.nodesTotal = (function count(n) { return 1 + n.children.reduce((a, c) => a + count(c), 0); })(canvas);
out.layerOk = wrongLayer.length === 0;
if (!out.layerOk) out.warnings.push('NOT on UI_2D: ' + wrongLayer.join(', '));

return out;
