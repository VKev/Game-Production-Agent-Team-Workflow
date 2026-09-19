// ApiMock.js (Cocos Creator 2.4.x) — replay recorded API responses.
//
// Why: the mirrored game has no backend. Every request must answer from the
// fixtures captured by research-browser-game-mirror, or the game stalls on a pending promise.
//
// Setup:
//   1. Copy <mirror>/api-mock/client/api-mock-client.js into assets/Script/vendor/.
//   2. Copy <mirror>/api-mock/index.inline.json into
//      assets/resources/apimock/index.inline.json (inline bodies = no URL needed).
//   3. Attach this component to a node in the FIRST scene and give it the
//      lowest script execution order, so it installs before any game request.

require("api-mock-client"); // side effect: defines window.__installApiMock

var ApiMock = {
    installed: false,

    // Call from the boot scene. done() runs after the fixtures are live.
    install: function (done) {
        if (this.installed) {
            if (done) done(null);
            return;
        }
        var self = this;
        cc.loader.loadRes("apimock/index.inline", cc.JsonAsset, function (err, asset) {
            if (err) {
                cc.error("[ApiMock] fixtures missing:", err);
                if (done) done(err);
                return;
            }
            window.__installApiMock({ index: asset.json });
            self.installed = true;
            cc.log("[ApiMock] installed:", (asset.json.entries || []).length, "fixtures");
            if (done) done(null);
        });
    },
};

cc.Class({
    extends: cc.Component,

    onLoad: function () {
        // Runs before other scripts only if this node's execution order is lowest.
        ApiMock.install();
        cc.game.addPersistRootNode(this.node);
    },
});

module.exports = ApiMock;
