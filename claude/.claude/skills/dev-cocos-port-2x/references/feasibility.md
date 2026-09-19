# Thẩm định khả thi — cảnh báo sớm bằng số đo

Mục tiêu của tài liệu này: trong **giờ đầu tiên** trả lời được *"có nên port bản
build này không, và theo đường nào"* — bằng số đo, không bằng cảm nhận.

Bỏ bước này thì ước lượng và phạm vi đều không có cơ sở, và cái giá luôn trả ở
giữa dự án chứ không phải ở đầu.

## B1 — Quét tự động

```bash
python3 <skills-dir>/dev-cocos-port-2x/scripts/triage-scan.py \
        --root <THƯ-MỤC-BUILD> --out <THƯ-MỤC-BUILD>/../cocos-port-triage
```

Chỉ cần `python3`. Trả `triage.json`: `engine`, `obfuscationGrade`, `codeBundles`
(mỗi bundle có `kind`: game / vendor / duplicate), `manifestClosure`, `bundles`,
`scenes`, `effects`, `risks`, `networkHosts`, `size`.

**Ghi kết quả ra NGOÀI thư mục build.** Bản mirror là nguồn đối chiếu duy nhất
cho bước verify — giữ nguyên trạng.

Đọc `triage.json` rồi **tự kiểm chéo 2–3 con số quan trọng nhất bằng tay**
(grep/python) trước khi tin. Script là công cụ đo, không phải trọng tài.

## B2 — Engine nào → nhánh nào

| Phát hiện | Nhánh |
|---|---|
| `.meta` + `.ts/.js` trong `assets/` + `project.json` | **Đây là SOURCE PROJECT, không phải build.** Bỏ hết recon. Đã là 3.x thì chỉ upgrade minor |
| `window._CCSettings` trong `src/settings*.js`, `ENGINE_VERSION="2.x"`, scene `.fire` | **Cocos Creator 2.x** → đúng nhánh của skill này |
| `src/settings.json`, `application.js`, `chunks/`, `ENGINE_VERSION="3.x"` | **Cocos Creator 3.x** → dùng `/dev-cocos-port-3x`, rẻ hơn hẳn. Nói rõ điều này, nó thường đảo ngược quyết định đầu tư |
| `.jsc`, `jsb.*`, không có JS đọc được | **bytecode** → xem L4 |
| `UnityLoader.js`, `laya.core.js`, `egret.js`, `phaser.js` | **không phải Cocos** → skill này không áp dụng, dừng |

Version chính xác lấy từ `ENGINE_VERSION` trong file engine, hoặc gõ
`cc.ENGINE_VERSION` ở console bản chạy local — cách sau chắc hơn.

## B3 — Chạy thử: cổng NGƯỜI, không tự vượt được

```bash
# chạy trơn
python3 <skills-dir>/dev-cocos-port-2x/scripts/serve-local.py --root <BUILD> --port 0

# màn đen mà không báo lỗi → gần như luôn là SDK nhà phát hành treo Promise
python3 <skills-dir>/dev-cocos-port-2x/scripts/serve-local.py --root <BUILD> --port 0 \
        --stub --watchdog --sdk-global <TÊN_SDK_TOÀN_CỤC>

# build portrait mở trên desktop ngang → vào /play.html thay vì /index.html
python3 <skills-dir>/dev-cocos-port-2x/scripts/serve-local.py --root <BUILD> --port 0 \
        --stub --portrait 9:16
```

Bốn cái bẫy, theo thứ tự hay gặp:

1. **`file://` không chạy được** — build web Cocos bắt buộc qua HTTP.
2. **SDK nền tảng treo** → màn đen, không lỗi. Bật `--stub` rồi gõ
   `__triageSdkReport()`: lời gọi **cuối cùng** trong bảng chính là chỗ game đang chờ.
3. **Build portrait trên màn hình ngang** → `resizeWithBrowserSize` thổi UI to
   gấp mấy lần, trông như game hỏng nhưng không phải. Dùng `--portrait`.
4. **Audio cần user gesture** — engine 2.x chờ click đầu tiên mới init audio.

### Checklist bàn giao (người dùng tick, đừng tự tick)

- [ ] Boot tới được menu chính
- [ ] Vào được **1 màn gameplay**, chơi hết **1 round tới thắng/thua**
- [ ] Màn hình kết quả + phần thưởng hiện đúng
- [ ] Quay lại menu, vào lại được **màn thứ 2** (loại trừ lỗi chỉ-chạy-lần-đầu)
- [ ] Thử **1 luồng meta** (shop / nâng cấp / túi đồ)
- [ ] Chụp màn hình mỗi bước — bước verify sẽ so lại với đúng những ảnh này
- [ ] Ghi lại **cái gì KHÔNG vào được** và vì sao (SDK? server? nút bị khoá?)

Mục cuối quan trọng nhất: nó chính là **ranh giới phạm vi port**. Feature không
vào được từ UI thì hoặc là code chết, hoặc phụ thuộc backend — cả hai đều không
nên port lúc này.

Ít nhất 4 mục đầu được tick thì mới được kết luận GO.

## B4 — L3 và L4: hai chỗ dự án chết

**L3** — phân tích tĩnh vô dụng, runtime là nguồn duy nhất. Nghĩa là: **bản gốc
không chạy được thì L3 tự động thành L4.** Đừng nhận dự án L3 khi chưa qua được
B3 — bạn sẽ phải đoán thân method, và đoán sai thì sai âm thầm.

**L4** — code đã mất. Yếu tố quyết định không còn là kỹ thuật:

1. **Xin source từ chủ sở hữu / studio gốc.** Luôn thử trước, luôn rẻ hơn mọi
   phương án còn lại một bậc độ lớn.
2. **Giữ asset, viết lại gameplay.** Asset (ảnh, atlas, audio, DragonBones, data
   JSON) bóc được **mà không cần code**. Số liệu cân bằng thường cũng nằm trong
   JSON/binary. Chi phí ≈ làm game mới, nhưng art + data + design đã có sẵn — với
   game nhỏ đây thường là đường rẻ nhất.
3. **Giải mã `.jsc`.** Kỹ thuật làm được (XXTEA, key nằm trong binary) nhưng đây
   là **bẻ cơ chế bảo vệ** — chỉ làm khi bên bạn sở hữu game và đã mất source.
4. **Huỷ.** Nếu (1) bất khả, (2) không đáng tiền, (3) không được phép — nói thẳng.

## B5 — Sáu trục rủi ro

Chấm thấp / vừa / cao cho từng trục, **mỗi trục kèm số đo**, không kèm tính từ suông.

| # | Trục | Đo bằng | Cao khi |
|---|---|---|---|
| 1 | Đọc được code | mức L0–L4 | ≥ L3 |
| 2 | Đủ asset | `manifestClosure` | thiếu > 0 file → mirror lại **trước** khi làm gì khác |
| 3 | Phụ thuộc server | `risks.websocket` / `risks.protobuf` + `networkHosts` | tiến độ/kinh tế/PvP trên server mà không có backend |
| 4 | Khối lượng dựng lại | số scene + prefab + class | > ~100 prefab, hoặc > ~150 class |
| 5 | Shader / native riêng | `effects.custom`, `risks.nativeJsb` | > 5 shader riêng (format effect 2.x ≠ 3.x, phải viết tay từng cái) |
| 6 | Code chết | class có trong bundle nhưng **không** xuất hiện lúc chạy | thường ~30% |

Trục 3 hay bị bỏ sót nhất và đắt nhất. Nếu login / lưu tiến độ / shop / xếp hạng
đều đi qua server thì **port client xong vẫn không có sản phẩm** — trừ khi chốt
phạm vi là "bản offline, dữ liệu API giả", đúng thứ mà lớp `ApiMock` của skill
này làm được. Nói rõ backend thật là **một dự án riêng**.

Trục 6 đo bằng cách đối chiếu danh sách class trong bundle với class thật sự được
đăng ký lúc chạy (`runtime-api.json`). Không có dữ liệu runtime thì ghi `[U]`.

## B6 — Font (không đo localize — pipeline KHÔNG dịch)

```bash
grep -rl "labelAtlas\|\.fnt\|bmfont" <build> | head
```

| Đo | Vì sao quan trọng |
|---|---|
| BMFont hay TTF | BMFont là **ảnh + metric**: bóc rồi import lại rất dễ thiếu glyph hoặc lệch metric → chữ ra ô trống / mất hẳn, **không báo lỗi** |
| số **ảnh có chữ vẽ sẵn** | không phải dịch, nhưng là ảnh phải bóc đúng — thuộc nhóm rủi ro crop sai texture |

## B7 — Quyết định + ước lượng

**NO-GO** nếu bất kỳ điều nào đúng: L4 và không xin được source · bản gốc không
chơi được sau khi stub SDK **và** mức ≥ L3 · logic quyết định nằm trên server mà
phạm vi không thu về được bản offline.

**GO CÓ ĐIỀU KIỆN**: L3 mà bản gốc chạy được (điều kiện: giữ được môi trường chạy
bản gốc suốt dự án) · manifest thiếu file (mirror lại trước) · chưa qua checklist B3.

**GO**: L0–L2 + asset đủ + người dùng đã chơi thử OK + phạm vi rõ.

Ước lượng — đưa **khối lượng đếm được** trước, hệ số sau:

- class × hệ số obfuscation — mốc thô: 1 class L1 ≈ 0,5–1 ngày-người khi có AI
  hỗ trợ (agent `cocos-port-class` fan-out song song)
- prefab/scene ≈ 0,25–0,5 ngày mỗi cái
- shader riêng ≈ 1–2 ngày mỗi cái (viết tay, không dịch máy được)
- backend: **để riêng**, không gộp vào con số port

Rồi nói thẳng: con số này là **bậc thô**. Cách duy nhất để có số thật là **port
thử 10 class rồi đo lại** — đưa việc đó vào kế hoạch như một cột mốc chính thức.
Đừng cam kết deadline dựa trên GĐ0.
