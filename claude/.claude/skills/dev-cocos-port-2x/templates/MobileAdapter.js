// MobileAdapter.js (Cocos Creator 2.4.x) — Android/iOS browser + WebView fixes.
//
// Attach to a node in the first scene. Fixes, in order of how often they bite:
//   1. Wrong resolution policy: a portrait build on a wide screen blows the UI up.
//   2. iOS audio: WebAudio stays suspended until the first real touch.
//   3. Notch/safe area: HUD hides under the status bar on iPhone and most Androids.
//   4. Page scroll/zoom stealing touches from the canvas.

cc.Class({
    extends: cc.Component,

    properties: {
        designWidth: 720,
        designHeight: 1280,
        // Nodes to push below the notch. Leave empty if the HUD already fits.
        safeAreaTargets: { default: [], type: cc.Node },
    },

    onLoad: function () {
        this._applyResolutionPolicy();
        this._unlockAudioOnFirstTouch();
        this._applySafeArea();
        this._blockPageGestures();
        cc.macro.ENABLE_MULTI_TOUCH = true;
        cc.game.addPersistRootNode(this.node);
    },

    // Keep the design ratio: fit width on tall screens, fit height on wide ones.
    _applyResolutionPolicy: function () {
        var self = this;
        var apply = function () {
            var frame = cc.view.getFrameSize();
            var designRatio = self.designWidth / self.designHeight;
            var screenRatio = frame.width / frame.height;
            var policy = screenRatio < designRatio
                ? cc.ResolutionPolicy.FIXED_WIDTH   // taller than design: crop height
                : cc.ResolutionPolicy.FIXED_HEIGHT; // wider than design: crop width
            cc.view.setDesignResolutionSize(self.designWidth, self.designHeight, policy);
        };
        apply();
        cc.view.setResizeCallback(apply); // orientation change, browser chrome hiding
    },

    // iOS refuses to start audio outside a user gesture; 2.x does not retry.
    _unlockAudioOnFirstTouch: function () {
        if (!cc.sys.isMobile) return;
        var unlock = function () {
            var id = cc.audioEngine.play(null, false, 0); // no-op play to resume context
            cc.audioEngine.stop(id);
            cc.game.canvas.removeEventListener("touchend", unlock);
        };
        cc.game.canvas.addEventListener("touchend", unlock, { once: true });
    },

    // Push HUD nodes below the notch. getSafeAreaRect exists from 2.4.
    _applySafeArea: function () {
        if (!cc.sys.getSafeAreaRect || !this.safeAreaTargets.length) return;
        var safe = cc.sys.getSafeAreaRect();
        var visible = cc.view.getVisibleSize();
        var topInset = visible.height / 2 - (safe.y + safe.height);
        if (topInset <= 0) return;
        this.safeAreaTargets.forEach(function (node) {
            node.y -= topInset;
        });
    },

    // Stop the page from scrolling/zooming while the player drags on the canvas.
    _blockPageGestures: function () {
        if (!cc.sys.isBrowser) return;
        var canvas = cc.game.canvas;
        canvas.addEventListener("touchmove", function (event) { event.preventDefault(); },
            { passive: false });
        document.addEventListener("gesturestart", function (event) { event.preventDefault(); });
    },
});
