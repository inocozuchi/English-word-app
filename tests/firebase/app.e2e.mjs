// アプリの画面で2台（iPhone とパソコン）を同期する（Firestore エミュレーター。要 npm run build）。
// 使い方: cd tests/firebase && npm run test:app
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright');
const PORT = 4192;
const APP = `http://localhost:${PORT}/`;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: new URL('../..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2000));
const EMU = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8086';
const CONFIG = `const firebaseConfig = {\n  apiKey: "demo-key",\n  projectId: "demo-eigo",\n  appId: "1:1:web:1",\n  emulatorHost: "${EMU}"\n};`;

let failed = 0;
const ok = (c, m) => (console.log(`${c ? '✓' : '✗'} ${m}`), c || failed++);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
async function device(viewport, init) {
  const ctx = await b.newContext({ viewport, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(APP);
  await page.evaluate((init) => {
    for (const [k, v] of Object.entries(init)) localStorage.setItem(k, JSON.stringify(v));
  }, init);
  await page.reload();
  await page.waitForSelector('button.start');
  await sleep(600);
  const top = () => page.locator('#app > .screen').last();
  return { page, top, errors };
}
const st = (last) => ({ box: 2, due: 0, seen: 1, correct: 1, wrong: 0, last, lastOk: true });
const prog = (items) => ({ items, days: {}, lastBase: null, review: {}, tags: {} });
const P = 'eq.progress.etymology.v1';
const W = (id, en, ja) => ({ id, en, ja, added: 1 });
try {
  const A = await device({ width: 393, height: 852 }, {
    [P]: prog({ 'ej:abstract': st(1000) }),
    'eq.settings.v2': { activeMode: 'etymology', count: 10, typing: 'skip', modes: { custom: { words: [W('w1', 'deadline', '締め切り'), W('w2', 'submit', '提出する')] } } },
  });
  const B = await device({ width: 1280, height: 800 }, {
    [P]: prog({ 'ej:accept': st(2000) }),
    'eq.settings.v2': { activeMode: 'etymology', count: 10, typing: 'on', modes: { custom: { words: [W('w3', 'borrow', '借りる')] } } },
  });
  // 1台目: 置き場を貼り付けて同期を始める
  await A.page.getByRole('button', { name: '設定' }).tap?.().catch(() => {});
  await A.page.getByRole('button', { name: '設定' }).click();
  await sleep(900);
  await A.top().locator('textarea').first().fill(CONFIG);
  await A.top().getByRole('button', { name: 'demo-eigo を使う' }).click();
  await A.top().getByRole('button', { name: '同期を始める' }).click();
  await A.top().getByText('同期済み').waitFor({ timeout: 15000 });
  ok(true, '1台目: 同期を始めると「同期済み」');
  const code = (await A.top().locator('.code-v').textContent()).trim();
  ok(/^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}$/.test(code), `同期コードが出る（${code.slice(0, 5)}…）`);
  // 2台目: コードを入れる
  await B.page.getByRole('button', { name: '設定' }).click();
  await sleep(900);
  await B.top().locator('textarea').first().fill(CONFIG);
  await B.top().getByRole('button', { name: 'demo-eigo を使う' }).click();
  await B.top().getByRole('button', { name: 'コードを入れる' }).click();
  await B.top().locator('.code-in').fill(code.toLowerCase().replace(/-/g, ' '));
  await B.top().getByRole('button', { name: 'このコードで同期' }).click();
  await B.top().getByText('同期済み').waitFor({ timeout: 15000 });
  const bp = await B.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), P);
  ok(Object.keys(bp.items).sort().join() === 'ej:abstract,ej:accept', '2台目: 両方の記録になる（小文字・空白で入れたコードでもよい）');
  const bs = await B.page.evaluate(() => JSON.parse(localStorage.getItem('eq.settings.v2')));
  ok(bs.modes.custom.words.length === 3, `2台目: 自由英単語の単語も合わせて3語（${bs.modes.custom.words.map((w) => w.en).join(', ')}）`);
  ok(bs.typing === 'on', '2台目: 文字入力の設定はこの端末のまま');
  // 2台目で単語を消す → 1台目でも消える
  await B.page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('eq.settings.v2'));
    s.modes.custom.words = s.modes.custom.words.filter((w) => w.id !== 'w1');
    s.modes.custom.gone = { w1: Date.now() };
    localStorage.setItem('eq.settings.v2', JSON.stringify(s));
  });
  await B.page.reload();
  await B.page.waitForSelector('button.start');
  await B.page.getByRole('button', { name: '設定' }).click();
  await sleep(800);
  // （reload で書いたものは touched を通らないので、今すぐ同期で送る）
  await B.page.evaluate(() => {
    const at = JSON.parse(localStorage.getItem('eq.sync.at.v1') || '{}');
    at['eq.settings.v2'] = Date.now();
    localStorage.setItem('eq.sync.at.v1', JSON.stringify(at));
  });
  await B.page.reload();
  await B.page.waitForSelector('button.start');
  await B.page.getByRole('button', { name: '設定' }).click();
  await sleep(500);
  await B.top().getByRole('button', { name: '今すぐ同期' }).click();
  await sleep(2500);
  // 1台目: アプリに戻ったら同期（今すぐ同期）
  await A.top().getByRole('button', { name: '今すぐ同期' }).click();
  await sleep(2500);
  const ap = await A.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), P);
  const as = await A.page.evaluate(() => JSON.parse(localStorage.getItem('eq.settings.v2')));
  ok(Object.keys(ap.items).length === 2, '1台目: 2台目の記録が届く');
  ok(as.modes.custom.words.map((w) => w.id).sort().join() === 'w2,w3', '1台目: 2台目で消した単語は消え、2台目の単語は届く');
  ok(as.typing === 'skip', '1台目: 文字入力の設定はこの端末のまま');
  // 画面にも反映（ホームの記録の数）
  await A.top().locator('button.back').click();
  await sleep(900);
  ok(A.errors.length === 0 && B.errors.length === 0, `コンソールエラーなし ${[...A.errors, ...B.errors].join(' / ')}`);
} finally {
  await b.close();
  server.kill();
}
console.log(failed ? `\n${failed} 件失敗` : '\nすべて成功');
process.exit(failed ? 1 : 0);
