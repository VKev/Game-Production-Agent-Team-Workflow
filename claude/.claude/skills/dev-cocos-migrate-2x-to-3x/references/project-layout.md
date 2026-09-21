# GĐ1 — Bản đồ project: skill này KHÔNG có path mặc định

Mỗi project Cocos xếp thư mục một kiểu. `assets/Script`, `assets/scripts`,
`assets/src`, hay chia thành nhiều bundle (`assets/framework`, `assets/game`,
`assets/local`…) — cả bốn đều gặp thật. Vì vậy **không dòng nào trong skill này
được phép giả định một đường dẫn trong project của bạn**.

Luật: đo trước, rồi mới nói tên thư mục.

```bash
node <skills-dir>/dev-cocos-migrate-2x-to-3x/scripts/probe-cocos-layout.js <PROJECT-2X> --out <work>/layout-2x.json
node <skills-dir>/dev-cocos-migrate-2x-to-3x/scripts/probe-cocos-layout.js <PROJECT-3X> --out <work>/layout-3x.json
```

Chạy lại **mỗi khi tạo thư mục mới** trong project 3.x. Hai file JSON đó là thứ
duy nhất được phép dùng làm nguồn đường dẫn — cho bạn, và cho agent port ở GĐ2
(nó đọc file, không tự đi dò lại).

> `<skills-dir>` là `.agents/skills/` (Codex) hoặc `.claude/skills/` (Claude
> Code) trong chính project, rồi mới tới `~/.codex/skills/` / `~/.claude/skills/`.
> Script của skill **luôn** gọi qua `<skills-dir>`, đừng gọi `scripts/...` tương
> đối — cwd của bạn không phải thư mục skill.

## Bảng placeholder — dịch từ output của probe

| Placeholder | Lấy từ | Sai thì sao |
|---|---|---|
| `<assets-root>` | `assetsRoot` | — |
| `<script-root>` | `scriptRoots[]` (có thể **nhiều**) | đặt code sai bundle ⇒ boot không thấy class |
| `<resources-root>` | `resourcesDirs[]`, có thể **rỗng** | `resources.load(path)` fail im lặng |
| `<bundle>` | `bundleDirs[]` + `name` + `priority` | nạp sai thứ tự, asset nằm nhầm gói |
| `<scene-ext>` | `.fire` (2.x) ↔ `.scene` (3.x) | — |
| `<build-dir>` | `buildOutputs[]` | đo dung lượng trên thư mục không phải bản build |
| `<extensions-dir>` | `extensions/` (3.x) ↔ `packages/` (2.x) | cài extension vào chỗ Editor không đọc |
| `<work>` | bạn chọn, **ngoài** `assets/` | file rác trong `assets/` ⇒ Editor import, vào cả bản build |

`<work>` là thư mục nháp của chính lần migrate này (layout JSON, dump verify,
screenshot, brief cho agent). Đặt nó **ngoài** `assets/` — mọi thứ trong `assets/`
đều được Editor import và đi vào bản build.

## Nhiều script root là chuyện thường — đừng dồn lại một chỗ

Probe in ra danh sách script root kèm nhãn bundle. Nếu bản 2.x chia code theo
bundle thì **giữ đúng cách chia đó** ở bản 3.x:

- Bundle là **đơn vị nạp**, không phải thư mục cho gọn. Dồn `assets/framework` +
  `assets/game` vào một `assets/scripts` là đổi thứ tự nạp của game — lỗi sẽ ra ở
  bản build dưới dạng "class chưa được định nghĩa lúc boot", không ra ở preview.
- `priority` trong `.meta` của thư mục bundle quyết định bundle nào vào gói chính.
  Xem `dev-cocos-port-2x/references/minigame-platform.md` §2.6: asset nằm nhầm
  gói chính hầu như luôn là do `priority`.
- Tên bundle là **hợp đồng với code**: `assetManager.getBundle('<name>')` tra theo
  tên, không theo đường dẫn. Đổi tên thư mục mà không đổi tên bundle (hoặc ngược
  lại) là một lỗi runtime im lặng.

## `resources/` có thể KHÔNG tồn tại

`resources.load('path')` ở 3.x **chỉ** đọc được `assets/resources`. Rất nhiều
project 2.x không có thư mục đó — chúng nạp qua bundle. Probe báo
`resourcesDirs: []` thì có hai lựa chọn, chọn ngay ở GĐ1:

1. Giữ nguyên mô hình bundle: `assetManager.loadBundle(name)` →
   `bundle.load(path)`. Đây là bản dịch đúng 1-1 của `cc.assetManager` ở 2.4.
2. Tạo `assets/resources` rồi chuyển asset vào — chỉ làm khi asset đó thật sự
   được nạp theo path lúc chạy, và **chạy lại probe** sau khi tạo.

Đừng viết `resources.load(...)` khi probe chưa hề báo có `resources/`.

## Lớp runtime bắt buộc phải nằm trong bundle nạp lúc BOOT

`ApiMock` / `FakeAds` / `MobileAdapter` (GĐ4) phải ở trong `<script-root>` thuộc
**bundle nạp ngay khi boot** — thường là code không bundle (gói chính) hoặc bundle
có `priority` cao nhất. Đặt chúng trong một subpackage tải sau: lớp chặn `fetch`
được vá **sau** khi game đã gọi API lần đầu, và lỗi hiện ra dưới dạng "thỉnh
thoảng mất mạng là đứng", không tái hiện đều.

Probe in sẵn mục `runtime layer:` — nếu project 2.x đã có ba file đó (do
`dev-cocos-port-2x` dựng) thì GĐ2 **port chúng như mọi class khác**, đừng copy
template đè lên.

## Kiểm trước khi rời GĐ1

- [ ] `layout-2x.json` + `layout-3x.json` đã ghi, không còn WARNING nào chưa trả lời
- [ ] Chốt được: mỗi `<script-root>` của bản 2.x sẽ thành thư mục nào ở bản 3.x
- [ ] Chốt được: nạp bằng `resources` hay bằng bundle
- [ ] Biết design resolution + `fitWidth`/`fitHeight` thật của bản 2.x (probe đọc
      từ `settings/project.json`; bật **cả hai** là bug gốc, phải chốt một policy)
- [ ] `<work>` nằm ngoài `assets/`
