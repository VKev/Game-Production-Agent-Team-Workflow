// MockAdOverlay.ts (Cocos Creator 3.8.x) — a visible stand-in for a rewarded video.
//
// Why: an instant fake reward hides WHERE the game shows ads, and it makes the
// reward loop feel nothing like the shipped game. This overlay is a full-screen
// black layer that swallows input, counts down for a few seconds, then reports the
// ad as fully watched (always rewards).
//
// Built from engine nodes (Graphics + Label + BlockInputEvents), never DOM, so it
// also runs on native mini-game runtimes (TikTok bytedance-mini-game, WeChat) where
// there is no document.
//
// Usage: route the game's ONE central "show rewarded ad" function here while no real
// ad unit is configured:
//
//   if (!realAdAvailable()) {
//       MockAdOverlay.show(() => grantReward());
//       return;
//   }
//
// Mute music around it in the caller, the same as for a real ad.

import { BlockInputEvents, Canvas, Color, director, Graphics, Label, Node, UITransform, view } from 'cc';

export class MockAdOverlay {
    private static node: Node = null;

    /**
     * Show the overlay; onDone fires once the countdown ends.
     * @param seconds countdown length (default 3)
     * @param title text above the countdown; pass a translated string if the game is localized
     */
    static show(onDone: () => void, seconds = 3, title = 'AD'): void {
        if (MockAdOverlay.node) return; // one ad at a time: a double tap must not reward twice
        const scene = director.getScene();
        const canvas = scene && scene.getComponentInChildren(Canvas);
        if (!canvas) {
            onDone();
            return;
        }

        const size = view.getVisibleSize();
        // Oversized so it also covers letterbox areas on any aspect ratio.
        const w = size.width * 3, h = size.height * 3;

        const root = new Node('MockAdOverlay');
        root.layer = canvas.node.layer; // default layer is not rendered by the UI camera
        root.addComponent(UITransform).setContentSize(w, h);
        root.addComponent(BlockInputEvents);
        const g = root.addComponent(Graphics);
        g.fillColor = Color.BLACK;
        g.rect(-w / 2, -h / 2, w, h);
        g.fill();

        const textNode = new Node('Text');
        textNode.layer = canvas.node.layer;
        textNode.addComponent(UITransform);
        const label = textNode.addComponent(Label);
        label.color = Color.WHITE;
        label.fontSize = 40;
        label.lineHeight = 60;
        root.addChild(textNode);

        canvas.node.addChild(root);
        root.setSiblingIndex(canvas.node.children.length - 1);
        MockAdOverlay.node = root;

        // setTimeout, not the engine scheduler: the countdown must keep running if the
        // caller pauses the game while the "ad" plays.
        let left = seconds;
        const tick = () => {
            if (left <= 0) {
                if (root.isValid) root.destroy();
                MockAdOverlay.node = null;
                onDone();
                return;
            }
            label.string = title + '\n' + left;
            left--;
            setTimeout(tick, 1000);
        };
        tick();
    }
}

export default MockAdOverlay;
