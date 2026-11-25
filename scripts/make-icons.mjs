// scripts/icon.svg から PNG アイコンを生成する（iOS のホーム画面アイコンは PNG のみ対応）
// Playwright はグローバル導入済みのものを使う（未導入なら npm i -D playwright）
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const svg = readFileSync(fileURLToPath(new URL('./icon.svg', import.meta.url)), 'utf8');
const out = fileURLToPath(new URL('../public/icons/', import.meta.url));
mkdirSync(out, { recursive: true });
const sizes = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512, 'icon-maskable-512.png': 512 };

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of Object.entries(sizes)) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: out + name, omitBackground: false });
  console.log('icon:', name, size);
}
await browser.close();
