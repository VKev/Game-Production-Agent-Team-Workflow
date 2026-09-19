// MobileAdapter.ts (Cocos Creator 3.8.x) — Android/iOS browser + WebView fixes.
//
// Put this on a node in the first scene. Fixes, in order of how often they bite:
//   1. Wrong resolution policy: a portrait build on a wide screen blows the UI up.
//   2. iOS audio: the WebAudio context stays suspended until a real touch.
//   3. Notch/safe area: HUD hides under the status bar.
//   4. Page scroll/zoom stealing touches from the canvas.
//
// For 3.x the built-in SafeArea component is the better fix for HUD layout —
// use it on Widget-anchored nodes and keep this class for the rest.

import { _decorator, Component, view, screen, sys, macro, director, ResolutionPolicy, Node } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('MobileAdapter')
export class MobileAdapter extends Component {
    @property
    designWidth = 720;

    @property
    designHeight = 1280;

    @property({ type: [Node], tooltip: 'Nodes to push below the notch' })
    safeAreaTargets: Node[] = [];

    onLoad() {
        macro.ENABLE_MULTI_TOUCH = true;
        director.addPersistRootNode(this.node);
        this.applyResolutionPolicy();
        this.unlockAudioOnFirstTouch();
        this.applySafeArea();
        this.blockPageGestures();
        screen.on('window-resize', this.applyResolutionPolicy, this);
    }

    onDestroy() {
        screen.off('window-resize', this.applyResolutionPolicy, this);
    }

    /** Keep the design ratio: fit width on tall screens, fit height on wide ones. */
    applyResolutionPolicy() {
        const size = screen.windowSize;
        const designRatio = this.designWidth / this.designHeight;
        const screenRatio = size.width / size.height;
        const policy = screenRatio < designRatio
            ? ResolutionPolicy.FIXED_WIDTH   // taller than design: crop height
            : ResolutionPolicy.FIXED_HEIGHT; // wider than design: crop width
        view.setDesignResolutionSize(this.designWidth, this.designHeight, policy);
    }

    /** iOS keeps audio suspended until a gesture; resume on the first touch. */
    unlockAudioOnFirstTouch() {
        if (!sys.isMobile || !sys.isBrowser) return;
        const resume = () => {
            const ctx = (globalThis as any).__audioContext
                || (globalThis as any).AudioContext && (globalThis as any).audioContext;
            if (ctx?.state === 'suspended') ctx.resume();
            document.removeEventListener('touchend', resume);
        };
        document.addEventListener('touchend', resume, { once: true });
    }

    /** Manual notch offset. Prefer the built-in SafeArea component when possible. */
    applySafeArea() {
        if (!this.safeAreaTargets.length) return;
        const safe = sys.getSafeAreaRect();
        const visible = view.getVisibleSize();
        const topInset = visible.height / 2 - (safe.y + safe.height);
        if (topInset <= 0) return;
        for (const node of this.safeAreaTargets) {
            const position = node.position;
            node.setPosition(position.x, position.y - topInset, position.z);
        }
    }

    /** Stop the page from scrolling/zooming while the player drags on the canvas. */
    blockPageGestures() {
        if (!sys.isBrowser) return;
        const canvas = document.getElementById('GameCanvas');
        canvas?.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
        document.addEventListener('gesturestart', (event) => event.preventDefault());
    }
}
