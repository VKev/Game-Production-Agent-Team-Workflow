# Batch protocol

Chi tiết cho `research-browser-game-batch`. Đọc khi cần schema chính xác, sửa game
lẻ, hoặc resume batch đứt giữa.

## Artifact nào là nguồn sự thật

Batch không tin văn bản, chỉ tin file mà script của `research-browser-game-mirror`
ghi ra. Với mỗi game, `batch-collect.mjs` đọc đúng 5 chỗ:

| file | lấy gì |
|---|---|
| `<slug>/evidence/engine.json` | `isCocos`, `engine`, `family`, `reason` — **cổng vào**, do `detect-engine.mjs` ghi |
| `<slug>/mirror/mirror-audit/cocos-assets.json` | `totals.remaining` → manifestMissing, cùng `totals.unresolved`, `totals.invalid` |
| `<slug>/mirror/mirror-audit/runtime-assets.json` | số asset đã mirror |
| `<slug>/evidence/runtime-verification.json` | `passed`, `counts.failedRequests`, `counts.blockingConsole`, `counts.externalRequests` |
| `<slug>/mirror/api-mock/index.json` | `counts.entries` → số fixture API đã ghi được (chỉ để báo cáo, không đổi status) |
| `<slug>/result.json` | thứ artifact không chứng minh được: lazy routes, patch, origin 404, blocked |

Thiếu `runtime-verification.json` → `pending`. Nó là bằng chứng đã có một lần
capture local, không có thì chưa có gì để chấm.

## Cổng Cocos-only

`detect-engine.mjs --network <evidence>/live-network.json` chấm engine bằng URL
pattern trong network capture — không tải thêm gì, chạy trong vài chục ms.

| exit | nghĩa | hành động |
|---|---|---|
| 0 | nhận diện được Cocos (2.x hoặc 3.x) | chạy tiếp mirror → sync → serve → verify |
| 3 | engine khác (Unity/Laya/Egret/Phaser/Construct/Godot/Defold/PlayCanvas/Pixi/Three) | dừng, `not-cocos` |
| 4 | không đủ tín hiệu để kết luận | dừng, `not-cocos` |

Quy tắc chấm: cộng weight theo family. Cocos thắng khi `cocos >= 3` **và**
`cocos >= other`. Không đạt thì engine khác thắng nếu `other >= 3`, còn lại là
unknown. Tín hiệu weight 3 là loại gần như không nhầm được (`cocos2d-js.js`,
`res/import/`, `cocos-js/*.js`, `assets/*/config.<hash>.json`, `.unityweb`,
`UnityLoader.js`, `laya.core.js`, `c2runtime.js`…); weight 2 là loại gợi ý
(`assets/*/import|native`, `application.js`, `pixi.js`).

Exit 4 cũng dừng là **có chủ ý**: chỉ đi tiếp khi nhận diện *được* là Cocos. Batch
không đoán — mirror một game đoán sai vừa tốn băng thông vừa cho kết quả không dùng
được. Game custom HTML5 không dùng engine nào cũng rơi vào đây, và theo phạm vi
Cocos-only thì đúng là phải bỏ qua.

Nghi cổng chấm sai (game Cocos bị obfuscate hết tên bundle) thì mở
`evidence/engine.json` xem `signals` và `scores`, rồi quyết định bằng tay: mirror
game đó bằng `/research-browser-game-mirror <url>` riêng, đừng nới lỏng cổng.

## `result.json` — worker ghi, batch đọc

```json
{
  "slug": "abc",
  "url": "https://portal.example/game/abc",
  "status": "complete | boot-only | failed | not-cocos | blocked",
  "engine": "cocos-2.x | cocos-3.x",
  "buildRoot": "https://cdn.example/abc/",
  "localUrl": "http://127.0.0.1:53127/",
  "lazyRoutes": ["level-select", "level-1", "level-14", "level-30", "reward", "gallery", "audio"],
  "patches": [{ "file": "index.html", "why": "stub portal SDK, SDK chặn boot" }],
  "origin404": ["bundle-extra: 404 ở cả build origin lẫn CDN"],
  "blocked": null,
  "confidence": "high | med | low",
  "todos": ["chỗ chưa chắc"]
}
```

`engine` trong `result.json` chỉ là thông tin phụ — `engine.json` mới là nguồn sự
thật cho engine và cho cổng Cocos.

- `lazyRoutes` rỗng → tối đa `boot-only`. Đừng điền tên route chưa thực sự mở.
- `blocked` là string lý do (login / DRM / paywall / origin 404 hết đường) hoặc `null`.
- `confidence` `low` nghĩa là người gọi phải rà tay game đó trước khi port.

## Suy ra status

Theo thứ tự, dừng ở điều kiện khớp đầu tiên:

1. `result.json` có `blocked` khác null, hoặc danh sách có `skip=` → **blocked**
2. `engine.json` có `isCocos: false` (hoặc `result.json` khai `status: "not-cocos"`
   khi chưa có `engine.json`) → **not-cocos**
3. Không có `runtime-verification.json` → **pending**
4. `verify.passed === false`, hoặc `cocos.totals.remaining > 0`, hoặc `unresolved > 0`,
   hoặc `invalid > 0` → **failed** (kèm danh sách lý do cụ thể)
5. Không có `cocos-assets.json` → **failed**, reason "sync-cocos-assets.mjs chưa chạy"
6. `remaining === 0` và verify pass:
   - `lazyRoutes` không rỗng → **complete**
   - `lazyRoutes` rỗng → **boot-only**

Thứ tự này quan trọng: `not-cocos` phải chấm **trước** `pending`, vì game bị chặn ở
cổng sẽ không bao giờ có `runtime-verification.json` — xếp nó vào `pending` thì
report sẽ trông như còn việc phải làm trong khi đã có quyết định.

Bước 5 là hệ quả của phạm vi Cocos-only: đã qua cổng thì mọi game đều phải có audit
manifest. Không có nghĩa là chưa sync, và đó là `failed`, không phải `boot-only`.

## Resume

`batch.jsonl` là log append-only, một JSON mỗi dòng, một dòng là một lần chấm.
Trạng thái hiện tại của một slug = **dòng cuối cùng** mang slug đó. Không sửa,
không xoá dòng cũ — lịch sử chấm là bằng chứng game đó từng fail vì gì.

```bash
# bỏ qua game đã complete, chạy tiếp phần còn lại
node scripts/batch-plan.mjs --list games/<batch>/games.txt --out games/<batch> --resume

# tính cả boot-only là xong (chỉ khi user chấp nhận không exercise lazy routes)
node scripts/batch-plan.mjs --list ... --out ... --resume --accept boot-only
```

`--resume` đọc `batch.jsonl` của chính `--out`, nên phải trỏ đúng folder batch cũ.

## Rerun một game

Không chạy lại cả batch vì một game fail.

```bash
# 1. đọc lý do
node scripts/batch-collect.mjs --out games/<batch> --report-only

# 2. sửa rồi chạy lại đúng game đó — path lấy từ plan.json
#    (worker hoặc tay, theo đúng 12 bước của skill đơn)

# 3. chấm lại
node scripts/batch-collect.mjs --out games/<batch>
```

`batch-collect.mjs` idempotent: chạy lại chỉ append dòng chấm mới, không đụng
mirror. `--report-only` thì không append gì.

## Ghi status bằng tay

Khi không có worker (fetch tay, hoặc quyết định của người):

```bash
node scripts/batch-collect.mjs --out games/<batch> \
  --lazy abc=level-select,level-1,reward \
  --blocked paid="portal yêu cầu đăng nhập, không vượt"
```

Không có cờ nào ghi đè cổng Cocos. Muốn mirror một game engine khác thì chạy
`/research-browser-game-mirror <url>` ngoài batch — cố tình không mở đường lách, vì mở ra thì phạm vi
Cocos-only mất nghĩa ngay.

Cờ dòng lệnh ghi đè `result.json` cho lần chấm đó. Dùng để sửa nhanh, không phải
để lách contract: đừng khai `--lazy` cho route chưa mở.

### Claim bền, artifact thì không

`lazyRoutes` là **claim của con người/worker** — không artifact nào phủ định được
nó, nên nó bền: đã ghi vào `batch.jsonl` thì lần chấm sau vẫn giữ, kể cả khi
`result.json` có `lazyRoutes: []`. Muốn xoá thì tường minh:

```bash
node scripts/batch-collect.mjs --out games/<batch> --lazy abc=      # xoá claim của abc
```

Ngược lại, `patches` / `todos` / `origin404` là mô tả trạng thái hiện tại: một
`result.json` mới **thay thế** hoàn toàn giá trị cũ. Bất đối xứng này có chủ ý —
sửa xong một todo thì nó phải biến mất khỏi report, còn "đã mở level-14" thì không
tự sai đi.

## Exit code

`batch-collect.mjs` exit **2** khi còn `pending`, `failed`, hoặc `boot-only`.

`blocked` và `not-cocos` **không** làm fail cổng: cả hai đã được nêu tên kèm lý do
trong report nên không phải thành công im lặng. Nếu chúng cũng fail thì một danh
sách có game `skip=` hoặc một game Unity sẽ đỏ vĩnh viễn và exit code mất hết ý nghĩa.

`boot-only` thì tính là chưa xong — đó chính là kiểu tự lừa skill này tồn tại để chặn.

## Cap song song

Mặc định 3. Mỗi worker giữ 1 Chrome headless (~300–500MB) + 1 node server. Nâng
lên chỉ khi máy đủ RAM và mạng không phải nút cổ chai — capture bị throttle mạng
sẽ làm `--wait-ms` hết hạn trước khi game boot xong, và kết quả là `failed` giả.

Mỗi game một agent context riêng, nên danh sách 10 game tốn token đáng kể. Với
danh sách dài, chia mẻ và báo user sau mỗi mẻ thì dễ kiểm soát hơn.

## Node

Cả 5 script của skill đơn cần Node ≥ 22, hai script của skill này cũng vậy. Nếu
`node -v` fail thì symlink đứt (thường sau `nvm install` bản mới):

```bash
ln -sfn ~/.nvm/versions/node/<ver>/bin/node /opt/homebrew/bin/node
```
