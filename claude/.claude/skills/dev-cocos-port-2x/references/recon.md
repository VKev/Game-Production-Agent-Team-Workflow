# GĐ1 — Recon: từ bản build đóng gói → bằng chứng đọc được

Mục tiêu: biến một thư mục JS đã minify+obfuscate thành **bốn loại bằng chứng**
mà các giai đoạn sau dựa vào:

| Bằng chứng | File | Dùng ở đâu |
|---|---|---|
| Source đọc được | `game.readable.js` | GĐ2 tái dựng class |
| Thân method thật lúc chạy | `runtime-methods-decoded/<Class>.js` | GĐ2 (nguồn CHÍNH) |
| Inventory class + state runtime | `runtime-api.json`, `runtime-scene-component-state.json` | GĐ2, GĐ4 (giá trị property chuẩn) |
| Asset | `extracted-assets/` | GĐ4 |

⛔ **Cổng ra GĐ1:** bản mirror chạy offline được + có đủ 4 loại trên.

---

## 1. Mirror bản live về máy

Nếu game đang chạy trên web: mở bằng Chrome headless có ghi network, đi hết
luồng (menu → chơi thử 1-2 màn) để **kích hoạt lazy-load bundle**, rồi tải mọi
URL đã thấy về theo đúng cây thư mục.

```bash
# 1. bắt network + console + screenshot của bản live
python3 scripts/cdp.py capture --url https://<game>/ --out live --wait 25
# 2. tải mọi URL trong live.network.json về ./mirror/ giữ nguyên path
```

Điểm chết người: **bundle con (subpackage) chỉ tải khi vào tới màn dùng nó.**
Mirror thiếu subpackage = mất nguyên mảng gameplay mà không hề biết. Đối chiếu
số file tải được với `config.*.json` của từng bundle (mỗi bundle có manifest
liệt kê uuid asset của nó).

Nếu game là **WeChat/Douyin minigame** (có `game.json` + `project.config.json`)
thì đã có sẵn cây thư mục — bỏ qua bước mirror, đi thẳng bước 2.

## 2. Làm cho bản mirror CHẠY offline (bước bị đánh giá thấp nhất)

Bản gốc gần như luôn kẹt vì gọi SDK nền tảng (login, portal, ad, share) mà
offline không có. Triệu chứng: **màn đen, không lỗi** — vì SDK trả Promise không
bao giờ resolve.

**Dùng `scripts/serve-local.py` — nó đã làm sẵn ba việc đầu**, đừng viết tay lại:

```bash
python3 scripts/serve-local.py --root ./mirror --port 8124 \
        --stub --watchdog --portrait 9:16
#  màn đen mà không báo lỗi → mở console, gọi __triageSdkReport()
#  lời gọi cuối trong report chính là chỗ đang treo
```

| Cờ | Làm gì |
|---|---|
| `--stub` | shim `wx`/`tt`/`swan`/`qq` bằng Proxy bắt-tất: mọi hàm SDK trả Promise **đã resolve** và gọi cả `success`/`complete`. Trả `undefined` là treo — code gốc thường `.then()` thẳng vào kết quả |
| `--sdk-global` | thêm global riêng của nhà phát hành (SDK portal, không phải `wx`/`tt`) |
| `--watchdog` | không có frame nào sau N giây → in ra chỗ đang chờ |
| `--portrait W:H` | mở thêm `/play.html` bọc game trong khung dọc |

Nó cũng trả **MIME đúng** + `Content-Encoding` cho file `.br`/`.gz` nén sẵn và hỗ
trợ **HTTP Range** — `python3 -m http.server` thì không, và đó chính là kiểu lỗi
làm Cocos boot ra màn đen. **Bản web Cocos không mở được bằng `file://`.**
`serve-local.py` không ghi đè file nào trong thư mục build.

Việc duy nhất còn phải làm tay: **audio unlock** — engine 2.x chờ user gesture mới
init audio nên headless sẽ treo. Ép `cc.audioEngine._maxAudioInstance`/unlock thủ
công, hoặc mute toàn bộ.

> Đây là điều kiện tiên quyết: không chạy được bản gốc thì mọi so sánh ở GĐ5
> đều vô nghĩa, và bạn sẽ không có `runtime-api.json`.

## 3. Decode bundle → JS đọc được

Bundle 2.4 build production thường có **string-table** (một mảng chuỗi lớn, mọi
chuỗi trong code thay bằng `ft[123]`) và đôi khi **number-table**. Đây là dạng
obfuscation phổ biến nhất và giải được hoàn toàn bằng phân tích tĩnh.

```bash
# b1: tách bảng ra khỏi bundle (bằng tay hoặc vm.runInNewContext) → string-table.json / number-table.json
# b2: inline mọi tham chiếu bảng thành literal
node scripts/decode-bundle.mjs \
    --input  analysis-output/game.decoded.js \
    --strings analysis-output/string-table.json \
    --numbers analysis-output/number-table.json \
    --output analysis-output/game.readable.js
```

Script dùng Babel: nó **đánh giá tĩnh** mọi `MemberExpression` computed mà cả
object lẫn property đều truy được về hằng, rồi thay bằng literal. An toàn vì chỉ
thay khi biết chắc giá trị.

Cách lấy bảng: tìm khai báo mảng chuỗi lớn nhất trong bundle
(`grep -o "var ft=\[" `), cắt ra file riêng, `node -e "..."` để `JSON.stringify`.

**Nếu decode không ra chuỗi đọc được** → obfuscator khác (control-flow
flattening, string encryption có key runtime). Lúc đó phải chuyển sang nguồn
runtime (bước 4) làm nguồn chính, và báo cho người dùng biết chi phí tăng.

## 4. Bắt thân method từ runtime sống (nguồn CHÍNH, chính xác nhất)

Phân tích tĩnh cho bạn *cấu trúc*; runtime cho bạn **sự thật**. `Function.prototype.toString()`
trả về source thật của mọi method đang chạy — kể cả khi bundle đã bị xáo trộn.

Dán `scripts/runtime-api-export.js` vào console bản mirror đang chạy (hoặc nạp
qua `?analysisApi=1`). Nó xuất:

- danh sách class đăng ký trong engine (`cc.js._registeredClassIds` / `getClassByName`)
- mỗi class: danh sách method + **source `toString()`** của từng method
- mọi component trong scene hiện tại + **giá trị property thật** của chúng
- `cc.ENGINE_VERSION`, designResolution, danh sách bundle đã nạp

```bash
# tách kết quả thành file per-class
node scripts/split-runtime-api.mjs --input analysis-output/runtime-api.json --out analysis-output
# giải string-table trong thân method
node scripts/decode-methods.mjs --in analysis-output/runtime-methods \
     --out analysis-output/runtime-methods-decoded \
     --strings analysis-output/string-table.json --numbers analysis-output/number-table.json
```

Mẹo: chạy export ở **nhiều thời điểm** (menu, đang chơi, thắng màn) rồi hợp
nhất — mỗi màn hình nạp một tập class khác nhau.

`runtime-scene-component-state.json` là thứ quý nhất cho GĐ4: nó là **giá trị
property đúng của từng component trong scene thật**, dùng làm đích khi dựng lại
prefab.

## 5. Bóc asset

```bash
python3 scripts/extract-cocos24-assets.py --root <thư-mục-build> --out extracted-assets \
        --bundle subpackages/MainBdl:MainBdl --bundle subpackages/main:main
```

Xử lý được: texture standalone, **SpriteFrame crop từ atlas** (kể cả rotated +
trimmed offset), Spine (`.json` + `.atlas` + png, tự đổi tên `<n>.skeleton.json`
→ `<n>.json` cho Creator nhận), ParticleSystem `.plist`, audio.

Kiểm chéo: số asset bóc được phải khớp số entry trong `config.*.json` của bundle.
Thiếu → mirror thiếu file (quay lại bước 1).

### ⚠ Cổng kiểm BẮT BUỘC sau khi bóc asset — đừng bỏ

Ba loại sai của bước này **im lặng hoàn toàn**: không exception, không warning,
ảnh vẫn ra đúng kích thước. Đã gây bug thật ở game tank (xem `pitfalls.md`).

1. **`_by_name/` phải gần như rỗng.** Còn nhiều file ở đó nghĩa là uuid của
   section không tra được đường dẫn logic. Chỉ frame con bên trong
   `cc.SpriteAtlas` mới hợp lệ nằm đây (chúng vốn không có path riêng).
2. **Nội dung phải khớp bản dựng lại theo uuid.** Cách kiểm: với mỗi
   `cc.Texture2D` trong `config.paths`, mở file `native/` của nó và so **hash
   pixel RGBA** với file đã bóc ở cùng đường dẫn. Lệch = đang bóc sai texture
   hoặc ghi bản crop thay ảnh gốc.
3. **Ảnh rời phải là ảnh GỐC, không phải bản crop.** Nếu `rawWidth/rawHeight`
   trong `.meta` mà Creator sinh ra bằng đúng kích thước ảnh và `offsetX/offsetY`
   đều bằng 0 với MỌI ảnh, thì gần chắc là đang ghi bản đã cắt viền — sprite
   dùng `SizeMode.RAW` sẽ lệch vài pixel.

Tham chiếu một bộ kiểm đã dùng thật:
`source-tank-oi-tien-len-port-docs/recon/tools/remap-unmapped-assets.py --verify`.

## 6. Xuất dữ liệu level / config

Level thường nằm trong prefab hoặc JSON trong bundle. Cách chắc ăn nhất **không
phải** tự viết deserializer, mà là **để engine tự làm**: chạy game local, dùng
chính `cc` đang sống để load prefab rồi `cc.instantiate` + duyệt cây, `JSON.stringify`
kết quả ra rồi POST về một server nhỏ trên máy.

```js
// dán vào console bản mirror đang chạy
cc.assetManager.getBundle('MainBdl').load('prefabs/levels/lv_1', cc.Prefab, (e, p) => {
  const n = cc.instantiate(p);           // engine tự resolve mọi tham chiếu
  fetch('http://127.0.0.1:8125/save?path=lv_1.json',
        {method:'POST', body: JSON.stringify(dumpTree(n))});
});
```

Ưu điểm: mọi tham chiếu uuid → asset đã được engine resolve sẵn, không phải tự
đoán format serialize của Cocos.

## 7. Chốt phạm vi bằng bằng chứng

Trước khi sang GĐ2, viết một bản tóm tắt thiết kế **có nhãn bằng chứng**:

- core loop, điều kiện thắng/thua, kinh tế, tiến trình — mỗi khẳng định gắn
  `[R]` runtime / `[D]` decoded / `[S]` static asset / `[I]` suy luận / `[U]` chưa rõ.
- **Danh sách feature CHẾT** (có code nhưng không có đường vào từ UI, hoặc bị
  cờ tắt): ghi rõ để **không port**. Trong một dự án thật, code chết chiếm ~30%
  số class — port hết là phí đúng chừng đó công.

Bản tóm tắt này chính là spec cho GĐ2–GĐ3, và là thứ bạn đưa cho người ra
quyết định để chốt phạm vi.
