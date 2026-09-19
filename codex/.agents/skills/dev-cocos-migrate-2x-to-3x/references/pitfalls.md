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

**Phát hiện sớm.** `python3 scripts/cdp.py diag --serve build/... --w 1600 --h 757`
→ so `design` với `visible`; policy sai thì `visible` khác hẳn `design`.

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

**Phát hiện sớm.** `scripts/cdp.py diag` in thẳng `viewportRect` + `rect` của mọi
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

Skill này **không dịch** (Luật vàng #7), nên ba bẫy localize kinh điển không áp
dụng — chúng nằm ở `text-language-en.md` (phụ lục, mặc định TẮT), đọc khi nào có
dự án localize riêng.

Còn lại một bẫy vẫn áp dụng: **BMFont/atlas chữ bị thiếu glyph sau khi đi qua
bước bóc asset ở GĐ1 rồi import lại vào 3.8.** Ảnh font ra đúng kích thước nhưng
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
