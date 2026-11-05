"""Regenerate icon exports and review sheet: python3 docs/brand/tools/refresh-icons.py.

Requires Pillow. No generation service is called; uses the approved PNG master.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
BRAND = ROOT / 'docs/brand'
STUDY = BRAND / 'icon-study-2026-11-05'
MASTER = BRAND / 'mascot/goose-face-paper-1024.png'


def tile(source, size, rounded=False):
    image = source.convert('RGB').resize((size, size), Image.Resampling.LANCZOS)
    if rounded:
        mask = Image.new('L', (size * 4, size * 4))
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=round(size * .88), fill=255)
        image.putalpha(mask.resize((size, size), Image.Resampling.LANCZOS))
    return image


def font(size, bold=False):
    for path in [
        Path('/System/Library/Fonts/Supplemental') / ('Arial Bold.ttf' if bold else 'Arial.ttf'),
        Path('/usr/share/fonts/truetype/dejavu') / ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'),
    ]:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default(size=size)


def exports():
    master = Image.open(MASTER)
    outputs = {
        'apps/ios/assets/icon.png': (1024, False),
        'docs/brand/logo/schwanki-mark-square-1024.png': (1024, False),
        'docs/brand/logo/schwanki-mark-1024.png': (1024, True),
        'apps/web/public/icons/apple-touch-icon.png': (180, False),
        'apps/web/public/icons/icon-192.png': (192, True),
        'apps/web/public/icons/icon-512.png': (512, True),
        'apps/web/public/icons/maskable-512.png': (512, False),
        'apps/web/public/icons/favicon-32.png': (32, True),
    }
    for size in (16, 32, 48, 128):
        outputs[f'apps/extension/public/icons/icon-{size}.png'] = (size, True)
    for file, (size, rounded) in outputs.items():
        tile(master, size, rounded).save(ROOT / file, optimize=True)
    tile(master, 48, True).save(ROOT / 'apps/web/public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])


def review_sheet():
    sheet = Image.new('RGB', (1200, 960), '#eef0f4')
    draw = ImageDraw.Draw(sheet)
    draw.text((42, 30), 'Schwanki · face on paper', fill='#14213d', font=font(34, True))
    draw.text((42, 79), 'Same goose. More face. Lined-paper background.', fill='#535d72', font=font(20))
    concepts = [
        ('A', 'Familiar side-eye', STUDY / 'a-familiar-side-eye-1024.png'),
        ('B', 'Raised-eyebrow smirk · selected', MASTER),
        ('C', 'Cheeky grin', STUDY / 'c-cheeky-grin-1024.png'),
    ]
    for i, (letter, name, path) in enumerate(concepts):
        x = 42 + i * 388
        source = Image.open(path)
        draw.text((x, 125), letter, fill='#2346b8', font=font(26, True))
        sheet.paste(tile(source, 340), (x, 170))
        draw.text((x, 528), name, fill='#14213d', font=font(19, True))
        small = tile(source, 60, True)
        for y, label, background, text, secondary in [
            (604, '60 px · light', 'white', '#14213d', '#667085'),
            (757, '60 px · dark', '#15171c', 'white', '#b1b7c4'),
        ]:
            draw.text((x, y - 33), label, fill='#535d72', font=font(17))
            draw.rounded_rectangle((x, y, x + 340, y + 90), radius=14, fill=background)
            sheet.paste(small, (x + 15, y + 15), small)
            draw.text((x + 91, y + 22), 'Schwanki', fill=text, font=font(21, True))
            draw.text((x + 91, y + 52), 'Scroll your vocabulary', fill=secondary, font=font(15))
    draw.text((42, 895), '1024 × 1024 opaque masters · square corners. Small previews show platform masking.', fill='#535d72', font=font(18))
    sheet.save(STUDY / 'comparison.png', optimize=True)


if __name__ == '__main__':
    exports()
    review_sheet()
