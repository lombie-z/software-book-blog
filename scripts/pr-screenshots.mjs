import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3002';
const OUT_DIR = process.env.OUT_DIR || 'pr-screenshots';

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function findFirstPostPath() {
  const root = path.join(process.cwd(), 'content', 'posts');
  if (!(await exists(root))) return null;

  /** @type {string[]} */
  const stack = [root];
  /** @type {string[]} */
  const files = [];

  while (stack.length) {
    const dir = stack.pop();
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.mdx')) files.push(full);
    }
  }

  files.sort();
  const first = files[0];
  if (!first) return null;

  const rel = path.relative(root, first).replace(/\\/g, '/');
  const noExt = rel.replace(/\.mdx$/, '');
  return `/posts/${noExt}`;
}

async function capturePage(page, url, outPath) {
  await page.goto(url, { waitUntil: 'networkidle' });
  // Give animations/fonts a beat to settle.
  await page.waitForTimeout(1500);
  await page.screenshot({ path: outPath, fullPage: true });
}

function safeName(p) {
  return p.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'home';
}

async function main() {
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  const postPath = await findFirstPostPath();

  /** @type {{ label: string, path: string }[]} */
  const targets = [
    { label: 'home', path: '/' },
    { label: 'posts', path: '/posts' },
  ];
  if (postPath) targets.push({ label: 'first-post', path: postPath });

  const browser = await chromium.launch();

  const viewports = [
    { name: 'desktop', viewport: { width: 1280, height: 800 } },
    { name: 'mobile', viewport: { width: 375, height: 812 } },
  ];

  try {
    for (const vp of viewports) {
      const context = await browser.newContext({ viewport: vp.viewport });
      const page = await context.newPage();

      for (const t of targets) {
        const url = new URL(t.path, BASE_URL).toString();
        const filename = `${vp.name}__${t.label}__${safeName(t.path)}.png`;
        const outPath = path.join(OUT_DIR, filename);
        // eslint-disable-next-line no-console
        console.log(`[capture] ${vp.name} ${t.path} -> ${outPath}`);
        await capturePage(page, url, outPath);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  // Write an index.md for easy viewing in artifacts.
  const lines = ['# PR Screenshots', '', `Base URL: ${BASE_URL}`, ''];
  const files = (await fs.readdir(OUT_DIR)).filter((f) => f.endsWith('.png')).sort();
  for (const f of files) {
    lines.push(`## ${f}`, '', `![](${f})`, '');
  }
  await fs.writeFile(path.join(OUT_DIR, 'index.md'), `${lines.join('\n')}\n`, 'utf8');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
