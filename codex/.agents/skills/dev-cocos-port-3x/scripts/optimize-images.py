#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tối ưu PNG nguồn trong assets/ — mặc định LOSSLESS (không đổi một pixel nào).

Vì sao: asset đi qua bước extract/crop thường mất palette và bị lưu RGBA 32-bit
dù ảnh chỉ có <=256 màu. oxipng tự hạ color-type xuống palette khi việc đó không
mất mát. Thực đo trên một dự án port: 689 PNG, 22,59 -> 9,21 MB (-59%),
verify 689/689 giống hệt từng pixel.

An toàn:
  - Backup toàn bộ file gốc trước khi động vào.
  - Sau khi nén, so PIXEL từng ảnh với bản gốc. Ảnh nào lệch -> KHÔI PHỤC bản gốc.
    (chế độ --lossy dùng pngquant nên bỏ qua so pixel, thay bằng ngưỡng sai số.)

  python3 optimize-images.py --assets <project>/assets                 # dry-run
  python3 optimize-images.py --assets <project>/assets --apply         # lossless thật
  python3 optimize-images.py --assets <project>/assets --apply --lossy # + quantize

Cần: brew install oxipng   (và pngquant nếu dùng --lossy), pip install pillow
Sau khi chạy: refresh_assets trong Cocos Editor.
"""
import argparse, os, shutil, subprocess, sys, tempfile

ASSETS = None   # gán trong main() từ --assets
BACKUP = None   # gán trong main() từ --backup

# Ngưỡng cho --lossy: sai lệch kênh trung bình tối đa cho phép (0-255).
LOSSY_MAX_MEAN_DIFF = 2.0


def find_pngs(root):
    out = []
    for dp, _, fs in os.walk(root):
        for f in fs:
            if f.lower().endswith('.png'):
                out.append(os.path.join(dp, f))
    return sorted(out)


def pixels(path):
    from PIL import Image
    with Image.open(path) as im:
        return im.convert('RGBA').tobytes(), im.size


def mean_diff(a_path, b_path):
    from PIL import Image, ImageChops, ImageStat
    with Image.open(a_path) as ia, Image.open(b_path) as ib:
        ia = ia.convert('RGBA'); ib = ib.convert('RGBA')
        if ia.size != ib.size:
            return 999.0
        st = ImageStat.Stat(ImageChops.difference(ia, ib))
        return sum(st.mean) / len(st.mean)


def run(cmd):
    return subprocess.run(cmd, stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL).returncode


def main():
    global ASSETS, BACKUP
    ap = argparse.ArgumentParser()
    ap.add_argument('--assets', required=True,
                    help='thư mục assets/ của project Cocos cần nén')
    ap.add_argument('--backup', help='thư mục backup (mặc định <assets>/../.png-backup)')
    ap.add_argument('--apply', action='store_true', help='ghi đè thật (mặc định chỉ thử)')
    ap.add_argument('--lossy', action='store_true',
                    help='thêm pngquant cho ảnh >256 màu (KHÔNG còn lossless)')
    ap.add_argument('--quality', default='70-95',
                    help='dải chất lượng pngquant, chỉ dùng với --lossy. '
                         'Mặc định 70-95 (nhẹ). Đo trên art hoạt hình: 25-60 cho '
                         'mức giảm TỐI ĐA (~38%%); thấp hơn nữa KHÔNG giảm thêm '
                         'byte, chỉ làm xấu ảnh.')
    ap.add_argument('--jobs', type=int, default=8)
    args = ap.parse_args()

    ASSETS = os.path.abspath(args.assets)
    if not os.path.isdir(ASSETS):
        print('không thấy thư mục assets: %s' % ASSETS); return 2
    BACKUP = os.path.abspath(args.backup) if args.backup \
        else os.path.join(os.path.dirname(ASSETS), '.png-backup')

    for tool in ('oxipng',) + (('pngquant',) if args.lossy else ()):
        if shutil.which(tool) is None:
            print('THIẾU công cụ: %s (brew install %s)' % (tool, tool)); return 2

    files = find_pngs(ASSETS)
    total_before = sum(os.path.getsize(p) for p in files)
    print('PNG nguồn trong assets/: %d file, %.2f MB' % (len(files), total_before / 1024 / 1024))
    if not args.apply:
        print('\n(dry-run — thêm --apply để ghi đè thật)')
        return 0

    # ---- backup ----
    if os.path.exists(BACKUP):
        print('ĐÃ CÓ backup ở %s — xoá hoặc đổi tên trước khi chạy lại, để không '
              'ghi đè bản gốc bằng bản đã nén.' % BACKUP)
        return 2
    os.makedirs(BACKUP)
    for p in files:
        rel = os.path.relpath(p, ASSETS)
        dst = os.path.join(BACKUP, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(p, dst)
    print('đã backup %d file -> %s' % (len(files), BACKUP))

    # ---- nén ----
    if args.lossy:
        # chỉ quantize ảnh >256 màu; ảnh <=256 màu để oxipng lo (lossless)
        from PIL import Image
        many = []
        for p in files:
            try:
                with Image.open(p) as im:
                    c = im.convert('RGBA').getcolors(maxcolors=256)
                if c is None:
                    many.append(p)
            except Exception:
                pass
        print('quantize %d ảnh >256 màu...' % len(many))
        for i in range(0, len(many), 20):
            run(['pngquant', '--quality=' + args.quality, '--skip-if-larger',
                 '--ext', '.png', '--force'] + many[i:i + 20])

    print('oxipng lossless trên %d ảnh...' % len(files))
    for i in range(0, len(files), 20):
        run(['oxipng', '-o', '4', '--strip', 'safe', '-q', '-t', str(args.jobs)]
            + files[i:i + 20])

    # ---- kiểm chứng ----
    restored = 0
    checked = 0
    worst = 0.0
    for p in files:
        rel = os.path.relpath(p, ASSETS)
        orig = os.path.join(BACKUP, rel)
        try:
            if args.lossy:
                d = mean_diff(orig, p)
                worst = max(worst, d)
                ok = d <= LOSSY_MAX_MEAN_DIFF
            else:
                ok = pixels(orig) == pixels(p)
        except Exception as e:
            ok = False
        checked += 1
        if not ok:
            shutil.copy2(orig, p)     # khôi phục bản gốc
            restored += 1

    total_after = sum(os.path.getsize(p) for p in files)
    print()
    print('đã kiểm chứng %d ảnh' % checked)
    if args.lossy:
        print('sai lệch kênh trung bình lớn nhất: %.3f (ngưỡng %.1f)' % (worst, LOSSY_MAX_MEAN_DIFF))
    print('khôi phục vì không đạt: %d' % restored)
    print('%.2f MB -> %.2f MB  (giảm %.2f MB = %d%%)'
          % (total_before / 1024 / 1024, total_after / 1024 / 1024,
             (total_before - total_after) / 1024 / 1024,
             100 * (total_before - total_after) / total_before))
    print('\nbản gốc giữ ở %s — chạy refresh_assets trong Editor sau khi nén.' % BACKUP)
    return 0


if __name__ == '__main__':
    sys.exit(main())
