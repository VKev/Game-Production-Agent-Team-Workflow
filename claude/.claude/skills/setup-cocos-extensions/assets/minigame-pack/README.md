# minigame-pack — giảm số file trong gói mini-game

## Vấn đề

Build `wechatgame` / `bytedance` ra **2184 file** (1434 `.json` + 697 `.png` + …).
Số file lớn làm gói nặng khi upload và đụng giới hạn file của nền tảng.

Nguyên nhân: Cocos chỉ cho chọn **một** `compressionType` cho mỗi Asset Bundle
(`settings/v2/packages/builder.json` → `bundleConfig.custom.subpkg`), mà hai lựa
chọn ta cần lại loại trừ nhau:

| compressionType | JSON | Vị trí bundle | Hệ quả |
|---|---|---|---|
| `subpackage` | **không gộp** → 1434 file | `subpackages/resources/` | Lách được trần 4 MB gói chính, nhưng nhiều file |
| `merge_all_json` | **gộp còn 1 pack** | `assets/resources/` (nằm trong gói chính) | Ít file, nhưng gói chính 16 MB → vỡ trần 4 MB |

## Cách làm

Build kiểu `merge_all_json` rồi **tự chuyển bundle xuống subpackage** sau khi build:

```
assets/resources/      →  subpackages/resources/
index.js               →  game.js              (entry subpackage của WeChat/Douyin)
game.json              +  "subpackages": [{ "name": "resources", "root": "subpackages/resources/" }]
src/settings.json      +  assets.subpackages = ["resources"]
```

Engine mini-game (`platforms/minigame/common/engine/AssetManager.js` → `downloadBundle`)
đọc `settings.assets.subpackages`; thấy `resources` là subpackage thì gọi
`loadSubpackage('resources')` rồi tải `subpackages/resources/config.json` và đặt
`base = "subpackages/resources/"`. Việc JSON đã gộp thành pack là **độc lập** với
chuyện bundle nằm ở đâu, nên hai thứ ghép được với nhau.

## id nền tảng

| nền tảng | id dùng cho `builder add-task` |
|---|---|
| WeChat | `wechatgame` |
| Douyin / TikTok | **`bytedance-mini-game`** (không phải `bytedance`) |

Truyền sai id thì builder vẫn nhận task rồi báo *"The build options verification failed"*
mà không nói vì sao. Nền tảng cũng phải được bật trong Preferences → Labs
(`Editor.Profile.getConfig('utils','features.bytedance-mini-game')` phải là `true`).

## Kết quả đo thực tế

| | trước | sau |
|---|---|---|
| tổng số file | 2184 | **752** |
| gói chính | 30 file / 3,04 MB | 30 file / 3,04 MB |
| subpackage | 2154 file / 11,56 MB | 722 file / 11,56 MB |
| `.json` trong subpackage | 1434 | 1 |

Douyin/TikTok (`build/bytedance-mini-game`): **751 file** — gói chính 3,55 MB /
subpackage 12,12 MB. Gói chính nặng hơn WeChat ~0,5 MB do adapter ByteDance,
chỉ còn **0,45 MB dư** so với trần 4 MB — cẩn thận khi thêm script/scene vào gói chính.

Đã đối chiếu với bản build subpackage gốc: `game.json`, `src/settings.json`,
thư mục `native/` (717 file) **giống hệt từng byte**; tập UUID có dữ liệu
**2226 = 2226**, không mất asset nào.

## Dùng thế nào

- **Tự động** — `hooks.js` là build hook, chạy sau *mọi* build `wechatgame` /
  `bytedance`, kể cả khi bấm từ panel Build của Editor.
  ⚠️ Builder chỉ nạp build hook của extension **lúc Editor khởi động** — bật
  extension giữa chừng thì hook chưa chạy. **Khởi động lại Cocos Editor một lần**
  để hook có hiệu lực cho panel Build. Menu ở dưới thì chạy được ngay
  (browser.js tự gọi đóng gói sau khi build xong).
- **Menu** — `Build nhanh ▸ 📦 Build WeChat (ít file)` / `📦 Build Douyin/TikTok (ít file)`.
- **Đóng gói lại thư mục có sẵn** — `Build nhanh ▸ Đóng gói lại thư mục build mini-game…`
- **CLI**:

  ```sh
  node extensions/minigame-pack/pack.js build/wechatgame [tên-bundle...]
  ```

  Máy này không có `node` riêng, dùng node trong Cocos:

  ```sh
  ELECTRON_RUN_AS_NODE=1 \
    "/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator" \
    extensions/minigame-pack/pack.js build/wechatgame
  ```

Script **idempotent**: chạy lại trên thư mục đã đóng gói thì bỏ qua.

## Ràng buộc

`settings/v2/packages/builder.json` → preset `subpkg` phải để
`configs.miniGame.compressionType = "merge_all_json"` (đã set). Nếu đổi lại
`subpackage` thì build vẫn chạy nhưng quay về 2184 file — hook sẽ không thấy
`assets/resources/` và bỏ qua.

## Muốn xuống nữa (~80 file)

`752` file còn lại gần như toàn bộ là **697 PNG**. Hai hướng:

1. **Auto Atlas** — gộp 498 sprite ≤ 512 px vào vài trang atlas 2048², giảm thêm
   ~450 file và bớt draw call. Cần tạo asset `.pac` trong `assets/resources/` và
   kiểm tra lại hiển thị.
2. **Khử trùng lặp** — có **172 PNG trùng nội dung y hệt** (`textures/paint/**`
   nhân đôi `sprites/paint/**`, `_frames/**` trùng `textures/guide/**`). Gỡ được
   thì bớt file *và* bớt dung lượng, nhưng phải remap UUID trong prefab.
