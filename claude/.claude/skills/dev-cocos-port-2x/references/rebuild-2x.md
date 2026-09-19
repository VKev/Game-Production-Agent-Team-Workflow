# GĐ2 — Dựng XONG một project Cocos Creator 2.4.x chạy được

Mục tiêu **không phải** chỉ là có source đọc được. Mục tiêu là **một project
Cocos Creator 2.4.x hoàn chỉnh, mở được trong Editor 2.4.14 và chơi được**, rồi
người dùng xác nhận. Đây là giai đoạn dài nhất và là nền của mọi thứ sau nó.

> **Vì sao phải hoàn thiện bản 2.x trước, không nhảy thẳng sang 3.x?** Vì ba
> việc khác nhau sẽ bị gộp: (a) *hiểu code làm gì*, (b) *đổi API*, (c) *dựng lại
> scene/prefab*. Gộp lại thì khi game sai bạn không có cách nào biết do hiểu sai
> logic, dịch sai API, hay dựng sai scene — và đó là loại bug tốn nhiều ngày nhất.
>
> Hoàn thiện 2.x trước cho bạn hai thứ không mua lại được:
> 1. **Bằng chứng logic đúng** — chạy được ở 2.4.x nghĩa là phần tái dựng đã
>    đúng; sang GĐ3 chỉ còn đúng một biến số là API.
> 2. **Ground truth sống cho GĐ4** — một project mở được trong Editor 2.4.14, có
>    scene/prefab thật để `inspect` từng property, thay vì tra JSON dump.

⛔ **Cổng ra — đây là cổng NGƯỜI, giống GĐ0:**

1. Project 2.4.x **mở được** trong Cocos Creator 2.4.14, không lỗi đỏ trong Console.
2. Preview hoặc build web **chạy được**: boot → menu → vào được gameplay.
3. **NGƯỜI DÙNG chơi thử và xác nhận** gameplay đúng như bản gốc.
4. Mọi class đã tái dựng; không còn ký hiệu obfuscate trong **code** (`ft`, `fw`,
   `a[12]`, biến 1-2 ký tự vô nghĩa); mỗi file có `confidence` được ghi nhận.

**Chưa qua cổng này thì không viết một dòng 3.x nào.** Sang GĐ3 sớm là tự nguyện
nhận thêm một biến số vào một bài toán còn chưa giải xong.

---

## Cách chạy: fan-out bằng agent `cocos-port-class`

Một class một agent, chạy song song. Agent nhận `MODE=recon` và trả JSON
structured (`{class, file, methodsWritten, properties, requires, todos, confidence}`).

Thứ tự nên làm:

1. **Nền móng trước** — enum/const, singleton registry, base class của layer/UI.
   Các class khác phụ thuộc vào chúng. Tái dựng 3–5 file này **bằng tay, cẩn
   thận**, rồi dùng làm *exemplar* trong prompt cho agent.
2. **Manager** (data, res, audio, pool, UI, game) — nơi giữ state.
3. **Gameplay component** — phần đông nhất, fan-out được.
4. **UI layer** — thường lặp pattern, port nhanh.

## Nguồn, theo thứ tự ưu tiên

1. `runtime-methods-decoded/<Class>.js` — **thân method thật**. Nguồn CHÍNH nếu có.
   Mỗi method dạng `// <Class>.<method>` rồi `function(...) {...}`.
2. `game.readable.js` — thân module đầy đủ: import, `properties`, `__decorate`,
   lifecycle. Tìm bằng:
   ```bash
   grep -n '"<Class>"' analysis-output/game.readable.js | grep -i push
   ```
   Module bắt đầu từ dòng đó, đọc ~150–400 dòng tới `cc[..]["pop"]()`.
3. `runtime-scene-component-state.json` — giá trị property **thật lúc chạy**,
   dùng làm default khi không chắc.

Nguồn 1 cho *thân hàm chuẩn*, nguồn 2 cho *khai báo + import*. Cần cả hai.

## Quy tắc giải obfuscation

- `var a = ft, b = a[11];` → **BỎ**. `ft` là string-table; thay `b` bằng chuỗi
  thật. Method đã decode thường inline sẵn (`"node"`, `"screws"`) — giữ nguyên.
- `this["node"]["getComponent"](...)` → `this.node.getComponent(...)`.
  Chuyển hết `x["y"]` → `x.y` khi key là identifier hợp lệ.
- Hằng string-table hay gặp: các alias 2 ký tự cho `"x"`, `"y"`, `"%"`... Tra
  bằng ngữ cảnh (`cc.v2(a[QE], a[IR])` → `cc.v2(a.x, a.y)`). Gom vào một bảng
  `knownGlobals` dùng chung cho cả dự án (xem `decode-methods.mjs`).
- **Không được để sót** `ft`, `a[<số>]`, biến vô nghĩa trong output. Không giải
  được đoạn nào thì để `// TODO(recon): <đoạn gốc>` + comment rõ, và hạ
  `confidence`.
- `__generator` / `regeneratorRuntime` (async đã transpile) → viết lại bằng
  `async/await` hoặc Promise thường, **giữ đúng thứ tự side-effect**.

## Cấu trúc file 2.4.x

```js
// Component
cc.Class({
    extends: cc.Component,          // hoặc require("BaseLayer").default
    properties: {
        node1: cc.Node,
        lbl:   cc.Label,
        arr:   { default: [], type: cc.Node },
        num:   0,
    },
    onLoad() {}, start() {}, update(dt) {},
});
```
Module tĩnh/enum/util (không extends Component) → `module.exports = {...}`.

### Import — chỗ sai nhiều nhất
Đọc dòng import trong module readable: `X = a("../GbzEnum"), Y = a("../manager/GbzData")`.

- Nếu tái dựng **làm phẳng** vào một thư mục `scripts/` thì require theo **tên
  file**, bỏ path: `a("../manager/GbzData")` → `require("GbzData")`.
- Style truy cập quyết định cách require:
  - gốc dùng `X["default"]["method"]` → `var X = require("X").default;`
  - gốc dùng `X["SOME_ENUM"]` trực tiếp → `var X = require("X");`

### properties từ `__decorate`
Cuối module readable có `__decorate([g(cc["Node"])], e[proto], "propName", void 0)`.
`g`/`h`/`r` là alias của `property`. Dịch:

| decorate | properties |
|---|---|
| `g(cc["Node"])` | `propName: cc.Node` |
| `g([cc["Node"]])` | `arr: { default: [], type: cc.Node }` |
| `g()` trên field số | `num: 0` |

Không chắc kiểu → `{ default: null, type: cc.Node }` + comment, hạ confidence.

## Gom thành project 2.4.x thật

Source đọc được chỉ là một nửa. Nửa còn lại là asset + scene + prefab, và phải
đặt sao cho Editor 2.4.14 mở ra là chạy.

```text
cocos-project-2x/
  assets/
    scripts/          ← output tái dựng ở trên
    resources/        ← GIỮ NGUYÊN đường dẫn logic của bản gốc
    <bundle>/         ← mỗi bundle của bản gốc một thư mục
  settings/
  project.json        ← engine 2.4.14
```

### Luật quan trọng nhất: GIỮ NGUYÊN đường dẫn logic

Code gốc gọi `cc.resources.load('djson/hero_list')`, `cc.loader.loadRes('theme/bg')`.
Nếu cây thư mục khớp **y hệt** bản gốc thì không phải sửa một chuỗi đường dẫn nào
— và sang GĐ3 cũng chỉ đổi `cc.resources` → `resources`, không phải rà lại hàng
trăm chỗ. Đặt lại tên cho "gọn" ở đây là tự tạo ra một lớp bug đường dẫn phải
truy suốt phần còn lại của dự án.

### Nguồn của từng thứ

| Cần | Lấy từ |
|---|---|
| Script | output tái dựng của GĐ2 |
| Asset (ảnh, audio, spine, particle) | `extracted-assets/` của GĐ1 bước 5 |
| Cấu trúc scene / prefab | dump cây node bằng engine sống — `recon.md` §6 |
| Giá trị property | `runtime-scene-component-state.json` (GĐ1 bước 4) |

Scene/prefab là phần tốn công nhất. **Đừng tự viết deserializer cho định dạng
`import/*.json`** — dùng cách của `recon.md` §6: chạy bản mirror, để
chính `cc` đang sống `load` + `instantiate` rồi duyệt cây và `JSON.stringify`.
Engine đã resolve sẵn mọi uuid → asset, nên bạn nhận được cấu trúc đúng thay vì
đoán format serialize.

Game nhỏ (≲10 scene) thì dựng scene bằng tay trong Editor 2.4.14 theo dump đó là
nhanh nhất. Game nhiều prefab đều nhau thì viết script sinh — và **chốt luôn ở
đây** việc giữ prefab hay chuyển sang JSON compact + builder runtime, vì để tới
GĐ6 mới quyết là phải làm lại (xem bảng "ba quyết định chốt sớm" trong `SKILL.md`).

## Kiểm trung gian trong lúc làm

Ba việc này **không thay được cổng ra** (cổng ra là người dùng chơi thử), nhưng
dùng để biết mình đang đi đúng trong lúc còn đang tái dựng:

- `node --check` từng file — cú pháp hợp lệ.
- Đối chiếu danh sách method của mỗi class với `runtime-class-summary.json` —
  thiếu method = tái dựng sót.
- Soát sót obfuscation:

```bash
python3 - <<'EOF'
import re, pathlib, sys
# Bắt table-access kiểu obfuscate: định danh 1-2 ký tự + chỉ số số học
# (ft[12], a[45], fw[7]) — KHÔNG bắt `myArray[10]` hợp lệ.
PAT = re.compile(r'\b(ft|fw)\b|\b[A-Za-z_$][A-Za-z0-9_$]?\[\d+\]')
bad = 0
for p in sorted(pathlib.Path('cocos-project-2x/assets/scripts').rglob('*.js')):
    src = p.read_text(encoding='utf-8', errors='replace')
    # Lược comment TRƯỚC khi soi: `// TODO(recon): <đoạn gốc>` là cách thoát
    # ĐƯỢC PHÉP và nó chứa đúng ký hiệu obfuscate — soi cả comment thì cổng
    # báo lỗi trên file làm đúng hướng dẫn.
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    src = re.sub(r'//[^\n]*', '', src)
    for i, line in enumerate(src.splitlines(), 1):
        if PAT.search(line):
            print(f'{p}:{i}: {line.strip()[:100]}'); bad += 1
print(f'\n{bad} chỗ còn ký hiệu obfuscate (đã bỏ qua comment)')
sys.exit(1 if bad else 0)
EOF
```
