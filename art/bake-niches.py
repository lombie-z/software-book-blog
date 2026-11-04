"""Bake the hero niches to stills for phones, from the real 3D rooms on the running dev server.

Writes public/images/3d/niche-{top,middle,bottom}.webp. Phones show these instead of live WebGL (components/three/niche.tsx).
Re-run after changing the rooms, the light or the cactus. The canvas caps its pixel ratio at 1.75, so this renders a phone-shaped
window at the widest phone layout rather than asking for more pixels. Needs Playwright and cwebp.

Run with the dev server up: python3 art/bake-niches.py
"""
import os
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'images', '3d')
URL = 'http://localhost:3002/'
# iPhone proportions (390 × 844), just under the md breakpoint, where a niche reaches its 560px maximum.
VIEWPORT = {'width': 718, 'height': 1554}
SCALE = 1.75

with sync_playwright() as p, tempfile.TemporaryDirectory() as tmp:
    browser = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    page = browser.new_page(viewport=VIEWPORT, device_scale_factor=SCALE)
    page.goto(URL, wait_until='networkidle')
    # The signature overlaps the top niche on the page; the stills are just the rooms. Dev's breakpoint badge goes too.
    page.add_style_tag(content="section[aria-label='Intro'] > h1 + * { visibility: hidden !important; } .fixed.bottom-1.left-1 { display: none !important; }")
    # Every niche's canvas has handed over once its drawing layer has faded out.
    page.wait_for_function(
        "[...document.querySelectorAll('[data-niche]')].every((n) => n.querySelector('canvas') && getComputedStyle(n.lastElementChild).opacity === '0')",
        timeout=120_000,
    )
    page.wait_for_timeout(1000)
    for name in ('top', 'middle', 'bottom'):
        png = os.path.join(tmp, f'{name}.png')
        page.locator(f"[data-niche='{name}']").screenshot(path=png)
        subprocess.run(['cwebp', '-quiet', '-q', '92', '-m', '6', png, '-o', os.path.join(OUT, f'niche-{name}.webp')], check=True)
    browser.close()
