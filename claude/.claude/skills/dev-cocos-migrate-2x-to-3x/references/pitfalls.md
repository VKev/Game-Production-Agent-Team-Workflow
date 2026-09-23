# Bẫy khi port 2.x → 3.x

Danh sách này rút từ **một lần port hoàn chỉnh đã ship**. Đa số là **bẫy im
lặng**: không lỗi compile, không lỗi runtime, console sạch — chỉ là sai. Đó là
lý do chúng tốn nhiều ngày công nhất.

Mỗi mục: **triệu chứng → nguyên nhân → cách sửa → cách phát hiện sớm**.

---

## §1. `scale.z = 0` → nút bấm không ăn 🔇

**Triệu chứng.** UI hiện đúng, đẹp, không lỗi gì — nhưng **bấm không phản hồi**.
Gọi thẳng hàm handler thì chạy đúng.

**Nguyên nhân.** 2.x là 2D thuần, `z` của scale không có ý nghĩa và hay bị lưu
là `0`. 3.x dùng ma trận world 3D: `scale.z = 0` làm ma trận **suy biến**
(không khả nghịch) → `UITransform.hitTest()` **luôn trả false**. Không ai báo lỗi.

**Sửa.** Mọi node UI phải có `scale.z = 1`. Vá hàng loạt sau khi convert prefab,
và sửa luôn script sinh prefab để không tái phát.

**Phát hiện sớm.**
```js
// chạy trong game đang chạy
let bad = []; cc.director.getScene().walk(n => { if (n.scale.z === 0) bad.push(n.name); }); return bad;
```

## §2. `canvas.fitWidth / fitHeight` — resolution policy không bao giờ được set 🔇

**Triệu chứng.** Editor/preview ổn. Mở **bản build** trên cửa sổ ngang (PC,
laptop): canvas bung hết bề ngang, UI văng ra mép, "mất nền".

**Nguyên nhân.** 2.x set tỉ lệ co giãn qua `cc.Canvas.fitWidth/fitHeight`. Ở 3.x
**hai thuộc tính này không tồn tại** — gán vào không lỗi, chỉ là không có tác
dụng, nên policy giữ nguyên mặc định.

**Sửa.**
```ts
import { view, ResolutionPolicy } from 'cc';
// khung ngang hơn thiết kế → SHOW_ALL (giữ khung dọc, letterbox)
// khung cao hơn thiết kế (điện thoại dài) → FIXED_WIDTH
view.setDesignResolutionSize(designW, designH, policy);
```

**Phát hiện sớm.** `python3 <skills-dir>/dev-cocos-migrate-2x-to-3x/scripts/cdp.py
diag --serve <build-dir> --w 1600 --h 757` → so `design` với `visible`; policy sai
thì `visible` khác hẳn `design`.

## §3. Widget stretch bake offset âm → layer phình 🔇

**Triệu chứng.** Một layer có `width` khổng lồ (vd 2820 thay vì 750) sau khi
instantiate dưới khung rộng; con của nó văng ra ngoài.

**Nguyên nhân.** `Widget` với align L/R bật sẽ tính offset theo **kích thước
parent tại thời điểm instantiate**. Instantiate khi khung đang rộng → offset âm
bị bake vào, giữ luôn sau khi khung thu lại.

**Sửa.** Hàm `fixLayerStretch()` ép Widget về đúng thiết kế
(`left/right/top/bottom = 0`, `alignMode = ALWAYS`, contentSize = design), gọi
từ `onLoad()` của mọi layer gốc **và** từ chỗ khởi tạo màn chơi.

## §4. Camera — hai bẫy khác nhau, cùng nguồn 🔇

**(a) Vệt smear / lưu ảnh cũ.** `clearFlags` thiếu bit **COLOR** → frame trước
không bị xoá. Chỉ lộ trên một số thiết bị (đã thấy trên iPhone + webview TikTok),
máy dev không thấy.
→ Sửa: bật bit COLOR trong `clearFlags`.

**(b) Chạm lệch chỗ vẽ.** `camera.rect` không khớp `view.getViewportRect()` →
toạ độ **vẽ** và toạ độ **chạm** tính theo hai hệ khác nhau. Đo được lệch tới
hàng chục đơn vị: người chơi bấm đúng vào vật mà game nhận là bấm chỗ khác.
→ Sửa: cắt `camera.rect` đúng tỉ lệ thiết kế (letterbox thật) và đảm bảo
`viewportRect` khớp.

**Phát hiện sớm.** `cdp.py diag` in thẳng `viewportRect` + `rect` của mọi
camera + `clearsColor`. Muốn đo lệch thật: lấy world position của một vật, dùng
`camera.worldToScreen`, quy về `getUILocation`, so với world position ban đầu —
lệch > bán kính hitbox là hỏng.

## §5. `node.group` là no-op → physics loạn 🔇

**Triệu chứng.** Vật thể treo lơ lửng, giật tại chỗ, va chạm với thứ lẽ ra phải
bỏ qua.

**Nguyên nhân.** `Node.group` không còn ở 3.x; gán chuỗi vào chỉ tạo property
rác. Mọi collider ở nhóm DEFAULT → va chạm chéo hết.

**Sửa.** `collider.group = 1 << index` (bitmask trên **Collider2D**), set
**trước** `collider.apply()`, và dựng lại `PhysicsSystem2D.instance.collisionMatrix`
từ `groupList` của 2.x (index = số bit). Chi tiết: `api-map-2x-to-3x.md` §6b.

## §6. Builder rơi về scene index 0

**Triệu chứng.** Bản build mở ra là **scene test/công cụ**, không phải game.

**Nguyên nhân.** Không chỉ định `startScene` → builder lấy scene đầu danh sách.

**Sửa.** Truyền `startScene` = **uuid** của scene game, và **loại mọi `.scene`
trong thư mục công cụ khỏi build**.

## §7. `node.opacity` và tween opacity 🔇

`node.opacity` không tồn tại ở 3.x → gán vào không lỗi, không hiệu lực. Tương
tự, `tween(node).to(t, {opacity: x})` **không làm gì**. Phải qua component
`UIOpacity` và tween **trên component đó**.

## §7b. `node.zIndex` là no-op → thứ tự vẽ sai 🔇

**Triệu chứng.** Popup nằm dưới nền, nút bị lớp khác che, hiệu ứng vẽ sau lưng
nhân vật. Vị trí và kích thước đều đúng — chỉ sai thứ tự chồng lớp.

**Nguyên nhân.** `Node.zIndex` **không tồn tại** ở 3.x. Gán vào chỉ tạo thuộc
tính rác trên object JS — cùng một họ với `node.group` (§5) và `node.opacity`
(§7). Ở 3.x thứ tự vẽ UI do **thứ tự sibling trong cây** quyết định: em càng về
sau càng vẽ lên trên.

**Sửa.** `node.setSiblingIndex(i)`. **Không map 1-1 theo số**: 2.x cho `zIndex`
tuỳ ý (kể cả âm, kể cả trùng) rồi tự sắp; còn `i` ở 3.x là **chỉ số thật trong
danh sách con**, phải liên tục và không trùng. Cách chuyển đúng: sort các con
theo `zIndex` cũ rồi gán `setSiblingIndex` theo thứ tự `0..n-1`. Đưa lên trên
cùng: `node.setSiblingIndex(node.parent.children.length - 1)`.

**Phát hiện sớm.** Grep `\.zIndex` trong toàn bộ `.ts` sau khi port — còn hit
nào là còn lỗ. Prefab/scene mang `_zIndex` từ bản convert cũng phải rà.

## §7c. Chuỗi event touch đổi tên → handler không bao giờ chạy 🔇

**Triệu chứng.** Bấm không phản hồi, hệt §1 (`scale.z = 0`). Gọi thẳng handler
thì chạy đúng.

**Nguyên nhân.** 2.x: `"touchstart"`. 3.x: **`"touch-start"`** (có gạch nối, và
tương tự `touch-move` / `touch-end` / `touch-cancel`). Bê nguyên literal sang là
đăng ký một event không bao giờ được phát — `node.on` không hề báo tên event lạ.

**Sửa.** Dùng enum `Node.EventType.TOUCH_START`, đừng dùng chuỗi.
Grep `["']touch(start|move|end|cancel)["']` sau khi port.

**Ghi chú chẩn đoán.** "Nút không ăn" ở 3.x có **ba** nguyên nhân im lặng khác
nhau: `scale.z = 0` (§1), chuỗi event sai (§7c), và `camera.rect` lệch (§4b).
Loại trừ cả ba, đừng dừng ở cái đầu tiên tìm được.

## §8. `setScale` một tham số

2.x: `node.setScale(1.5)` = scale đều. 3.x chữ ký là `setScale(x, y, z)` hoặc
`setScale(Vec3)`. Truyền một số → chỉ set `x`, các trục còn lại không như ý
(và dễ dẫn tới §1). **Luôn truyền đủ 3.**

## §9. `resources.loadDir` nạp cả thư mục vào RAM

2.x hay `loadResDir` cả thư mục level/atlas cho tiện. Ở 3.x thói quen đó khiến
mini-game nạp toàn bộ tài nguyên ngay màn đầu → tốn RAM + giật lúc boot. Đổi
sang load theo path từng asset khi cần.

## §10. Bất biến số học của game — phải viết validator

Mọi game có những **bất biến số học** mà dữ liệu phải tuân theo (ví dụ ở game
đã port: tổng số ô phải chia hết cho số ô mỗi nhóm — lẻ một cái là màn **không
thể thắng** hoặc crash). Ở bản gốc, bất biến này được bảo đảm bởi công cụ thiết
kế level mà bạn **không có**.

Việc phải làm ở mọi dự án port: **tìm bất biến đó, rồi viết một script kiểm tra
exit code 1 khi vi phạm**, và chạy nó sau mọi lần sinh/sửa dữ liệu. Đừng dựa vào
mắt.

## §11. Font mất glyph sau khi bóc/đóng lại asset 🔇

Skill này **không dịch**, nên ba bẫy localize kinh điển không áp dụng.

Còn lại một bẫy vẫn áp dụng: **BMFont/atlas chữ bị thiếu glyph sau khi đi qua
bước bóc asset rồi import lại vào 3.8.** Ảnh font ra đúng kích thước nhưng
thiếu ký tự, hoặc file `.fnt`/`.json` metric lệch → chữ ra **ô trống hoặc mất
hẳn**, console im lặng.

Kiểm: dựng một scene test đổ đúng những chuỗi dài nhất của game lên mọi font đang
dùng, chụp ảnh so với bản 2.x. Đây là kiểm bằng **mắt** — không có script thay được.

## §12. Không xoá asset theo quét uuid tĩnh

Ảnh trong `resources/` được load **theo path lúc chạy** → quét tham chiếu uuid
tĩnh không thấy chúng, nhưng game vẫn gọi. Xoá theo kết quả quét = mất ảnh lúc
chạy. Phải grep chuỗi path trong toàn bộ source trước khi xoá.

## §13. Sửa tay JSON `.scene` / `.prefab`

Sinh ra file **mở được nhưng sai âm thầm**: mất liên kết prefab instance,
`fileId` lệch, thay đổi không apply được. Luôn dựng qua Editor sống (MCP).

## §14. Môi trường chạy thử

- Bản web Cocos **không** mở được bằng `file://` — phải có HTTP server.
- Chrome headless: **game loop có thể bị pause** → gọi `game.step()` thủ công.
- Cocos web gắn `keydown` lên **canvas**, không phải `document` → dispatch phím
  vào đúng element.
- Chrome mới chặn WebSocket CDP từ origin lạ nếu thiếu `--remote-allow-origins=*`.

## §15. `compressionType` trong `.meta` không ăn

Cấu hình subpackage/nén phải nằm trong **preset builder**
(`bundleConfig.custom.<preset>`), `configs` keyed theo **nhóm platform**
(`miniGame`/`web`/`native`). Đặt vào `.meta` của bundle: không có tác dụng, và
không có cảnh báo nào.

## §16. Bóc SpriteFrame khỏi file GÓI — texture sai mà ảnh vẫn "đúng" 🔇

Đây là bẫy đắt nhất của GĐ1 vì nó **không lộ ra ở bất kỳ đâu**.

Một `.json` trong `import/` có thể là **file gói (pack)** chứa hàng chục asset.
Ô `data[1]` (`SharedUuids`) là danh sách uuid **dùng chung của cả gói** — thứ tự
KHÔNG liên quan gì tới thứ tự SpriteFrame. Nếu chọn texture bằng chỉ số:

```python
tex_uuids = [d for d in data[1] if isinstance(d, str)]
tu = tex_uuids[fi]        # ✗ SAI với file gói
```

thì mỗi frame lấy `rect` của mình nhưng cắt trên **texture của asset khác**. Ảnh
bóc ra **đúng kích thước, sai nội dung**. Không exception, không warning.

Đo trên game tank: **165/368** ảnh nhóm `_by_name` là crop sai texture. Không ai
thấy cho tới khi so hash pixel với bản dựng lại theo uuid.

**Đúng**: mỗi asset là MỘT SECTION, và section mang tham chiếu tường minh
`_textureSetter` trong bộ ba `(DependObjs, DependKeys, DependUuidIndices)`.
Đọc từ đó. `extract-cocos24-assets.py` hiện đã làm vậy — đừng quay về lối chỉ số.

Hai bẫy đi kèm, cùng gốc:

- **Đường dẫn logic tra thiếu bundle.** File `native/` của một asset có thể nằm ở
  bundle A trong khi path chỉ khai báo ở `config.json` của bundle B (tank: 51 file
  ở `editor`, 226 ở `scene`, 257 ở `resources` nhưng path do `res` khai báo). Tra
  trong config của riêng bundle đang xử lý ⇒ mất tên ⇒ rơi vào `_by_name/` ⇒ mã
  port nạp theo đường dẫn không thấy gì. Phải dùng chỉ mục uuid→path TOÀN CỤC,
  và với file gói thì lấy uuid từ `config.packs[<pack-id>][section-index]` (tên
  file gói là pack-id nên KHÔNG tra được qua `versions.import`).

  ### ⚠ Bệnh này có ở **BA** chỗ trong `extract-cocos24-assets.py`, không phải một

  Đây là chỗ đã có người sai thật: vá bước 3 xong, đo lại thấy `_by_name` sạch,
  kết luận "đã sửa" — mà bước 1 vẫn im lặng làm mất file.

  | # | Chỗ | Tra sai cái gì | Hậu quả |
  |---|---|---|---|
  | 1 | bước 1, `path_of()` | `paths` của bundle đang xử lý | audio/texture standalone mất tên → `_raw_unnamed/` |
  | 2 | bước 2, spine | `find_native(bdir, …)` + `versions.import` của bundle đang xử lý | thiếu texture / thiếu `.json`+`.atlas` |
  | 3 | bước 3, `_textureSetter` | `find_native(bdir, …)` | thiếu pixel thật của SpriteFrame |

  Cả ba **không sinh warning** ở bản cũ. Cơ chế giống nhau và cần **hai** lượt
  cùng thất bại mới lộ:

  ```
  xử lý bundle A: CÓ file native, nhưng paths của A không khai báo đường dẫn
                  →  p = None            →  continue
  xử lý bundle B: CÓ khai báo đường dẫn, nhưng không có native trong B/native
                  →  pick_file() = None  →  continue
  ```

  Đo trên game tank sau khi CHỈ vá bước 3: vẫn còn **2** đường dẫn
  (`cc.SpriteAtlas` + `cc.Texture2D`, native ở `assets/resources/native/`, path do
  bundle `res` khai báo) không được ghi ở bất kỳ bundle nào.

  **Cách kiểm trước khi kết luận "đã sửa xong"** — grep chính file đó:

  ```
  grep -n 'paths.get(\|find_native(bdir' extract-cocos24-assets.py
  ```

  Mỗi hit phải có nhánh dự phòng toàn cục ngay cạnh (`U2P` hoặc
  `find_native_any(...)`). Không có = còn lỗ.

  **Cổng kiểm bằng dữ liệu, không bằng mắt**: đếm entry `paths` là ảnh trong mọi
  `config.*.json`, rồi đếm file bóc ra khớp từng đường dẫn đó. Hai số phải bằng
  nhau. Đừng chỉ đếm tổng file — bản cũ và bản đã vá chênh nhau đúng 2 file trên
  tổng 3113, nhìn tổng thì không thấy.

  **Chỗ chưa vá được, cố ý**: bước 2 lấy file `import/` của `sp.SkeletonData` qua
  `versions.import` của **chính** bundle đó; nếu file được ship ở bundle khác thì
  không tra chéo được (mỗi bundle có `versions.import` riêng). Build tank có **0**
  asset spine nên không có cách nào chạy thử một bản vá ⇒ **không viết vá mò**,
  chỉ đổi im lặng thành `manifest["warnings"]`. Gặp game có spine thì đọc warning
  đó trước.
- **Ghi bản crop thay ảnh gốc.** Với ảnh RỜI, 2.x đã auto-trim lúc import nên
  `rect` là vùng đã cắt viền trong suốt, `originalSize` mới là kích thước thật.
  Ghi bản crop ⇒ Cocos 3.8 auto-trim LẦN NỮA trên ảnh không còn viền ⇒
  `rawWidth/rawHeight` và `offsetX/offsetY` sai ⇒ sprite `SizeMode.RAW` lệch
  1–6 px, im lặng. Nhận biết bằng dữ liệu: nếu texture của frame và frame cùng
  một đường dẫn logic thì texture CHÍNH LÀ ImageAsset của đường dẫn đó ⇒ chép
  nguyên byte, không crop. Frame con của atlas thật thì crop mới đúng.

---

# Phần B — bẫy của port PROJECT→PROJECT (2.4 có source → 3.8)

§1–§16 ở trên rút từ lần dựng lại một **bản build** đã compile. Phần này rút từ
một lần port **project có source** (`assets/` + `.meta` + `project.json`) lên
3.8.8 và ship lên TikTok mini-game. Cùng engine, khác hoàn toàn về chỗ vỡ: ở đây
code port sạch, `tsc` xanh, `validate_prefab_references` 0 lỗi — mà game vẫn đen
màn hình hoặc sai layout.

**Bài học chung của cả phần này: cổng kiểm mặc định của Cocos (validate_scene,
validate_prefab_references) và `tsc` đều MÙ với lớp asset-import và lớp
serialize.** Phải tự viết checker đối chiếu dữ liệu 2.x ↔ 3.x. Bộ checker dùng
được ngay nằm ở `scripts/` của skill này.

---

## §17. Node ở layer DEFAULT thay vì UI_2D → camera không render gì 🔇

**Triệu chứng.** Scene dựng xong, đúng số node, `validate_prefab_references` báo
0 missing, `tsc` xanh — nhưng màn hình **trống trơn**, chỉ thấy màu nền camera.

**Nguyên nhân.** `new Node()` ở 3.8 mặc định `layer = Layers.Enum.DEFAULT`
(`1 << 30`). Camera của Canvas chỉ render các layer nằm trong `visibility` của
nó. Node ở DEFAULT bị **cull im lặng** — không lỗi, không cảnh báo.

Ground truth là template của chính Creator (`scene-2d.scene`):

| | giá trị |
|---|---|
| Canvas và mọi node UI con | `_layer = 33554432` (`UI_2D`, `1 << 25`) |
| Node Camera | `_layer = 1073741824` (`DEFAULT`) |
| Camera `_visibility` | `1108344832` (`DEFAULT \| UI_2D \| IGNORE_RAYCAST`) |

**Sửa.** Mọi script dựng node phải set `node.layer = Layers.Enum.UI_2D` ngay sau
`new Node()`, và **assert trước khi ghi asset**.

**Phát hiện sớm.** Đếm trực tiếp trên file — đây là phép kiểm rẻ nhất trong cả
bản port:

```bash
node -e "const fs=require('fs');for(const f of fs.readdirSync('assets/local/prefab').filter(x=>x.endsWith('.prefab'))){const a=JSON.parse(fs.readFileSync('assets/local/prefab/'+f,'utf8'));const bad=a.filter(o=>o.__type__==='cc.Node'&&o._layer!==33554432).length;if(bad)console.log(f,'wrong layer x'+bad)}"
```

Hit ở đây cũng làm **hit-test** chết, không chỉ render: `UITransform.hitTest`
đi qua camera, layer không khớp thì chạm không ăn.

## §18. PNG import thành `texture`, không có sub-asset `spriteFrame` 🔇

**Triệu chứng.** Dựng prefab xong, mọi `Sprite` đều trống. Không lỗi import.

**Nguyên nhân.** Thả PNG vào `assets/` của 3.8, importer mặc định có thể ra
`texture` thay vì `sprite-frame`. `texture` **không có sub-asset `spriteFrame`**
nên không có gì để prefab tham chiếu.

**Sửa.** Đối chiếu census của 2.x rồi set `type` trong `.meta` qua
`asset-db save-asset-meta`. Ví dụ thật: 121 PNG → 113 phải là `sprite-frame`,
8 còn lại giữ `texture` vì là atlas page của spine.

**Phát hiện sớm.** Đếm `.meta` có `subMetas` chứa importer `sprite-frame`; số này
phải khớp số file `type: sprite` bên 2.x. Bắt ở GĐ1, nếu không cả GĐ3 sẽ dựng
prefab rỗng rồi mới lộ.

## §19. Mất `capInsets` (9-slice) + `trimType` khi re-import — gốc của MỌI lỗi "UI bị kéo giãn" 🔇

**Đây là bẫy đắt nhất của lần port này.** User báo ba chỗ bị stretch; mọi checker
đang có đều PASS vì dữ liệu trong prefab đúng hết — cái sai nằm ở **lớp import
asset**, nơi không checker nào nhìn tới.

**(a) 9-slice.** `capInsets` (`borderTop/Bottom/Left/Right`) nằm trên
**sprite-frame**, tức trên `.meta` của ảnh — **không** nằm trên component
`Sprite`. Re-import sang 3.8 đặt hết về `0`. `Sprite` type `SLICED` với
capInsets `[0,0,0,0]` render **y hệt ảnh bị kéo giãn**. Không lỗi, không warning.

**(b) `trimType`.** 2.x dùng `custom` với rect nguyên ảnh (= KHÔNG trim). 3.8
import mặc định `auto` = **tự cắt viền trong suốt**, đổi `rect`/`size`/`offset`.
Ảnh hưởng thấy rõ: `285x75 → 217x51`, `274x124 → 272x122`, offset `(0,0) → (-11,3)`.

**Sửa.** Export ground truth từ `.meta` của 2.x rồi ghi lại qua
`asset-db save-asset-meta`, gồm: `trimType`, `trimThreshold`, `trimX/Y`,
`width/height`, `rawWidth/rawHeight`, `offsetX/Y`, `rotated`, và `borderTop/
Bottom/Left/Right`.

**Phát hiện sớm.** So **từng thuộc tính import** của từng frame giữa hai project,
không chỉ so scene/prefab. Lần này: 113 frame × 15 thuộc tính; 12 frame mất
border, 113/113 sai `trimType`.

> Liên quan §16 — cùng họ "auto-trim lần hai", nhưng §16 là khi bóc từ **build**,
> còn mục này là khi có **project 2.x** trong tay. Có source thì luôn lấy số từ
> `.meta` của 2.x, đừng để 3.8 tự đoán.

## §20. Gán `spriteFrame` TRƯỚC `sizeMode` → mất contentSize tác giả 🔇

**Triệu chứng.** Thanh progress / khung ảnh sai kích thước. Ví dụ đo được:
2.x `[252,73]` → 3.x `[152,73]`, hụt đúng 100px.

**Nguyên nhân.** `Sprite` mới tạo mặc định `sizeMode = TRIMMED`. Gán
`spriteFrame` trong trạng thái đó **ghi đè `UITransform` bằng kích thước của
frame**. Set `sizeMode = CUSTOM` sau đó **không khôi phục lại** contentSize.

**Sửa.** Trong script dựng prefab: set `sizeMode` và `type` **trước**, rồi mới
gán `spriteFrame`. Và thêm bước **re-assert `contentSize` sau khi đã add xong mọi
component** — `Label` cũng tự resize theo `string`/`overflow`.

**Phát hiện sớm.** Checker đối chiếu `contentSize` từng node 2.x ↔ 3.x
(`scripts/verify-prefab-sizes.js`). **Phải phân biệt sibling trùng tên ở CẢ HAI
phía** (`#2`, `#3`), nếu không sẽ ghép nhầm node và báo hàng chục lệch giả.

## §21. Label rỗng hiện chữ `label` 🔇

**Triệu chứng.** Chữ `label` hiện thật trên màn hình.

**Nguyên nhân.** 2.x **không serialize** `_string` khi chuỗi rỗng → giá trị thật
là `''`. Script dựng chỉ set khi có `_string` ⇒ Label giữ **default của Cocos
3.8 là `'label'`**.

**Sửa.** Luôn gán `label.string`, fallback `''` khi cả `_string` lẫn `_N$string`
vắng.

**Phát hiện sớm.** `grep -c '"_string": "label"'` trên toàn bộ `.prefab`/`.scene`
phải ra **0**.

> Bài học rộng hơn: **giá trị MẶC ĐỊNH khác nhau giữa hai engine nguy hiểm ngang
> API khác nhau — và nó im lặng hơn.** Sparse serialization của 2.x nghĩa là
> "vắng mặt" mang thông tin; đừng bỏ qua trường vắng.

## §22. `_components[0]` không còn là script 🔇

**Triệu chứng.** `TypeError: Cannot read properties of null` trong `initView`;
popup mở ra rỗng. Ảnh hưởng **mọi** popup cùng lúc.

**Nguyên nhân.** Idiom của 2.x: `node._components[0]` chính là script của prefab.
Ở 3.x **mọi node UI đều có `UITransform` đứng trước**, nên
`a._components[0]._data = e` gán data vào `UITransform` và script không bao giờ
nhận được.

**Sửa.** Helper tìm component đầu tiên có `js.getClassName()` **không** bắt đầu
bằng `cc.` hay `sp.`:

```ts
function popupScript(node: Node): Component | null {
    for (const c of node.components) {
        const n = js.getClassName(c);
        if (!n.startsWith('cc.') && !n.startsWith('sp.')) return c;
    }
    return null;
}
```

**Phát hiện sớm.** `grep -rn "_components\[0\]" assets` — mọi hit đều đáng ngờ.

## §23. `getDelta()` đổi hệ toạ độ 🔇

**Triệu chứng.** Kéo thả không bám ngón tay; càng kéo càng trôi xa.

**Nguyên nhân.** 2.x `getDelta()` trả delta **design-space**. 3.x `getDelta()`
trả **pixel màn hình**; bản design-space là **`getUIDelta()`**. Với view scale
0.75 thì node đi `1/0.75 = 1.33` lần quãng đường con trỏ.

**Sửa.** `getDelta() → getUIDelta()`, `getLocation() → getUILocation()`.

**Phát hiện sớm.**
```bash
grep -rn "getDelta()\|\.getLocation()" assets --include=*.ts
```
Zero hit bắt buộc. Lần này một file bị sót trong khi hai file khác đã đúng — grep
toàn bộ, đừng tin "wave trước làm rồi".

## §24. `AlignMode` đảo thứ tự enum giữa hai engine 🔇

| | ONCE | ALWAYS | ON_WINDOW_RESIZE |
|---|---|---|---|
| Cocos **2.x** | 0 | **2** | **1** |
| Cocos **3.8** | 0 | **1** | **2** |

**Nguyên nhân.** Script dựng copy **số thô** từ `.meta`/`.prefab` của 2.x. Mọi
Widget từng là `ALWAYS` (2) trở thành `ON_WINDOW_RESIZE`, và ngược lại.

**Sửa.** Map tường minh `{0:0, 1:2, 2:1}` khi port `alignMode`.

**Phát hiện sớm.** In `cc.Widget.AlignMode` ở **cả hai** runtime rồi so. Đây là
lớp bẫy "enum cùng tên, khác giá trị" — kiểm tương tự cho mọi enum được copy số.

## §25. 3.8 KHÔNG tự align Widget khi node được instantiate lúc chạy 🔇

**Triệu chứng.** Một prefab instantiate lúc runtime nằm lệch hẳn ra góc màn hình
(đo được: local `(375,667)` → world `(750,1334)` = góc trên-phải).

**Nguyên nhân.** 2.4 align Widget ngay khi node enable. 3.8 **không đảm bảo**
điều đó. Prefab 2.x thường được author tại vị trí Canvas `(designW/2, designH/2)`
và **dựa vào** Widget kéo về gốc — port sang 3.8 thì nó nằm nguyên tại chỗ.

**Sửa.** Với root prefab có Widget stretch (`alignFlags = 45`, insets 0), vị trí
đúng **không phụ thuộc realign** là **`(0,0,0)`**. Chuẩn hoá mọi root như vậy.
Mở prefab trong Editor rồi Save là đủ — Editor tự canonical hoá.

**Phát hiện sớm.** Checker so vị trí root prefab (có trong
`scripts/verify-prefab-sizes.js`): root có Widget stretch ⇒ kỳ vọng `(0,0,0)`;
root không có ⇒ so với giá trị 2.x authored.

> Cạm bẫy phụ: **đừng lấy "khớp 1-1 với số 2.x" làm bất biến ở đây.** 2.x author
> `(375,667)` và dựa vào runtime kéo về; bất biến thật là "vị trí đúng kể cả khi
> không có ai realign".

## §26. Plugin script → ES module: mất đảm bảo thứ tự chạy 🔇

**Triệu chứng.** Lớp mock/SDK giả không kịp cài trước khi game gọi tới; hoặc
chạy được ở preview rồi biến mất khỏi build.

**Nguyên nhân.** File có `isPlugin: true` + `loadPluginInWeb/Native` ở 2.x được
`cc.assetManager.loadScript()` chạy **trước khi engine boot**, sớm hơn mọi
`onLoad`. Ở 3.8 không có gì tái lập điều đó:

- đổi thành `@executionOrder(-10000)` Component thì chạy **muộn hơn** thứ nó thay thế;
- `import './X'` chỉ để lấy side-effect thì **vừa không có thứ tự vừa bị
  tree-shake**.

**Sửa.** Mỗi file mock export một `installX()` **có guard idempotent**; một module
`BootPrelude` duy nhất giữ thứ tự và **gọi thật** các hàm đó; entry point gọi
`bootPrelude()` ở module scope.

Thứ tự có lý do, không tuỳ tiện — ví dụ thật:
`FakeAnalytics` → `ApiMock` → `FakeAds` → `MobileAdapter`.
`ApiMock` bọc `fetch`/`XMLHttpRequest` nên phải bọc **bản thật**, không phải bản
của `FakeAds`.

**Phát hiện sớm.** Test tự động dựng lại thứ tự cài và kiểm idempotent
(`scripts/test-boot-prelude.js`). Cài hai lần còn tệ hơn không cài: `ApiMock` sẽ
bọc chính mock của nó.

## §27. ES module hoisting đổi thứ tự side-effect 🔇

**Triệu chứng.** `Cannot read properties of undefined (reading 'getStorageSync')`
lúc khởi động — hoặc tệ hơn: chỉ chết trên iOS.

**Nguyên nhân.** 2.x là CommonJS: `require()` chạy **đúng chỗ nó được viết**. Code
kiểu này rất phổ biến:

```js
var a = require("Api");             // nhóm 1
window.wxapi = window.tt || {};     // gán GIỮA hai nhóm
var q = require("ReportQueue");     // nhóm 2 — thấy wxapi
```

ES module **hoist toàn bộ import lên đầu** ⇒ nhóm 2 eval **trước** dòng gán.
`Params`/`ReportQueue` dựng singleton ngay lúc eval, constructor gọi
`LocalStorage.getItem` → `StorageSync` → `wxapi.getStorageSync` với `wxapi`
undefined.

**Sửa.** Đưa quan hệ vào **module graph**, không dựa vào vị trí dòng: tách phần
gán ra một module riêng (`HostAlias`), và **mọi module chạm tới nó đều import
nó** rồi **gọi một hàm export thật** (`hostApi()`), không phải bare import.

**Phát hiện sớm.** Chuỗi này không import `cc` nên **chạy được ngoài engine**:
compile sang ESM rồi eval bằng Node với host giả (`globalThis.tt` có,
`localStorage` KHÔNG) — xem `scripts/test-module-order.js`. Bắt buộc là ESM;
CommonJS sẽ giấu mất bug.

## §28. `window` không tồn tại trong runtime mini-game

**Triệu chứng.** `Unable to instantiate chunks:///_virtual/<file>.ts` trên máy
thật; preview và devtools thì sạch.

**Nguyên nhân.** Quy ước `const w = window as any;` chạy tốt trên trình duyệt và
**ném ReferenceError** trong runtime TikTok/ByteDance/WeChat — ném ngay lúc module
đang eval, nên cả game không khởi động.

**Sửa.** `const w = globalThis as any;` ở mọi nơi. `globalThis` là ES2020, có
trong mọi runtime kể cả trình duyệt. Chỉ đổi định danh `window` **đứng một mình**,
không đụng `w.window` hay chuỗi `'window'`. Script sẵn: `scripts/fix-window-global.js`.

**Phát hiện sớm.** `grep -rnw window assets --include=*.ts` — mỗi hit phải là
thuộc tính hoặc chuỗi, không được là định danh toàn cục.

## §29. Import xuyên bundle **từ `main`** là fatal lúc boot 🔇

**Triệu chứng.** Build ra scene **rỗng**, chỉ có một lỗi CORS khó hiểu:

```
Access to script at 'chunks:///_virtual/X.ts' has been blocked by CORS policy
Error: chunks:///_virtual/X.ts, chunks:///_virtual/Y.ts (SystemJS ...#3)
```

Preview vẫn chạy ngon. Đây đúng loại "chỉ build mới lộ".

**Nguyên nhân.** `assets/<folder>` có `isBundle: true` là **bundle riêng**; mọi
thứ còn lại là `main`. `main` giữ start scene và **nạp trước**, nên một static
import từ `main` sang bundle khác không resolve được: SystemJS rơi về
`<script src="chunks:///...">` và trình duyệt từ chối scheme đó.

Chiều ngược lại (game/framework → main) **an toàn** vì main đã nạp xong.

**Sửa.** Đặt module ở đúng bundle với thứ gọi nó. Ghi lý do ngay đầu file, nếu
không người sau sẽ "dọn" nó về chỗ gọn mắt và làm chết build lần nữa.

**Phát hiện sớm.** `scripts/check-cross-bundle.py` — liệt kê mọi cạnh xuyên
bundle và đánh dấu cạnh fatal. **`fatal: 0` là điều kiện bắt buộc trước khi
build.**

## §30. 3.8 eager-evaluate mọi `.js` trong `assets/` → vendor UMD giết script executor

**Triệu chứng.** `Unresolved specifier buffer` từ `lib/jszip.js` → **không dùng
được scene/prefab nào**.

**Nguyên nhân.** 2.x nạp module **lười**: file không ai `require` thì không bao
giờ chạy. 3.8 **eager-evaluate** mọi `.js` trong `assets/` như prerequisite
module. Vendor UMD kiểu browserify gọi `i("buffer")` qua alias (`var i = require`)
— packer của 3.8 chỉ thấy được specifier **tĩnh**, không lần theo alias được.

**Sửa.** Kiểm ai thực sự dùng trước khi chữa. Lần này: **không ai** — không file
`.ts` nào import, không global nào được dùng ở cả hai bản. Chuyển 8 file vendor ra
ngoài `assets/`. Bỏ luôn ~200KB code chết khỏi gói ship.

Đừng phí thời gian đổi `'buffer'` → `'./buffer'` → `'./buffer.js'`: đã thử, vẫn
lỗi, vì vấn đề là alias chứ không phải đường dẫn.

**Kèm theo.** File `TsHelpers.js` (thường là file `isPlugin` duy nhất của 2.x)
cũng bỏ được: nó tồn tại vì bản 2.x ship `.js` đã compile; bản port là TypeScript
thật nên Cocos tự bundle helper.

## §31. `create_prefab_from_node` của MCP không sinh `cc.PrefabInfo` 🔇

**Triệu chứng.** Console log `open prefab failed TypeError: Cannot read
properties of null (reading instance)` sau **mỗi** lần lưu.
`validate_prefab_references` vẫn báo **0 missing** — cổng này KHÔNG bắt được.

**Nguyên nhân.** Tool dùng `asset-db:create-asset`: serialize cây node nhưng
**không sinh** `cc.PrefabInfo`/`cc.CompPrefabInfo`. Kết quả `_prefab = null` trên
mọi node ⇒ instance trong scene không track được asset ⇒ hỏng đúng workflow artist.

**Sửa.** Dùng API mà Editor dùng khi kéo node vào Assets:

```js
cce.Prefab.createPrefabAssetFromNode(String(nodeUuid), 'db://assets/.../X.prefab')
```

**Chữ ký nhận UUID STRING.** Truyền object node thì nó trả `null` và **không ghi
gì cả, im lặng**.

**Phát hiện sớm.** Đếm trên file: số `cc.PrefabInfo` phải **bằng** số `cc.Node`,
và `cc.Node._prefab` phải trỏ tới một `cc.PrefabInfo` có `root`/`asset`/`fileId`.

**Drift chấp nhận được:** `createPrefabAssetFromNode` **đổi tên node gốc theo tên
file**. Kiểm xem có code nào tra cứu tên đó không rồi hãy chấp nhận.

## §32. `engine.json` trống → ship cả Bullet physics 3D cho game 2D

**Triệu chứng.** Gói chính **5.80 MB**, vượt trần 4 MB của ByteDance. Console báo
`[PHYSICS]: register bullet` trong một game 2D. `Init SubSystem` mất 4.7–10 GIÂY
vì nạp wasm.

**Nguyên nhân.** `settings/v2/packages/engine.json` chỉ có `{__version__}` —
không cấu hình module nào nên 3.8 **ship TẤT CẢ**. Bản 2.x thì loại trừ tường
minh 14 module.

**Sửa.** Khai `includeModules` chỉ gồm thứ game thật sự dùng. Audit bằng grep,
đừng đoán. Kết quả thật: `cocos-js` 4.81 MB → 2.3 MB, `_virtual_cc` 2.92 → 1.7 MB,
bullet biến mất hẳn, gói chính **5.80 → 2.84 MB**.

**PREVIEW KHÔNG kiểm chứng được thay đổi này** — preview chạy engine bundle đã
build sẵn trong `scripting/engine/bin/.cache`. Phải build thật.

## §33. Builder KHÔNG tự tạo subpackage — phải có bước post-build

**Triệu chứng.** Build xong thấy 389 file **dồn hết** vào gói chính = 4.74 MB,
vượt trần. Không lỗi gì.

**Nguyên nhân.** Cocos cho một compression type mỗi bundle. Build với `merge_dep`
cho ít file nhưng **mọi thứ nằm trong gói chính**. Việc tách subpackage là bước
**sau build**, không phải tuỳ chọn của builder.

**Sửa.** Bước post-build phải làm đủ **ba** việc, thiếu một là màn hình đen:

1. chuyển `assets/<bundle>/` → `subpackages/<bundle>/`;
2. đổi tên entry `index.js` → **`game.js`** (tên nền tảng nạp cho subpackage root);
3. vá **CẢ HAI** manifest: `game.json` khoá `subpackages`, và
   `src/settings.json` khoá `assets.subpackages`.

`internal` và `main` **phải ở lại** `assets/` — `main` giữ start scene và được preload.

Script sẵn: `scripts/make-subpackages.py` (idempotent, tự đo và báo vượt trần).

**Đừng để bước này trong đầu ai đó.** Lần này nó từng được làm tay, phiên sau
không biết, suýt giao gói vượt trần.

## §34. `spine.Skeleton.setAnimation` với tên sai = im lặng → luồng đứng 🔇

**Triệu chứng.** Game dừng giữa chừng ở một bước, không lỗi.

**Nguyên nhân.** Game thường lấy `setCompleteListener` làm **nhịp điều khiển**
(hiệu ứng xong → trừ lượt → đóng panel). `setAnimation` với tên không có trên
skeleton **không ném** — nó không làm gì, listener không bao giờ bắn.

**Sửa/Phát hiện sớm.** Checker đối chiếu **binding thật**: với mỗi `sp.Skeleton`
trong prefab, resolve uuid `_skeletonData` → file, đọc danh sách `animations`,
so với mọi tên mà code gọi. Script sẵn: `scripts/verify-spine.js`.

Cảnh báo `Skeleton version 3.6.53 does not match runtime 3.8.99` chỉ là WARNING —
spine 3.8 đọc được data 3.6. Đừng để nó che mất việc kiểm tên animation.

## §35. Lỗi `raycast` / `defaultFocus` của Editor — KHÔNG phải lỗi project

**Triệu chứng.** Editor spam mỗi lần rê chuột:
`Cannot read properties of null (reading 'enabled')` tại `raycast ←
GizmoOperation.onMouseMove`, và `reading 'update'` tại `Camera.defaultFocus ←
onSceneOpened`.

**Nguyên nhân (đã dò tận nơi).** `cce.Camera._camera` là `EditorCameraComponent`
nhưng `._camera.camera` = **null**: node `Editor Camera` **kẹt lại trong scene
cũ** (`node_scene` khác scene đang mở), mất `activeInHierarchy` ⇒ `onDisable`
huỷ camera phía renderer. Một gốc, hai triệu chứng.

**Sửa.** **Restart Cocos Creator.** Không có gì để sửa trong repo.

**Tránh tái phát.** Hạn chế vòng `create_scene` / `delete_asset` / `open_scene`
liên tục trên scene đang mở. Dấu hiệu đi kèm: `director.root.cameraList` phình
dần (đo được 15 camera rò rỉ).

**Đừng đuổi theo nó như lỗi dữ liệu.** Nó tái hiện cả trên **scene rỗng 0 node** —
đó là phép thử phân biệt nhanh nhất.

## §36. Va tên khi import helper vào code đã minify

**Triệu chứng.** `tsc`: `This expression is not callable. Type 'X' has no call
signatures.`

**Nguyên nhân.** Code recover từ bundle minify dùng `t`, `e`, `n`, `o`, `i`… làm
biến cục bộ ở gần như mọi hàm. `import { t } from './I18n'` khiến `t(...)` trỏ
vào **biến local**.

**Sửa.** Dùng **namespace import**: `import * as I18n from './I18n'` rồi
`I18n.t(...)`. Áp dụng cho mọi helper thêm vào code đã recover.

Đây là lần **may**: `tsc` bắt được. Nếu biến local tình cờ là hàm thì nó sẽ chạy
sai trong im lặng.

## §37. Safe area: **cả 2.x lẫn bản port đều không có**

Nếu bản 2.x có file kiểu `MobileAdapter` ghi CSS var `--safe-top` từ
`env(safe-area-inset-*)`: kiểm lại trước khi tin. Thường thì:

- nó **thoát sớm** khi không có DOM thật ⇒ **không chạy** trong mọi runtime mini-game;
- và CSS var nó ghi **không ai đọc**.

Tức là bản gốc **không hề** xử lý notch. Trên iPhone có notch/Dynamic Island,
hàng HUD trên cùng bị che ở **cả hai** bản.

**Đây là lựa chọn sản phẩm, không phải lỗi port** — hỏi user: giữ parity, hay
thêm safe area thật (khác bản gốc).

Nếu thêm: đặt component ở **container**, cộng inset vào `Widget.top` của **các
con căn TOP**. Đừng gắn `cc.SafeArea` của engine lên root — nó resize cả container
và kéo vùng gameplay tụt xuống theo. Dùng `sys.getSafeAreaRect()` (đã ở hệ toạ độ
design) chứ không phải `screen.safeArea` (pixel vật lý).

## §38. `builder.command-build` nhận **object**, không phải chuỗi CLI

Build qua Editor đang chạy (khỏi phải đóng Editor để build CLI):

```js
await Editor.Message.request('builder', 'command-build', {
    platform: 'bytedance-mini-game', debug: false,
    buildPath: 'project://build', outputName: 'bytedance-mini-game',
});
```

Truyền chuỗi kiểu `"platform=web-mobile;debug=false"` sẽ ném
`Cannot create property 'platform' on string`. Message `builder - build` **không
tồn tại**; đọc `contributions.messages` của package `builder` nếu cần tên khác.

Sau khi đổi/di chuyển file `.ts` ngoài Editor, **`refresh_assets` trước khi
build** — asset DB còn giữ đường dẫn cũ và build sẽ fail với `ModuleNotFoundError`.

## §39. Server verify build phải gửi `Cache-Control: no-store`

Trình duyệt giữ `assets/main/index.js` của lần build trước ⇒ **bug đã sửa vẫn
trông như còn nguyên**. Mất nguyên một vòng chẩn đoán vì chuyện này.

## §40. Đổi cách port một component ⇒ phải quét lại code gọi nó 🔇

**Triệu chứng.** `Cannot set properties of null (setting 'color')` khi mở popup.

**Nguyên nhân — mâu thuẫn do chính mình tạo ra.** Script dựng prefab bỏ
`cc.LabelOutline` (3.8 deprecated) và chuyển sang `Label.enableOutline` +
`outlineColor`. Nhưng **code game vẫn gọi** `getComponent(LabelOutline).color` —
giờ trả `null`.

**Sửa.** Mỗi khi builder thay đổi cách map một component, **grep code tìm mọi chỗ
gọi component cũ** ngay trong cùng lượt. Lần này: `GrowUp.ts:102` và
`Rank.ts:117`. Và kiểm prefab đã bật `enableOutline` chưa, nếu không thì
`outlineColor` không có tác dụng.

**Bài học.** Builder và code game là **hai nửa của một hợp đồng**. Sửa một nửa mà
không quét nửa kia là tạo ra bug mới trong lúc sửa bug cũ.

## §41. Quét cả project, đừng dừng ở file đầu tiên tìm được 🔇

Bẫy `_components[0]` (§22) ban đầu chỉ được tìm thấy ở `Popup.ts`. Sửa xong,
tưởng hết. Thực tế còn **6 chỗ nữa trong `Level.ts`**, cùng một pattern, và chúng
gây đúng crash mà người dùng báo (`s.func_checkclear is not a function` — `s` là
`UITransform` chứ không phải `EliminatingStacking`).

Điều này đúng với **mọi** mục trong danh sách này: một idiom của 2.x hiếm khi chỉ
xuất hiện một lần. Quy trình: tìm được một chỗ ⇒ **grep pattern trên toàn bộ
`assets/`** ⇒ sửa hết trong cùng một lượt ⇒ ghi lại số chỗ đã sửa.

Cách sửa đúng cho lớp này: lấy component **theo class**, không theo chỉ số —
`getComponent(EliminatingStacking)` thay vì `_components[0]`.

## §42. `.d.ts` sinh ra của 3.8 thiếu một số API có thật lúc chạy

**Triệu chứng.** `tsc` báo property không tồn tại; dễ kết luận nhầm là "code port
sai" rồi đi sửa một thứ vốn đúng.

**Ví dụ thật.** `_markForUpdateRenderData` **có thật** trong runtime
(`ui-renderer.ts:431`) nhưng bị lược khỏi `.d.ts` sinh ra. Code dùng nó qua
`as any` là **đúng**, không phải bug.

**Cách xử.** Trước khi "sửa" một API mà `tsc` không thấy: tra trong **source
engine đã cài** (`resources/resources/3d/engine/`). Có trong source runtime ⇒ giữ
`as any` và ghi chú lý do ngay tại chỗ.

## §43. Khi so hai bản, ép CÙNG kích thước khung trước đã 🔇

**Triệu chứng.** Chụp hai ảnh, thấy bản 3.x "dẹt" hơn, kết luận port sai layout.

**Nguyên nhân.** `Loading.platformInit()` (logic có sẵn trong bản 2.x, port trung
thực) chọn resolution policy **theo tỉ lệ khung hình**:

```
r = round(100 × width/height)
r ≤ 57        → giữ FIXED_WIDTH (authored)
57 < r < 100  → FIXED_HEIGHT
r ≥ 100       → SHOW_ALL
```

Hai cửa sổ browser khác tỉ lệ ⇒ game **tự chọn hai policy khác nhau**. Số đo thật
của một lần so nhầm: 2.x visible `750×1334` → `r = 56` → FIXED_WIDTH; 3.x visible
`750×735` → `r = 102` → SHOW_ALL. Không có bug nào cả.

**Sửa quy trình.** Trước khi kết luận bất cứ điều gì về layout: đo `visible`,
`frame`, `scaleX/scaleY` ở **cả hai** bản và **ép về cùng khung**. `scaleX == scaleY`
ở cả hai nghĩa là view không làm méo — lệch còn lại là do khung, không phải do port.

Trang preview của Editor **khoá khung theo dropdown của nó**, nên nó không phải nơi
so sánh công bằng. Dùng bản build phục vụ trần, như bản 2.x.

## §44. Đo sai vì so ở hai thời điểm khác nhau của animation

Dump scene graph hai bên ở hai thời điểm khác nhau sẽ báo lệch `scale`/`position`
trên mọi node đang có tween `repeatForever` (mây trôi, hiệu ứng nhấp nháy). Đo
thật: **68 finding** chỉ từ một node `Floors` dao động `scaleY 1 ↔ 1.1`.

Trước khi đọc kết quả diff: loại nhóm node đang animate, hoặc dừng tween ở cả hai
bên rồi mới dump.

## §45. Đừng đụng vào cache/temp của Editor để "ép" nó nhận cấu hình

Xoá cache engine hoặc `temp/` của project để ép Editor rebuild là **đổi một vấn đề
lấy một vấn đề to hơn**: preview chết cho tới khi khởi động lại Cocos Creator, và
trong lúc đó bạn mất luôn đường kiểm chứng nhanh nhất.

Nếu đã lỡ: nói rõ với người dùng rằng **phải restart Creator**, và chuyển sang
verify bằng bản build — đừng cố chữa preview bằng cách xoá thêm thứ khác.

## §46. Rule `ask` trong `.claude/settings.json` thắng cả bypass mode

Không phải bẫy Cocos, nhưng gặp giữa lúc port nên ghi lại: bật bypass permission
mà vẫn bị hỏi allow/deny ⇒ kiểm `.claude/settings.json`, các rule `ask` vẫn được
áp dụng.

Nếu file đó là **checked-in** và `CLAUDE.md` có ghi rõ "các tool này được gate có
chủ ý" thì **hỏi trước khi bỏ gate**, và nhắc người dùng cập nhật `CLAUDE.md` cho
khớp hoặc revert. Đừng im lặng nới quyền của một file dùng chung cả team.
