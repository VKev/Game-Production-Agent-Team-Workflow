# GĐ3 — Dựng lại scene & prefab

Script đã compile sạch nhưng chưa có gì để chạy: scene, prefab, và **wiring**
(node nào gắn component nào, `@property` trỏ vào đâu) vẫn là con số 0.

⛔ **Cổng ra:** `validate_scene` + `validate_prefab_references` → **0 broken ref**,
và scene mở được trong Editor không văng lỗi.

> **Nạp skill `dev-cocos-mcp` trước khi bắt đầu giai đoạn này.** Nó là luật vận hành
> Editor qua MCP (tool nào cho việc gì, vòng đời read → mutate → save → validate).

---

## Luật số 1: KHÔNG sửa tay JSON `.scene` / `.prefab`

`.scene`/`.prefab` của 3.x là mảng object có `__id__` tham chiếu chéo, kèm
`PrefabInfo`/`CompPrefabInfo` với `fileId` sinh theo thuật toán riêng. Sửa tay
gần như chắc chắn sinh ra file **mở được nhưng sai âm thầm** (mất liên kết
prefab, node không nhận thay đổi, instance không revert được).

Cách đúng: **điều khiển Editor đang sống** — `create_node`, `add_component`,
`set_node_transform`, `set_component_property`, `create_prefab_from_node`,
`instantiate_prefab` — rồi `save_current_scene`.

Ngoại lệ duy nhất: thao tác hàng loạt trên prefab đã ổn định (đổi tên, reindex)
qua `edit_prefab_json` — vẫn phải validate ngay sau đó.

## Luật số 2: giá trị property lấy từ ground truth, không từ trí nhớ

Prefab dựng tay **luôn** lệch ở những chỗ không nhìn thấy: `contentSize`,
`anchorPoint`, `group` collider, `layer` render, opacity, màu.

Nguồn đúng, theo thứ tự:
1. **Project 2.x đầu vào** — mở trong Editor 2.4.x rồi `inspect` node/prefab
   tương ứng. Đây là nguồn tốt nhất: nó là dữ liệu thật trong một Editor thật,
   không phải dump.
2. Dump state lúc chạy của bản 2.x (`runtime-scene-component-state.json` nếu
   project đi qua `dev-cocos-port-2x`) — giá trị **thật lúc chạy**. Dùng cho
   prefab không xuất hiện trong scene nào.
3. File `.prefab`/`.fire` của chính project 2.x — đọc được bằng mắt sau khi
   format. `.fire` **không** có công cụ nào parse hộ (xem
   `dev-cocos-project-context`), nên đây là đọc tay.

Đừng dùng nguồn 4 = "nhìn screenshot rồi ước lượng". Ước lượng sai 5 px thì
layout lệch dồn, và bạn sẽ mất buổi chiều để tìm.

`Label.string` **không** phải ngoại lệ: nhập đúng chuỗi gốc, không dịch. Nhờ vậy
GĐ5 diff được `Label.string` giữa hai bản — lệch là có bug, chứ không phải "cố ý
khác".

## Thứ tự dựng

1. **Scene rỗng + Canvas + camera** đúng designResolution của bản gốc (probe ở
   GĐ1 đọc từ `settings/` của project 2.x). Sai bước này thì mọi toạ độ sau đều sai.
2. **Prefab lá trước, prefab gộp sau.** Prefab UI/gameplay nhỏ (item, ô, nút)
   → prefab layer → scene. Ngược lại thì phải sửa lại nhiều lần.
3. **Wiring `@property`** — gán reference sau khi cả node lẫn component đã tồn tại.
4. **Nút bấm**: `bind_button_click_event` (target node + component + handler).
   Handler phải là tên method có thật trên component đã `@ccclass`.
5. Save → `validate_prefab_references` → `validate_scene`.

## Kiểm tra bắt buộc sau mỗi prefab

```
inspect_prefab            → cây node + component đúng chưa
validate_prefab_references→ 0 broken
```

Và soát 3 thứ hay sai âm thầm (chi tiết ở `pitfalls.md`):

| Kiểm | Vì sao |
|---|---|
| `scale.z !== 0` trên mọi node UI | `z=0` làm ma trận world suy biến → `hitTest` luôn false → **nút không bấm được**, không có lỗi nào |
| `UITransform.contentSize` khớp ground truth | sai size → hitbox sai, layout dồn lệch |
| `Collider2D.group` (bitmask) đã set + `apply()` | `node.group` của 2.x là no-op ở 3.x |
| `Label.string` khớp **nguyên văn** chuỗi trong project 2.x | lệch chuỗi = nhập sai node, và nó phá luôn khả năng diff ở GĐ5 |
| `zIndex` cũ đã chuyển thành thứ tự sibling đúng | `node.zIndex` là no-op ở 3.x (`pitfalls.md` §7b) |

## Khi số lượng lớn (hàng chục–hàng trăm prefab)

Dựng tay từng cái không khả thi. Hai hướng, chọn theo bản chất dữ liệu:

**(a) Sinh prefab bằng script chạy trong Editor.** Viết một component
`@executeInEditMode` đọc dữ liệu đã export từ bản 2.x rồi dựng cây node + gọi API
lưu prefab. Ưu điểm: engine tự lo serialize.

⚠ Component `@executeInEditMode` **chạy thật trong Editor và ghi thẳng vào
scene** — mở scene một lần là Editor lưu giá trị nó sinh ra vào `.scene`. Chặn
bằng `EDITOR` từ `cc/env` cho mọi nhánh chỉ dành cho runtime; cùng một cơ chế đã
làm bẩn `.fire` ở bản 2.x (`dev-cocos-port-2x/references/rebuild-2x.md`).

**(b) Bỏ prefab, dựng runtime từ dữ liệu.** Nếu cấu trúc **rất đều** (ví dụ:
level = layer → board → hole), thì đừng lưu 90 prefab; lưu **JSON compact** +
một builder dựng cây lúc chạy.

Thực đo trên một dự án thật: 90 level prefab **104 MB → 0,51 MB JSON** (206×),
verify decode-lại-so-với-prefab **0 mismatch**. Lý do prefab phình: mỗi node
kéo theo `Node`/`UITransform`/`PrefabInfo`/`CompPrefabInfo` — metadata lặp chiếm
~60% dung lượng, trong khi cấu trúc thật chỉ là vài con số.

Nếu chọn (b): **giữ prefab gốc ở ngoài thư mục bundle** (`assets/…-src/`) làm
nguồn tái sinh, và viết script `verify-*.py` đối chiếu JSON ↔ prefab. Builder
runtime và script verify phải phản chiếu nhau — sửa một bên thì sửa cả hai, nếu
không verify mất giá trị.


---

## Bốn thứ của 3.8 làm hỏng prefab trong im lặng

Rút từ một lần port project→project. Cả bốn đều **không** bị
`validate_prefab_references` hay `validate_scene` bắt.

### 1. `create_prefab_from_node` của MCP không sinh `cc.PrefabInfo`

Tool đó dùng `asset-db:create-asset`: serialize cây node nhưng **không** sinh
`cc.PrefabInfo` / `cc.CompPrefabInfo`. Kết quả `_prefab = null` trên mọi node ⇒
instance trong scene không track được asset ⇒ hỏng đúng workflow artist, và
Editor log `open prefab failed TypeError: Cannot read properties of null` sau
**mỗi** lần lưu.

Dùng API mà Editor dùng khi kéo node vào Assets:

```js
cce.Prefab.createPrefabAssetFromNode(String(nodeUuid), 'db://assets/.../X.prefab')
```

Tham số đầu là **UUID STRING**. Truyền object node → trả `null`, **không ghi gì,
không ném**.

**Cổng kiểm bằng dữ liệu:** số `cc.PrefabInfo` phải **bằng** số `cc.Node`, và
`cc.Node._prefab` phải trỏ tới một `cc.PrefabInfo` có `root`/`asset`/`fileId`.

Drift chấp nhận được: API này **đổi tên node gốc theo tên file**. Kiểm xem có code
nào tra cứu tên đó không rồi hãy chấp nhận.

### 2. Layer mặc định là DEFAULT, không phải UI_2D

`new Node()` cho `layer = DEFAULT` (`1 << 30`). Camera của Canvas chỉ render
`visibility` của nó, nên node UI ở DEFAULT bị **cull im lặng** — và **hit-test
cũng chết** vì `UITransform.hitTest` đi qua camera.

Script dựng phải set `node.layer = Layers.Enum.UI_2D` ngay sau `new Node()` và
**assert trước khi ghi asset**. Xem `pitfalls.md` §17 cho bảng giá trị chuẩn.

### 3. Thứ tự gán property có ý nghĩa

- `Sprite`: set `sizeMode` + `type` **trước** `spriteFrame`. Gán `spriteFrame` khi
  `sizeMode` còn là `TRIMMED` sẽ **ghi đè `UITransform`**, và set `sizeMode` sau
  đó không khôi phục lại.
- `Label`: **luôn** gán `string`, fallback `''`. 2.x không serialize chuỗi rỗng;
  bỏ qua trường vắng ⇒ Label giữ default của 3.8 là `'label'` và chữ đó hiện thật.
- Sau khi add xong **mọi** component, **re-assert `contentSize`** một lần nữa —
  `Label` tự resize theo `string`/`overflow`.

### 4. `open_scene` chuyển scene BẤT ĐỒNG BỘ

`open_scene` trả `ok` ngay, nhưng `execute_javascript` gọi liền sau đó vẫn chạy
trên **scene cũ**. Hệ quả thật: dựng nguyên một scene vào nhầm scratch scene rồi
mất trắng khi editor reload.

Script dựng phải tự kiểm trước khi làm gì:

```js
if (cc.director.getScene().name !== expected) return { aborted: '...' };
```

Và scratch scene phải **kết thúc rỗng**: một node root sót lại giữ scene ở trạng
thái dirty, và scene dirty khiến Editor **lờ đi** `open_scene` kế tiếp trong khi
`open_scene` vẫn báo thành công.

> Dọn node sau khi tạo prefab: **đừng** tra theo uuid mà builder trả về —
> `createPrefabAssetFromNode` thay node bằng prefab instance mang **uuid mới**.
> Chụp `new Set(scene.children)` trước, xoá phần chênh lệch sau.
