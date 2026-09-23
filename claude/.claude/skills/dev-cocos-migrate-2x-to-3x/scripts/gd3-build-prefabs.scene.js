// Runs INSIDE the Cocos 3.8 editor SCENE context (execute_javascript, context "scene").
// Rebuilds prefabs from .migration/dump/<Name>.json — build the node tree in the open
// scratch scene, turn it into a prefab asset, drop the node again.
//
// Contract: evaluated with (cc, Editor, args) in scope; returns a report object.
// args = { projectRoot, names: ["Main", "Level", ...], prefabDir?: "db://assets/local/prefab" }.
//
// Why a script and not one MCP call per prefab: 13 prefabs x 443 nodes, and every
// execution-tool call costs the user an approval.
//
// Two traps this script exists to avoid, both paid for once already:
//   1. The MCP tool `create_prefab_from_node` serialises the tree but never emits
//      cc.PrefabInfo, so _prefab is null on every node and the editor logs
//      "open prefab failed TypeError: Cannot read properties of null (reading instance)"
//      after every save. The editor's own drag-node-into-Assets path is
//      cce.Prefab.createPrefabAssetFromNode, and validate_prefab_references does NOT
//      catch the difference — it only checks references, and there are none to break.
//   2. That API takes a uuid STRING. Hand it the node object and it returns null and
//      writes nothing at all, without throwing.
//
// Known, accepted drift: createPrefabAssetFromNode renames the root node after the file.
// Only Tips is affected (2.x root is "Node Tips"); no code looks that name up.

const fs = require('fs');
const path = require('path');

const ROOT = args.projectRoot;
const PREFAB_DIR = args.prefabDir || 'db://assets/local/prefab';
const BUILDER = path.join(ROOT, '.migration', 'tools', 'build-prefab.scene.js');
const DUMP_DIR = path.join(ROOT, '.migration', 'dump');

// The builder uses top-level await, so it has to be an AsyncFunction, not a Function.
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const buildTree = new AsyncFunction('cc', 'Editor', 'args', fs.readFileSync(BUILDER, 'utf8'));

const out = { created: [], failed: [], warnings: [], layerChecked: [] };

// Drop whatever this iteration added to the scene root. Deliberately NOT a lookup by
// the uuid the builder reported: createPrefabAssetFromNode replaces the node with a
// prefab instance carrying a NEW uuid, so the old one finds nothing and the root is
// left behind — which then keeps the scratch scene permanently dirty and silently
// blocks the next open_scene.
function dropAddedRoots(before) {
    const scene = cc.director.getScene();
    let dropped = 0;
    for (const child of scene.children.slice()) {
        if (before.has(child)) continue;
        child.parent = null;
        child.destroy();
        dropped++;
    }
    return dropped;
}

for (const name of args.names) {
    const before = new Set(cc.director.getScene().children);
    try {
        const report = await buildTree(cc, Editor, { dumpFile: path.join(DUMP_DIR, name + '.json'), prefabRefs: args.prefabRefs });
        for (const w of report.warnings) out.warnings.push(name + ': ' + w);
        if (report.assetsFailed.length) out.warnings.push(name + ': assetsFailed ' + report.assetsFailed.join(' | '));

        const built = report.built[report.built.length - 1];
        if (!built) { out.failed.push(name + ': builder returned no root'); continue; }

        // Guard the whole point of this rebuild: a DEFAULT-layer node is culled by the
        // UI camera with no error anywhere, so assert before writing the asset.
        const scene = cc.director.getScene();
        const find = (n) => { if (n.uuid === built.uuid) return n; for (const c of n.children) { const f = find(c); if (f) return f; } return null; };
        const rootNode = find(scene);
        let wrongLayer = 0;
        const walk = (n) => { if (n.layer !== cc.Layers.Enum.UI_2D) wrongLayer++; n.children.forEach(walk); };
        if (rootNode) walk(rootNode);
        if (wrongLayer) { out.failed.push(name + ': ' + wrongLayer + ' node(s) not on UI_2D — asset NOT written'); dropAddedRoots(before); continue; }
        out.layerChecked.push(name + ': ' + built.nodes + ' nodes on UI_2D');

        // uuid STRING, never the node object.
        const asset = await cce.Prefab.createPrefabAssetFromNode(String(built.uuid), PREFAB_DIR + '/' + name + '.prefab');
        if (!asset) { out.failed.push(name + ': createPrefabAssetFromNode returned null (wrote nothing)'); dropAddedRoots(before); continue; }

        out.created.push({ name: name, nodes: built.nodes, uuid: asset.uuid || String(asset), deferredRefs: report.deferredRefs });
        out.cleaned = (out.cleaned || 0) + dropAddedRoots(before);
    } catch (e) {
        out.failed.push(name + ': ' + String(e && e.stack ? e.stack : e).slice(0, 300));
        dropAddedRoots(before);
    }
}

// The scratch scene must end empty. A leftover root keeps it dirty, and a dirty scene
// makes the editor ignore the next open_scene while open_scene still reports success.
out.sceneChildrenLeft = cc.director.getScene().children.length;

return out;
