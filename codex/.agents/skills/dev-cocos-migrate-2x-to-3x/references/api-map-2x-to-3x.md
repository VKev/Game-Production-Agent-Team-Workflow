# GĐ2 — Port script: Cocos 2.4.x (JS) → 3.8.x (TypeScript)

Chuyển từng `.js` (2.x) trong `<script-root>` sang `.ts` (3.8.x) — `<script-root>`
là giá trị probe đo được ở GĐ1, không phải một tên thư mục cố định. **Giữ nguyên tên
file, tên class, và mọi logic/side-effect. Chỉ đổi API + cú pháp.**

⛔ **Cổng ra:** toàn bộ `.ts` **compile sạch** trong 3.8.x. Chưa cần chạy đúng
gameplay — wiring scene/prefab là GĐ4.

> Fan-out bằng agent `cocos-port-class` với `MODE=port`. Trước khi fan-out, tự tay
> port 4–5 file đại diện (một singleton thuần, một base layer, một component có
> @property, một component phức tạp có tween/convert toạ độ) rồi **đưa chúng vào
> prompt làm exemplar** — chất lượng đầu ra tăng rõ rệt.

---

## 1. Module system
| 2.x | 3.x |
|---|---|
| `var X = require("X").default;` | `import X from './X';` |
| `var { A, B } = require("X");` | `import { A, B } from './X';` |
| `module.exports = Cls; module.exports.default = Cls;` | `export default class Cls ...` |
| `module.exports = { A, B };` | `export { A, B };` / `export const A = ...` |

Nếu module gốc export **cả default lẫn named** → `export class X` +
`export default X` + `export const Y = ...`.

## 2. Khai báo Component
```ts
import { _decorator, Component, Node, Sprite, Label, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MyComp')
export class MyComp extends Component { ... }
export default MyComp;
```
`cc.Class({ extends: cc.Component })` → `@ccclass('Name') export class Name extends Component`.
`extends: BaseLayer` → `extends BaseLayer` (base cũng phải đã port).

## 3. properties → @property
| 2.x | 3.x |
|---|---|
| `foo: cc.Node` | `@property(Node) foo: Node = null!;` |
| `spf: cc.SpriteFrame` | `@property(SpriteFrame) spf: SpriteFrame = null!;` |
| `arr: { default: [], type: cc.Node }` | `@property({ type: [Node] }) arr: Node[] = [];` |
| `n: 0` | `@property n: number = 0;` |
| `s: ""` / `b: false` | `@property s: string = '';` / `@property b: boolean = false;` |

## 4. `ctor` → class field (QUAN TRỌNG)
3.x **không có `ctor`**. Field runtime (không serialize) trong `ctor` thành class
field thường (**không** `@property`):
```ts
// 2.x: ctor(){ this.groupId = 0; this.isUnLock = false; }
groupId: number = 0;
isUnLock: boolean = false;
```
Logic khởi tạo phức tạp → đưa vào `onLoad()`.

## 5. Vòng đời & scheduler — giữ nguyên tên
`onLoad`, `start`, `onEnable`, `onDisable`, `onDestroy`, `update(dt)`,
`scheduleOnce`, `schedule`, `unschedule`, `unscheduleAllCallbacks` — như 2.x.

## 5b. Input & Event — cả một nhóm API đổi, và chuỗi event đổi TÊN

| 2.x | 3.8.x |
|---|---|
| `node.on(cc.Node.EventType.TOUCH_START, cb, this)` | `node.on(Node.EventType.TOUCH_START, cb, this)` (`Node` import từ `'cc'`) |
| `node.on("touchstart", cb, this)` | ⚠️ chuỗi đổi thành `"touch-start"` — xem bẫy dưới |
| `cc.systemEvent.on(cc.SystemEventType.KEY_DOWN, cb, this)` | `input.on(Input.EventType.KEY_DOWN, cb, this)` |
| `cc.macro.KEY.a` / `.space` | `KeyCode.KEY_A` / `KeyCode.SPACE` |
| `cc.eventManager.addListener(...)` | **BỎ HẲN** → `node.on` / `input.on` |
| `event.getLocation()` | giữ, nhưng toạ độ **screen**; muốn toạ độ UI → `event.getUILocation()` |

### ⚠️ Chuỗi event đổi tên — BẪY IM LẶNG

2.x dùng `"touchstart"`, `"touchmove"`, `"touchend"`, `"touchcancel"`.
3.x dùng **có gạch nối**: `"touch-start"`, `"touch-move"`, `"touch-end"`,
`"touch-cancel"`.

Bê nguyên literal của 2.x sang → `node.on("touchstart", …)` đăng ký một event
**không bao giờ được phát**. Không lỗi compile, không lỗi runtime, console sạch:
nút chỉ đơn giản là không phản hồi. Chi tiết: `pitfalls.md` §7c — trong đó có
danh sách **ba** nguyên nhân im lặng của "nút không ăn", đừng dừng ở cái đầu tiên.

→ Luôn dùng **enum** `Node.EventType.*` / `Input.EventType.*`, đừng dùng chuỗi.
Grep `'touchstart'|"touchstart"` sau khi port để chắc không còn sót.

Tên `KeyCode`: chữ cái có tiền tố `KEY_` (`KeyCode.KEY_A`), phím đặc biệt thì
không (`KeyCode.SPACE`, `KeyCode.ARROW_LEFT`, `KeyCode.ENTER`).

## 6. Node / Transform (đổi nhiều nhất)
| 2.x | 3.x |
|---|---|
| `node.active` | giữ nguyên |
| `node.x` / `node.y` | **BỎ** → đọc `node.position.x/y`; set `node.setPosition(x, y, 0)` |
| `node.setScale(1.5)` | `node.setScale(1.5, 1.5, 1.5)` — **luôn 3 tham số** |
| `node.scale = s` | `node.setScale(s, s, s)` |
| `node.width/height` | `node.getComponent(UITransform).width/height` |
| `node.getContentSize()` | `node.getComponent(UITransform).contentSize` |
| `node.setContentSize(w,h)` | `node.getComponent(UITransform).setContentSize(w,h)` |
| `node.getChildByName("x")` | giữ nguyên |
| `p.convertToWorldSpaceAR(v2)` | `p.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(v.x,v.y,0))` |
| `p.convertToNodeSpaceAR(v2)` | `p.getComponent(UITransform).convertToNodeSpaceAR(worldVec3)` |
| `cc.find("a/b", node)` | `find('a/b', node)` |
| `cc.instantiate(x)` | `instantiate(x)` |
| `node.group = "g20"` | **BỎ HẲN** → xem §6b |
| `node.zIndex = 5` | **BỎ HẲN** → `node.setSiblingIndex(i)`; xem `pitfalls.md` §7b |

### 6b. `node.group` — BẪY IM LẶNG số 1
`Node.group` **không tồn tại** ở 3.x. Gán `node.group = "g20"` không lỗi compile,
không lỗi runtime — chỉ tạo thuộc tính rác trên object JS. Physics không biết gì;
mọi collider ở lại nhóm DEFAULT (`categoryBits=1, maskBits=1`) → **va chạm với tất cả**.

Triệu chứng thật: vật thể treo lơ lửng / giật tại chỗ / rơi xuyên nhau.

```ts
// nhóm là BITMASK trên Collider2D, KHÔNG phải chuỗi trên Node
collider.group = 1 << indexTrongGroupListCua2x;
collider.apply();                    // set group TRƯỚC apply() để fixture đúng filter
// ma trận va chạm (2.x nằm trong src/settings.js) phải dựng lại lúc boot:
PhysicsSystem2D.instance.collisionMatrix[bit] = maskBits;
```
Chuyển `groupList` của 2.x sang bit **theo đúng thứ tự index** — index chính là
số bit. Cờ logic tương đương `node.group === 'default'` là
`collider.group === PhysicsGroup.DEFAULT`.

## 7. Opacity — BỎ `node.opacity` → `UIOpacity`
```ts
import { UIOpacity, tween } from 'cc';
const op = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
op.opacity = 50;
tween(op).to(0.25, { opacity: 255 }).start();   // tween trên UIOpacity, KHÔNG phải node
```
Nên bọc thành helper trong base layer / utils vì dùng khắp nơi.

## 8. Tween & Action
- `cc.tween` → `tween`. Action rời (`cc.scaleTo`, `cc.moveTo`, `cc.fadeTo`) **bị bỏ**.
- Scale: `.to(0.2, { scale: new Vec3(1,1,1) })`.
- Position: `.to(0.5, { position: new Vec3(x, y, 0) })` — **không** tween `{y: -55}`
  lẻ. Gốc `.to(0.2, {y:-55})` → đọc x hiện tại rồi
  `.to(0.2, { position: new Vec3(node.position.x, -55, 0) })`.
- `.call()`, `.delay()`, `.removeSelf()`, `.start()`, `.repeat`, `.union`,
  `.parallel` — vẫn còn.

## 9. Grayscale / material
| 2.x | 3.x |
|---|---|
| `sprite.setMaterial(0, cc.Material.getBuiltinMaterial("2d-gray-sprite"))` | `sprite.grayscale = true;` |
| `sprite.setMaterial(0, cc.Material.getBuiltinMaterial("2d-sprite"))` | `sprite.grayscale = false;` |

## 10. Vector / màu / enum / size
| 2.x | 3.x |
|---|---|
| `cc.v2(x,y)` / `cc.v3(...)` | `new Vec2(x,y)` / `new Vec3(...)` |
| `cc.color(r,g,b,a)` | `new Color(r,g,b,a)` |
| `cc.Enum({...})` | `Enum({...})` (chỉ cần cho @property enum; local dùng `enum` của TS) |
| `cc.size(w,h)` / `cc.rect(...)` | `new Size(w,h)` / `new Rect(...)` |

## 11. Resource loading
| 2.x | 3.x |
|---|---|
| `cc.loader.loadRes(path, Type, cb)` | `resources.load(path, Type, cb)` |
| `cc.loader.loadResDir(path, Type, cb)` | `resources.loadDir(path, Type, cb)` |
| `cc.loader.release(...)` | `assetManager.releaseAsset(...)` |
| `cc.director.loadScene(n)` | `director.loadScene(n)` |
| `cc.director` / `cc.game` / `cc.sys` | `director` / `game` / `sys` |

⚠️ `resources.loadDir('<thư mục lớn>')` nạp **toàn bộ** thư mục vào RAM ngay lần
gọi đầu. 2.x hay dùng kiểu này cho level/atlas — ở 3.x nó thành vấn đề bộ nhớ
trên mini-game. Đổi sang load theo path từng cái.

## 12. Audio — BỎ `cc.audioEngine` → `AudioSource`
```ts
import { AudioSource, AudioClip } from 'cc';
// cần 1 AudioSource cho nhạc nền (loop) + 1 cho SFX (one-shot)
src.clip = clip; src.play();
src.playOneShot(clip, volume);
src.stop(); src.volume = v;
```
Audio manager gần như luôn phải refactor, không dịch 1-1 được.

## 13. Window / view
| 2.x | 3.x |
|---|---|
| `cc.winSize` | `view.getVisibleSize()` hoặc `screen.windowSize` |
| `cc.view` | `view` |
| `cc.Canvas` | `Canvas` |
| `canvas.fitWidth / fitHeight` | **KHÔNG TỒN TẠI** → `view.setDesignResolutionSize(w, h, ResolutionPolicy.*)`. Xem `pitfalls.md` §2 |

## 14. Singleton — 2 pattern, port khác nhau
### (a) Non-Component `.ins` (data/res/pool manager)
2.x dùng IIFE + `Object.defineProperty(Cls, "ins", {get})`. Port:
```ts
export default class ResManager {
    private static _ins: ResManager | null = null;
    static get ins(): ResManager {
        if (!ResManager._ins) ResManager._ins = new ResManager();
        return ResManager._ins;
    }
}
```
### (b) Component singleton (UI/game/fade manager)
Giữ nguyên cách tự đăng ký vào registry trong `onLoad`:
```ts
onLoad() { Instance.setUIMgr(this); }
```
- `node.addComponent('TênClassDạngString')` / `getComponent('TênClass')` — 3.x
  **vẫn hỗ trợ** miễn class đã `@ccclass`. Giữ nguyên, đỡ phải sửa hàng loạt.
- `new Map()` / `new Set()` giữ nguyên.

## 15. Quy ước chung khi port
- `tsconfig` nên để `strict: false` cho lần port đầu → dùng `null!` cho
  `@property`, `any` cho kiểu không rõ (data JSON, `EventTouch`). Siết sau.
- Comment gốc **giữ nguyên** (kể cả tiếng Trung/Việt) — chúng là bằng chứng.
  Comment **mới** viết bằng tiếng Việt là hợp lệ và được khuyến khích.
- **Chuỗi hiển thị: giữ NGUYÊN VĂN, không dịch, không gom inventory.** Source
  đang là tiếng gì thì để y như vậy. Giữ nguyên còn có lợi cho verify: ở GĐ5 bạn
  diff thẳng được `Label.string` giữa bản 2.x và bản 3.x, lệch là có bug.
  Ngoại lệ: chuỗi **mới bạn tự viết** (không có trong bản gốc) → tiếng Anh.
- API không chắc → `// TODO(port): ...` + ép `any` để vẫn compile, ghi vào `todos`.
- Sau mỗi lô file: chạy diagnostics của Editor (`run_script_diagnostics`) chứ
  đừng chỉ tin `tsc` ngoài — Editor mới thấy lỗi decorator/asset type.

## 16. Thứ KHÔNG được "dịch cho gọn"
Cám dỗ lớn nhất khi port là *cải tiến code luôn thể*. Đừng. Ở GĐ3, mọi khác biệt
hành vi đều là bug tiềm ẩn không ai truy được. Refactor sau khi GĐ5 xanh, thành
một commit riêng.


---

## 17. Bốn bẫy API nữa — cùng tên, khác nghĩa

Bốn thứ này **compile sạch** và chỉ sai lúc chạy. Grep chúng ngay từ wave đầu.

### 17.1 `getDelta()` đổi hệ toạ độ — BẪY IM LẶNG

| 2.x | 3.8.x |
|---|---|
| `event.getDelta()` → **design-space** | `event.getUIDelta()` |
| `event.getLocation()` → design-space | `event.getUILocation()` |

Ở 3.x `getDelta()` vẫn tồn tại nhưng trả **pixel màn hình**. Triệu chứng: kéo thả
không bám ngón tay, càng kéo càng trôi. Với view scale 0.75 thì node đi
`1/0.75 = 1.33` lần quãng đường con trỏ.

```bash
grep -rn "getDelta()\|\.getLocation()" assets --include=*.ts   # phải 0 hit
```

Grep **toàn bộ**, đừng tin "wave trước làm rồi": lần này hai file đã đúng còn một
file bị sót.

### 17.2 `node._components[0]` không còn là script — BẪY IM LẶNG

Idiom 2.x `node._components[0]` chính là script của prefab. Ở 3.x **mọi node UI
đều có `UITransform` đứng trước**, nên `a._components[0]._data = e` gán data vào
`UITransform` và script không bao giờ nhận được → `this._data` null trong
`initView`/`onEnable`, **mọi popup hỏng cùng lúc**.

```ts
function projectScript(node: Node): Component | null {
    for (const c of node.components) {
        const n = js.getClassName(c);
        if (!n.startsWith('cc.') && !n.startsWith('sp.')) return c;
    }
    return null;
}
```

```bash
grep -rn "_components\[0\]" assets    # mọi hit đều đáng ngờ
```

### 17.3 `Widget.AlignMode` — enum ĐẢO THỨ TỰ

| | ONCE | ALWAYS | ON_WINDOW_RESIZE |
|---|---|---|---|
| Cocos **2.x** | 0 | **2** | **1** |
| Cocos **3.8** | 0 | **1** | **2** |

Copy **số thô** từ `.prefab`/`.meta` của 2.x làm mọi Widget từng là `ALWAYS` biến
thành `ON_WINDOW_RESIZE` và ngược lại. Map tường minh `{0:0, 1:2, 2:1}`.

Đây là lớp bẫy **"enum cùng tên, khác giá trị"** — với mọi enum được copy số, in
enum ở **cả hai** runtime rồi so trước khi tin.

### 17.4 3.8 KHÔNG tự align Widget khi instantiate lúc chạy

2.4 align Widget ngay khi node enable; 3.8 **không đảm bảo**. Prefab 2.x thường
được author tại vị trí Canvas `(designW/2, designH/2)` và **dựa vào** Widget kéo
về gốc — port sang 3.8 thì nó nằm nguyên ở đó, lệch hẳn ra góc màn hình.

Với root prefab có Widget stretch (`alignFlags = 45`, insets 0), vị trí đúng
**không phụ thuộc realign** là `(0,0,0)`.

> Đừng lấy "khớp 1-1 với số 2.x" làm bất biến ở chỗ này. Bất biến thật là *"vị trí
> đúng kể cả khi không có ai realign"*.

## 18. Hai thứ không phải API nhưng giết cả bản build

### 18.1 `window` → `globalThis`

`const w = window as any;` **ném ReferenceError** trong runtime
TikTok/ByteDance/WeChat (không có `window`), ngay lúc module đang eval ⇒ cả game
không khởi động. Dùng `globalThis` (ES2020, có ở mọi runtime kể cả trình duyệt).

### 18.2 Thứ tự eval: ES module hoist import lên đầu

CommonJS chạy `require()` **đúng chỗ nó được viết**. Code 2.x rất hay có dạng:

```js
var a = require("Api");            // nhóm 1
window.wxapi = window.tt || {};    // gán GIỮA hai nhóm
var q = require("ReportQueue");    // nhóm 2 — thấy wxapi
```

ES module **hoist toàn bộ import** ⇒ nhóm 2 eval **trước** dòng gán. Module nào
dựng singleton lúc eval (`export default new X()`) mà constructor chạm tới global
đó sẽ nổ.

**Sửa:** đưa quan hệ vào **module graph**, không dựa vào vị trí dòng — tách phần
gán ra module riêng, mọi module chạm tới nó **import nó** và **gọi một hàm export
thật** (bare import bị tree-shake).

Chi tiết + cách test ngoài engine: `pitfalls.md` §27, `scripts/test-module-order.js`.
