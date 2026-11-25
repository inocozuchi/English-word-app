// アイコンと起動画面（スプラッシュ）の PNG を生成する。
// - iOS のホーム画面アイコンは PNG のみ対応
// - 起動画面は端末サイズごと・ライト/ダークごとに用意しないと、白い画面が一瞬出る
// Playwright はグローバル導入済みのものを使う（未導入なら npm i -D playwright）
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const svg = readFileSync(fileURLToPath(new URL('./icon.svg', import.meta.url)), 'utf8');
const pub = fileURLToPath(new URL('../public/', import.meta.url));
mkdirSync(pub + 'icons', { recursive: true });
mkdirSync(pub + 'splash', { recursive: true });

const icons = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512, 'icon-maskable-512.png': 512 };
// [幅, 高さ, 倍率]（縦向き・CSS px）
const devices = [
  [440, 956, 3], [430, 932, 3], [428, 926, 3], [414, 896, 3], [414, 896, 2], [402, 874, 3],
  [393, 852, 3], [390, 844, 3], [375, 812, 3], [375, 667, 2],
];
const themes = { light: { bg: '#ffffff', ink: '#111114' }, dark: { bg: '#0b0b0d', ink: '#f3f3f5' } };

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of Object.entries(icons)) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `${pub}icons/${name}` });
  console.log('icon:', name);
}
const tags = [];
for (const [w, h, r] of devices) {
  for (const [theme, c] of Object.entries(themes)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: r });
    const p = await ctx.newPage();
    // アプリのロゴ（太枠に2行の欧文）を中央に置くだけの静かな起動画面
    await p.setContent(`<html><body style="margin:0;height:100vh;display:grid;place-items:center;background:${c.bg}">
      <div style="display:flex;flex-direction:column;padding:6px 11px 5px;border:3px solid ${c.ink};color:${c.ink};font:900 17px/1.02 Helvetica,Arial,sans-serif;letter-spacing:.02em">
      <span>ETYMO</span><span>WORDS</span></div></body></html>`);
    const file = `splash/${theme}-${w}x${h}@${r}x.png`;
    await p.screenshot({ path: pub + file });
    await ctx.close();
    tags.push(
      `<link rel="apple-touch-startup-image" media="screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait) and (prefers-color-scheme: ${theme})" href="./${file}" />`,
    );
  }
}
await browser.close();
writeFileSync(fileURLToPath(new URL('./splash-tags.html', import.meta.url)), tags.join('\n') + '\n');
// 起動画面は単色＋ロゴだけなので16色に減色して軽くする（Python の Pillow があれば）
const py = `from PIL import Image\nimport glob\nfor f in glob.glob(${JSON.stringify(pub + 'splash/*.png')}):\n    Image.open(f).convert('RGB').quantize(colors=16).save(f, optimize=True)`;
const r = spawnSync('python3', ['-c', py], { stdio: 'inherit' });
if (r.status !== 0) console.warn('⚠ Pillow が無いため起動画面を減色できませんでした（動作には影響なし）');
console.log(`splash: ${tags.length} images (link tags → scripts/splash-tags.html)`);
