// iPhone 15（393×852pt）の全画面表示を再現してスクリーンショットを撮る。
// 実機のホーム画面アプリで起こりうる「最悪ケース（ステータスバーの下まで描画）」を想定し、
// セーフエリア（上59/下34）を与えたうえで、ダイナミックアイランド・角丸・ホームインジケーターを重ねる。
// 使い方: npm run build && npm run shots   （出力: screenshots/）
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = 'screenshots/';
mkdirSync(OUT, { recursive: true });
const PORT = 4179;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const URL = `http://localhost:${PORT}/`;

const SIM_CSS = `
:root { --safe-top: 59px !important; --safe-bottom: 34px !important; }
#__sim { position: fixed; inset: 0; pointer-events: none; z-index: 99999; }
#__sim .corner { position: absolute; inset: 0; border-radius: 55px; box-shadow: 0 0 0 60px #1d1d1f; }
#__sim .island { position: absolute; top: 11px; left: 50%; width: 125px; height: 37px; margin-left: -62.5px; border-radius: 19px; background: #000; }
#__sim .time { position: absolute; top: 17px; left: 52px; font: 600 17px -apple-system, 'Inter', sans-serif; }
#__sim .icons { position: absolute; top: 21px; right: 34px; display: flex; gap: 6px; align-items: center; }
#__sim .icons i { display: block; background: currentColor; border-radius: 2px; }
#__sim .home { position: absolute; bottom: 8px; left: 50%; width: 134px; height: 5px; margin-left: -67px; border-radius: 3px; background: currentColor; }
`;
async function sim(page) {
  await page.addStyleTag({ content: SIM_CSS });
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = '__sim';
    const dark = getComputedStyle(document.body).backgroundColor !== 'rgb(255, 255, 255)';
    d.style.color = dark ? '#fff' : '#000';
    d.innerHTML = '<div class="corner"></div><div class="island"></div><div class="time">9:41</div>' +
      '<div class="icons"><i style="width:17px;height:11px"></i><i style="width:15px;height:11px;border-radius:6px"></i><i style="width:25px;height:12px;border-radius:4px"></i></div><div class="home"></div>';
    document.body.appendChild(d);
  });
}

async function run(scheme) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: scheme,
    locale: 'ja-JP',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  // 解説を読める程度に回答・表示時間を設定
  await page.evaluate(() => localStorage.setItem('ety.settings.v1', JSON.stringify({ advanceSec: 3, answerSec: 15, formats: ['ej', 'je', 'rm', 'ph'] })));
  await page.reload();
  await sim(page);
  await page.waitForTimeout(600);
  const shot = async (name) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}${scheme}-${name}.png` });
    console.log('shot', scheme, name);
  };
  const top = () => page.locator('#app > .screen').last();
  const tap = (sel) => top().locator(sel).first().tap();

  await shot('01-home');
  await tap('button.start');
  await page.waitForTimeout(400);
  await shot('02-quiz');
  // 1問目: わざとまちがえる（正解以外を押す）
  await top().locator('.choice').nth(1).tap();
  await page.waitForTimeout(500);
  await shot('03-reveal');
  // 残りは自動で進ませる（回答しながら）
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(3300);
    if (await page.locator('.result').count()) break;
    const c = page.locator('.card .choice:not([disabled])');
    if (await c.count()) await c.nth(i % 4).tap().catch(() => {});
    if (i === 2) await shot(`04-quiz-q${i + 3}`);
  }
  await page.waitForSelector('.result', { timeout: 20000 });
  await shot('05-result');
  await tap('.result .secondary');
  await page.waitForTimeout(700);
  await tap('nav button:nth-child(1)');
  await shot('06-book');
  await tap('.group .row');
  await shot('07-chapter');
  await tap('.group .row');
  await shot('08-root');
  await top().locator('.scroll').first().evaluate((el) => el.scrollTo(0, 420));
  await shot('09-root-tree');
  await tap('.branch');
  await shot('10-word');
  // スワイプバックの途中
  await page.evaluate(async () => {
    const el = document.querySelectorAll('.screen');
    const top = el[el.length - 1];
    const fire = (type, x) => top.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: 400, bubbles: true, pointerType: 'touch', isPrimary: true }));
    fire('pointerdown', 20);
    for (let x = 30; x <= 170; x += 10) fire('pointermove', x);
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${OUT}${scheme}-11-swipeback.png` });
  await page.evaluate(() => {
    const el = document.querySelectorAll('.screen');
    el[el.length - 1].dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: 175, clientY: 400, bubbles: true, pointerType: 'touch' }));
  });
  await page.waitForTimeout(800);
  // ホームへ戻って 設定・記録
  for (let i = 0; i < 4; i++) {
    const b = top().locator('header .back');
    if (!(await b.count())) break;
    await b.tap({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  await tap('header .icon');
  await shot('12-settings');
  await top().locator('.scroll').first().evaluate((el) => el.scrollTo(0, 2000));
  await shot('13-settings-bottom');
  await top().locator('header .back').tap();
  await page.waitForTimeout(800);
  await tap('nav button:nth-child(2)');
  await shot('14-stats');
  if (errors.length) console.log('ERRORS', scheme, errors);
  await browser.close();
}

try {
  await run(process.argv[2] === 'dark' ? 'dark' : 'light');
  if (!process.argv[2]) await run('dark');
} finally {
  server.kill();
}
