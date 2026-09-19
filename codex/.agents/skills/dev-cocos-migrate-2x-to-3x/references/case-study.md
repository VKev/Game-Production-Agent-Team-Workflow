# Case study — "Vặn ốc vít" (tighten-screw), 2.4.15 → 3.8.8

> ⚠️ **ĐÂY LÀ NHẬT KÝ MỘT DỰ ÁN, KHÔNG PHẢI LUẬT.**
> Mọi tên class (`Gbz*`), con số (90 level, 65 script), và bất biến (số ô chia
> hết 3) là **của riêng game này**. Dùng file này để **ước lượng công sức** và
> **biết một bước thật trông ra sao** — đừng áp giả định lên game khác.
> Nếu bạn đang tìm `GbzGameManager` trong một dự án khác: dừng lại.

Dự án gốc: `/Users/lap16952/Documents/workspace/oc-vit-cang-cuc-live/`
(project 3.x ở `cocos-project-3x/`, script phân tích ở `analysis-tools/`,
báo cáo đầy đủ ở `cocos-project-3x/docs/bao-cao-tai-dung.md`).

---

## Đầu vào
Bản HTML5 build từ **Cocos Creator 2.4.15**, target WeChat/Douyin minigame,
giao diện **tiếng Trung**, chỉ có bundle **compiled + obfuscated**, không source,
không source map. Portrait 750×1334.

## Quy mô kết quả
| Hạng mục | Số |
|---|---|
| Script port sang TS | 65 |
| Prefab dựng lại | 129 |
| Level | 90 (`lv_0..lv_89`) |
| Class bắt được thân method từ runtime | 40 class / 819 component / 75 method |
| Level export ra JSON ở GĐ1 | 101 level → 21.831 hole, 5.267 board, 1.605 layer |
| Dung lượng cuối | gói chính **3,04 MB** + subpackage **11,59 MB** |
| Số file bản build | 2184 → **752** |

## GĐ1 — Recon (chi tiết đã làm)
1. Mirror bản live (`download-mirror.mjs`, `capture-live.mjs`).
2. **Patch SDK** — bản gốc kẹt vòng lặp Promise → màn đen. Stub portal + shim
   `wx` → boot được Level 1. *Đây là bước tốn công ngoài dự kiến nhất.*
3. `decode-whole-bundle.mjs` → `game.readable.js` (giải string-table + number-table).
4. `decode-runtime-methods.mjs` → 75 method trong `runtime-methods-decoded/`.
5. Export runtime API → 40 class, 819 component, `runtime-scene-component-state.json`.
6. `extract-all-assets.py` → `extracted-assets/` (MainBdl / internal / main).
7. Export level bằng chính engine sống → 99 part JSON.
8. `build-ai-analysis-master.mjs` → **AI-ANALYSIS-MASTER.md**: GDD phục hồi, có
   coverage matrix + nhãn bằng chứng `[S]/[D]/[R]/[I]/[U]`.
9. **Tách feature sống khỏi code chết**: gameplay/painting/challenge là sống;
   skin, collection, timed-loss, minigame `ningluosi` là chết → **không port**.

## GĐ2–3 — Tái dựng & port
- `scratch-recon/RECON-GUIDE.md` là prompt tái dựng từng class (nay đã tổng quát
  hoá thành agent `cocos-port-class`).
- Exemplar port chuẩn: `GbzInstance` (static singleton), `GbzEnum` (data module),
  `GbzBaselayer` (base component + UIOpacity/tween), `CollectItem` (@property +
  grayscale), `GbzCollectLayer` (ScrollView/Layout/UITransform/convert toạ độ).
- Registry trung tâm `GbzInstance` (static) giữ tham chiếu manager; manager tự
  đăng ký trong `onLoad`. Hai pattern singleton song song (`.ins` cho
  non-Component, tự-đăng-ký cho Component).

## GĐ4–5 — Scene/prefab & verify
- Dựng scene + 129 prefab hoàn toàn qua MCP `funplay_cocos`, không sửa tay JSON.
- Ground truth property: decode từ `subpackages/MainBdl/import`.
- Bug lớn nhất: **`scale.z = 0`** → 38 node trong 7 prefab không bấm được.
- Bất biến riêng của game: **số hole mỗi level chia hết 3** (mỗi box = 3 vít);
  11 level vi phạm → viết `validate-screw-count.py` (exit 1) làm guard.
- Harness: chạy game headless qua CDP tại `localhost:7456`.

## GĐ6 — Ship
- Điểm khởi đầu 45 MB thô / 27,7 MB nén **trong một gói** → trượt chuẩn.
- Benchmark phát hiện bloat do tái dựng: gốc 149 PNG ↔ bản dựng 695 PNG.
- ① nén PNG lossless: 22,59 → 9,21 MB (−59%), 689/689 pixel-identical.
- ② level prefab → JSON compact (`GbzLvBuilder.ts`): **104 MB → 0,51 MB (206×)**,
  `verify-level-data.py` → MISMATCH 0. Bonus: bỏ `loadDir('cfzs/prefabs')` vốn
  nạp cả 90 prefab vào RAM ngay màn đầu.
- ⑤ tách subpackage → 3,04 + 11,59 MB.
- `merge_all_json` + extension `minigame-pack` → 752 file.
- Fix layout web 3 phần (resolution policy / Widget stretch / camera rect).
- Fix iOS: camera `clearFlags` thiếu bit COLOR + `cam.rect` lệch `viewportRect`
  (lệch tới **64 đơn vị** → chạm ốc rất khó).

## Việc thêm ngoài phạm vi port thuần
Localize Trung→Việt; xoá 186 board 半圆; dồn số 90 level liên tục; balancing ramp
độ khó; Level Designer tool trong Editor; Endless mode procedural; skill "Thêm ô"
giới hạn 1 lần/màn; bot tự chơi `GbzAutoBot`; extension "Build nhanh" (⌘⌥B).

## Bài học đắt nhất
1. **Bước làm-chạy-được-bản-gốc bị đánh giá thấp** — nhưng không có nó thì không
   có `runtime-api.json`, và mọi giá trị property sau đó là phỏng đoán.
2. **Bẫy im lặng ăn nhiều thời gian hơn bẫy ồn ào.** `scale.z=0`, `node.group`,
   `fitWidth` — cả ba đều không có một dòng lỗi nào.
3. **Bloat đến từ quá trình tái dựng, không từ game.** Luôn benchmark với bản gốc.
4. **Bug bản build ≠ bug preview.** Ba lỗi layout nghiêm trọng nhất không hề tồn
   tại trong Editor preview.
