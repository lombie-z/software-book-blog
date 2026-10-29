"""Build the favicons from the hat in the signature (the last three pieces drawn in components/ui/signature.tsx).

Writes public/favicon.svg, favicon.ico (16/32/48), apple-touch-icon.png, icon-192.png and icon-512.png: a pale etched hat on a
plaster tile, in the site's colours. Needs rsvg-convert and ImageMagick.

Run: python3 art/build-favicon.py
"""
import math
import os
import re
import subprocess
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, '..', 'public')
SIGNATURE = os.path.join(HERE, '..', 'components', 'ui', 'signature.tsx')
HAT_PIECES = 3  # the hat is drawn last
STROKE = 64  # in signature units; about 2.5px at 32px, so it holds up in a tab
PAD = 0.07  # of the tile, around the hat


def oklch_hex(l, c, h):
    a, b = c * math.cos(math.radians(h)), c * math.sin(math.radians(h))
    l_, m_, s_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3, (l - 0.1055613458 * a - 0.0638541728 * b) ** 3, (l - 0.0894841775 * a - 1.2914855480 * b) ** 3
    rgb = (4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_)
    enc = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return '#' + ''.join(f'{round(min(1, max(0, enc(v))) * 255):02x}' for v in rgb)


PLASTER = oklch_hex(0.962, 0.008, 82)  # --plaster in styles.css
HAT = oklch_hex(0.72, 0.02, 70)  # a pale etched-plaster tone, a few steps darker than --plaster-shade


def hat_paths():
    pieces = re.findall(r"\[\s*'([^']+)'\s*,\s*[\d.]+\s*,\s*[\d.]+\s*\]", open(SIGNATURE).read())
    return pieces[-HAT_PIECES:]


def svg(paths, rounded=True):
    nums = [float(n) for d in paths for n in re.findall(r'-?\d+\.?\d*', d)]
    xs, ys = nums[0::2], nums[1::2]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    side = (max(xs) - min(xs) + STROKE) / (1 - 2 * PAD)
    x0, y0 = cx - side / 2, cy - side / 2
    tile = f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{side:.1f}" height="{side:.1f}"' + (f' rx="{side * 0.22:.1f}"' if rounded else '') + f' fill="{PLASTER}"/>'
    ink = ''.join(f'<path d="{d}"/>' for d in paths)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.1f} {y0:.1f} {side:.1f} {side:.1f}">{tile}'
        f'<g fill="none" stroke="{HAT}" stroke-width="{STROKE}" stroke-linecap="round" stroke-linejoin="round">{ink}</g></svg>\n'
    )


def main():
    paths = hat_paths()
    with open(os.path.join(PUBLIC, 'favicon.svg'), 'w') as f:
        f.write(svg(paths))
    with tempfile.TemporaryDirectory() as tmp:
        # Home screen icons are masked by the OS, so they get a square tile.
        square = os.path.join(tmp, 'square.svg')
        with open(square, 'w') as f:
            f.write(svg(paths, rounded=False))
        for name, size in [('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512)]:
            subprocess.run(['rsvg-convert', '-w', str(size), '-h', str(size), square, '-o', os.path.join(PUBLIC, name)], check=True)
        sizes = []
        for size in (16, 32, 48):
            png = os.path.join(tmp, f'{size}.png')
            subprocess.run(['rsvg-convert', '-w', str(size), '-h', str(size), os.path.join(PUBLIC, 'favicon.svg'), '-o', png], check=True)
            sizes.append(png)
        subprocess.run(['magick', *sizes, os.path.join(PUBLIC, 'favicon.ico')], check=True)


if __name__ == '__main__':
    main()
