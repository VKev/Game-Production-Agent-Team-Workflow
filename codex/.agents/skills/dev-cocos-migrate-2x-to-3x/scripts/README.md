# Bộ script port 2.4 → 3.8

Rút nguyên từ một lần port **project có source** đã ship lên TikTok mini-game.
Mọi bản vá của các bẫy trong `references/pitfalls.md` **đã nằm sẵn trong code
này** — dùng lại thay vì viết mới, nếu không sẽ gặp lại đúng chuỗi bug đó.

Script nào cần chỉnh theo project thì hằng số nằm ngay **đầu file** (`NAMES`,
`SPINE_DIR`, `MOVE`, …). Không có script nào cần sửa sâu.

---

## Thứ tự chạy

### GĐ1 — khảo sát + import asset

| Script | Việc |
|---|---|
| `probe-cocos-layout.js` | đọc bundle / design resolution / script roots của **cả hai** project |
| `census-types.js` | đếm importer type của 2.x — **dùng để chốt PNG nào phải là `sprite-frame`** (§18) |
| `build-uuid-map.js` | bản đồ uuid 2.x → 3.x, mọi bước sau đều cần |
| `inventory-props.js` | liệt kê property thật sự xuất hiện trong `.fire`/`.prefab` của 2.x |

> §19 (mất `capInsets` + `trimType`) chưa có script đóng gói sẵn: export ground
> truth từ `.meta` của 2.x rồi ghi lại qua `asset-db save-asset-meta`. So
> **từng thuộc tính import** của **từng frame**, không so tổng.

### GĐ2 — port script

| Script | Việc |
|---|---|
| `plan-port-waves.js` | chia file thành wave theo kích thước |
| `fix-window-global.js` | `window` → `globalThis` toàn bộ (§28). Chạy `--apply` để ghi |

```bash
node fix-window-global.js <project-root>            # xem trước
node fix-window-global.js <project-root> --apply    # ghi
```

### GĐ3 — dựng scene/prefab

| Script | Việc |
|---|---|
| `dump-2x-tree.js` | `.fire`/`.prefab` của 2.x → cây node chuẩn hoá (giải `_trs`, giải class-id nén, map uuid) |
| `build-prefab.scene.js` | dựng cây trong Editor 3.8 đang chạy. **Đã bao gồm**: `layer = UI_2D` (§17), `sizeMode`/`type` trước `spriteFrame` (§20), `label.string` fallback `''` (§21), clamp `scale.z` (§1), `LabelOutline` → `Label.enableOutline` |
| `gd3-build-prefabs.scene.js` | chạy hàng loạt prefab, dùng `cce.Prefab.createPrefabAssetFromNode` (§31), assert UI_2D **trước khi ghi**, dọn scratch scene |
| `gd3-build-scene.scene.js` | dựng scene: Canvas/Camera theo semantics 3.x + `visibility = 1108344832` (§17) |

Gọi qua `execute_javascript` context `scene`:

```js
const fs = require('fs'); const path = require('path');
const ROOT = '<project-root>';                       // forward slash, nằm trong project
const src = fs.readFileSync(path.join(ROOT, '.migration/tools/gd3-build-prefabs.scene.js'), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
return await new AsyncFunction('cc', 'Editor', 'args', src)(cc, Editor, { projectRoot: ROOT, names: ['Main', 'Level'] });
```

**Trước khi chạy**: mở một scratch scene và giữ nguyên nó. `open_scene` chuyển
scene **bất đồng bộ** — script phải tự kiểm `cc.director.getScene().name` trước
khi dựng, nếu không sẽ dựng nhầm scene (cả hai orchestrator đã có sẵn chốt này).

### GĐ4/5 — cổng kiểm

Chạy hết, tất cả phải xanh **trước khi build**:

| Script | Bắt được gì |
|---|---|
| `check-cross-bundle.py` | import xuyên bundle; **`fatal: 0` là bắt buộc** (§29) |
| `verify-prefab-sizes.js` | `contentSize` từng node 2.x ↔ 3.x (§20) + vị trí root prefab (§25) |
| `verify-responsive.js` | `Widget` + `LongScreenWidgetComponent` khớp 1-1 |
| `verify-spine.js` | binding skeleton + tên animation code gọi (§34) |
| `verify-i18n.js` | phủ bản dịch, nếu project có localization |
| `test-module-order.js` | thứ tự eval ES module của chuỗi storage (§27) |
| `test-boot-prelude.js` | thứ tự cài lớp mock + idempotent (§26) |
| `test-api-coverage.js` | mọi endpoint có fixture, không còn `no fixture for` |
| `test-fake-ads.js` | quảng cáo giả luôn trao thưởng, không trao hai lần |

**So sánh A/B trực tiếp hai bản đang chạy** — cổng bắt được nhiều lỗi visual nhất,
vì nó đọc scene graph THẬT chứ không đọc file:

| Script | Việc |
|---|---|
| `ab-dump.browser.js` | dán vào console của **cả hai** bản (2.4 gốc và 3.8 port) → định nghĩa `__abDump()`, xuất scene graph về một dạng chuẩn hoá chung |
| `ab-dump.min.js` | bản rút gọn để dán nhanh khi console giới hạn độ dài |
| `ab-diff.js` | `node ab-diff.js dump-2x.json dump-3x.json` — xếp hạng khác biệt, thứ người chơi thấy được lên trước |

Đọc `references/verify.md` mục *Bốn bug của chính bộ checker* TRƯỚC khi tin kết quả:
cả bốn đều báo lỗi giả hàng loạt (127 / 21 / 49 finding), và **một con số lệch lớn bất
thường là giả cho tới khi chứng minh ngược lại**. Hai bẫy đo đạc nữa ở `pitfalls.md`
§43 (phải ép CÙNG kích thước khung trước đã) và §44 (đừng dump ở hai thời điểm khác
nhau của animation).

`lib/esm-harness.js` là phần dùng chung của 4 test cuối: compile `.ts` sang **ESM
thật** rồi eval bằng Node. **Phải là ESM** — CommonJS eval theo vị trí dòng và sẽ
giấu mất đúng bug đang tìm.

Các test này chạy được ngoài engine vì chuỗi module liên quan **không import
`cc`**. Giữ nguyên tính chất đó khi thêm code.

### GĐ6 — build + đóng gói

```bash
# sau khi build ra build/<platform>/
python3 make-subpackages.py build/bytedance-mini-game     # §33 — bắt buộc
python3 make-minigame-zip.py build/bytedance-mini-game build/<tên>.zip
node serve-build.js build/web-mobile 8130                 # verify trong trình duyệt
```

`make-subpackages.py` idempotent, tự đo và **exit khác 0 khi gói chính vượt trần**.
`make-minigame-zip.py` ghi forward slash và đặt `game.json` ở root — đừng thay bằng
`Compress-Archive` của PowerShell (nó ghi backslash, sai chuẩn ZIP, nền tảng từ chối).

`serve-build.js` gửi `Cache-Control: no-store` (§39).

---

## Ba điều dễ quên nhất

1. **`refresh_assets` sau khi sửa/di chuyển `.ts` ngoài Editor**, trước khi build —
   asset DB còn giữ đường dẫn cũ, build fail với `ModuleNotFoundError` (§38).
2. **Preview không kiểm chứng được `engine.json`** — nó chạy engine bundle dựng sẵn.
   Muốn biết gói to bao nhiêu phải build thật (§32).
3. **Đo dung lượng bằng tổng byte thật**, loại trừ `subpackages/`. `du -sh` cho số
   khác và trần nền tảng thì không tha.
