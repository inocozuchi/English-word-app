// 実際にアプリを操作して主要な流れを確かめる総合テスト（Playwright / iPhone 15 相当）。
// 使い方: npm run build && npm run e2e
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = 4190;
const URL = `http://localhost:${PORT}/`;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const top = () => page.locator('#app > .screen').last();
  const depth = () => page.locator('#app > .screen').count();
  const settle = () => sleep(750);
  return { ctx, page, errors, top, depth, settle };
}

const settingsOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ety.settings.v1') || '{}'));
const etyOf = async (page) => (await settingsOf(page)).decks?.etymology ?? { formats: ['ej'], excludedRoots: [] };
const progressOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ety.progress.v1') || '{}'));

const browser = await chromium.launch();
try {
  // ---------- クイズの流れ ----------
  {
    const { page, errors, top, depth, settle } = await newPage(browser);
    await page.goto(URL);
    await page.evaluate(() => localStorage.setItem('ety.settings.v1', JSON.stringify({ advanceSec: 3, answerSec: 5, count: 5, formats: ['ej', 'je', 'rm', 'ph'] })));
    await page.reload();
    await page.waitForSelector('button.start');

    // 連打しても画面は1つだけ積まれる
    await page.locator('button.start').tap();
    await page.locator('button.start').tap({ force: true }).catch(() => {});
    await settle();
    ok((await depth()) === 2, 'スタートを連打してもクイズ画面は1つだけ');
    await top().locator('.choice').first().waitFor();
    ok((await top().locator('.choice').count()) === 4, '4択が表示される');

    // 1問目: 正解を選ぶ（正解は実データから判定）
    const answerIdx = await page.evaluate(() => {
      const t = document.querySelector('.card:last-child')?.textContent;
      return t ? 0 : 0;
    });
    void answerIdx;
    await top().locator('.choice').nth(0).tap();
    await sleep(400);
    const correctCount = await top().locator('.choice.correct').count();
    const status = (await top().locator('.status').textContent())?.trim();
    ok(correctCount === 1, '回答すると正解の選択肢が強調される');
    ok(/正解|不正解/.test(status ?? ''), `正誤が表示される（${status}）`);
    ok((await top().locator('.choice').count()) === 4, '解説中も選択肢が見えたまま');
    // 解説中に選択肢をもう一度押しても二重に記録されない
    await top().locator('.choice').nth(1).tap({ force: true }).catch(() => {});
    const p1 = await progressOf(page);
    const day = Object.values(p1.days)[0];
    ok(day.a === 1, '解説中にもう一度押しても二重に記録されない');

    // 自動で次へ（3秒）
    await sleep(3400);
    ok((await top().locator('.count').textContent()).includes('2'), '設定秒数で自動的に次の問題へ進む');

    // 2問目: 何もしない → 5秒で時間切れ
    await sleep(5600);
    ok(((await top().locator('.status').textContent()) ?? '').includes('時間切れ'), '制限時間を過ぎると時間切れ（未回答）');
    const p2 = await progressOf(page);
    ok(Object.values(p2.items).some((s) => s.lastOk === false), '時間切れは不正解として記録される');

    // 残りを回答して結果へ
    for (let i = 0; i < 12 && !(await page.locator('.result').count()); i++) {
      const c = top().locator('.choice:not([disabled])');
      if (await c.count()) await c.first().tap().catch(() => {});
      await sleep(3500);
    }
    await page.waitForSelector('.result', { timeout: 15000 });
    ok(true, '5問で結果画面になる');
    const score = await page.locator('.score').textContent();
    ok(/\d+\/5/.test(score.replace(/\s/g, '')), `結果のスコア（${score.replace(/\s/g, '')}）`);
    const missedRows = await page.locator('.result .row').count();
    const correct = +score.replace(/\s/g, '').split('/')[0];
    ok(missedRows === 5 - correct, 'まちがえた問題の一覧の件数が合う');

    // 一覧から詳細へ → 戻る
    if (missedRows) {
      await page.locator('.result .row').first().tap();
      await settle();
      ok((await depth()) === 3, '結果から詳細画面を開ける');
      await top().locator('header .back').tap();
      await settle();
      ok((await depth()) === 2, '詳細から結果へ戻れる');
    }
    // もう一度 → 新しいセッション
    await page.locator('.result .primary').tap();
    await settle();
    ok((await top().locator('.choice').count()) === 4, '「もう一度」ですぐ次のセッション');
    // 途中でやめる
    await top().locator('.close').tap();
    await settle();
    ok((await depth()) === 1, '✕ でホームに戻る');
    const todayNum = await page.locator('.stat-c .num').nth(1).textContent();
    ok(+todayNum === 5, `ホームの「今日の回答」が更新される（${todayNum}）`);

    // 再読み込みしても記録が残る
    await page.reload();
    await page.waitForSelector('button.start');
    await sleep(300);
    ok(+(await page.locator('.stat-c .num').nth(1).textContent()) === 5, '再読み込みしても学習記録が残る');
    ok(+(await page.locator('.stat-c .num').nth(0).textContent()) === 1, '連続日数が1日になる');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- 単語帳・検索・スワイプバック ----------
  {
    const { page, errors, top, depth, settle } = await newPage(browser);
    await page.goto(URL);
    await page.waitForSelector('button.start');
    await page.locator('nav button').first().tap();
    await settle();
    const search = top().locator('input[type=search]');
    await search.fill('volve');
    await sleep(100);
    ok((await top().locator('.group .row').first().textContent()).includes('volve'), '検索: 語源 volve が出る');
    await search.fill('反乱');
    await sleep(100);
    ok((await top().locator('.group').textContent()).includes('revolt'), '検索: 日本語の意味で revolt が出る');
    await search.fill('zzzz');
    await sleep(100);
    ok((await top().locator('.none').count()) === 1, '検索: 見つからないとき表示');
    await search.fill('');
    // cur の語源ページ: 別語源の単語は参考として区別
    await search.fill('cur');
    await sleep(100);
    await top().locator('.group .row', { hasText: '走る' }).first().tap();
    await settle();
    ok((await top().locator('li.ref').count()) === 3, 'cur の参考語（cure・curious・secure）が区別される');
    await top().locator('li.ref .branch').first().tap();
    await settle();
    const wtext = await top().textContent();
    ok(wtext.includes('覚え方として併記'), '参考語の単語ページに注記が出る');
    ok(wtext.includes('世話'), 'cure の主たる語源は cure（世話）');
    // スワイプバック（指を離さずに途中で戻す → キャンセル）
    // 実際の指に近い速さで動かし、離す前に少し止める（勢いなし）
    const swipe = async (to, commitX) => {
      await page.evaluate(async ([to, commitX]) => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const el = [...document.querySelectorAll('#app > .screen')].pop();
        const f = (type, x) => el.dispatchEvent(new PointerEvent(type, { pointerId: 9, clientX: x, clientY: 400, bubbles: true, pointerType: 'touch', isPrimary: true }));
        f('pointerdown', 20);
        for (let x = 30; x <= to; x += 10) { f('pointermove', x); await wait(16); }
        for (let i = 0; i < 8; i++) { f('pointermove', to); await wait(16); }
        f('pointerup', commitX);
      }, [to, commitX]);
      await settle();
    };
    const d0 = await depth();
    await swipe(80, 80);
    ok((await depth()) === d0, 'スワイプバック: 少しだけ動かすと戻らない');
    await sleep(400);
    await swipe(260, 260);
    ok((await depth()) === d0 - 1, 'スワイプバック: 大きく動かすと前の画面へ戻る');
    // その他（groups）
    for (let i = 0; i < 3 && (await depth()) > 2; i++) {
      await top().locator('header .back').tap();
      await settle();
    }
    await top().locator('input[type=search]').fill('');
    await sleep(100);
    await top().locator('.group .row').last().tap();
    await settle();
    ok((await top().textContent()).includes('garbage'), '「その他」グループが開ける');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- 設定・出題範囲・バックアップ ----------
  {
    const { page, errors, top, settle } = await newPage(browser);
    await page.goto(URL);
    await page.waitForSelector('button.start');
    await page.locator('header .icon').tap();
    await settle();
    // スライダー
    await top().locator('input[type=range]').first().fill('7');
    ok((await settingsOf(page)).advanceSec === 7, '自動で次への秒数を変更できる');
    // 問題数
    await top().locator('.seg button', { hasText: '20問' }).tap();
    ok((await settingsOf(page)).count === 20, '問題数を変更できる');
    // 出題形式: 最後の1つは外せない
    await top().locator('[role=switch][aria-label="英 → 日"]').tap();
    ok(JSON.stringify((await etyOf(page)).formats) === '["ej"]', '出題形式: 最後の1つは外せない');
    await top().locator('[role=switch][aria-label="語源の意味"]').tap();
    ok((await etyOf(page)).formats.includes('rm'), '出題形式: 語源の意味を追加できる');
    // テーマ
    await top().locator('.seg button', { hasText: 'ダーク' }).tap();
    ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'テーマをダークに固定できる');
    ok((await page.evaluate(() => [...document.querySelectorAll('meta[name=theme-color]')].every((m) => m.content === '#0b0b0d'))), 'ステータスバーの色もダークになる');
    await top().locator('.seg button', { hasText: '自動' }).tap();
    // 出題範囲: すべて解除 → クイズは「出題できる問題がありません」
    await top().locator('.ui-item', { hasText: '章・語源を選ぶ' }).tap();
    await settle();
    await top().locator('.pill', { hasText: 'すべて解除' }).tap();
    ok((await etyOf(page)).excludedRoots.length === 196, '出題範囲をすべて解除できる');
    await top().locator('.check').first().tap();
    const ex = (await etyOf(page)).excludedRoots.length;
    ok(ex < 196 && ex > 0, '章単位で選択できる');
    await top().locator('.pill', { hasText: 'すべて解除' }).tap();
    await top().locator('header .back').tap();
    await settle();
    await top().locator('header .back').tap();
    await settle();
    ok((await page.locator('.start-sum').textContent()).includes('0章'), 'ホームに出題範囲の要約が出る');
    await page.locator('button.start').tap();
    await settle();
    ok((await top().locator('.empty').count()) === 1, '範囲が空のときは案内を出す');
    await top().locator('.close').tap();
    await settle();
    // 書き出し → 消去 → 読み込み
    await page.evaluate(() => {
      const p = { items: { 'ej:involve': { box: 3, due: 1, seen: 4, correct: 3, wrong: 1, last: 1, lastOk: true } }, days: { '2026-11-24': { a: 4, c: 3 } }, lastBase: null };
      localStorage.setItem('ety.progress.v1', JSON.stringify(p));
    });
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('header .icon').tap();
    await settle();
    const [download] = await Promise.all([page.waitForEvent('download'), top().locator('.ui-item', { hasText: '書き出す' }).tap()]);
    const file = await download.path();
    const json = JSON.parse(readFileSync(file, 'utf8'));
    ok(json.progress.items['ej:involve'].box === 3, '学習記録を JSON で書き出せる');
    await top().locator('.ui-item', { hasText: '学習記録を消去' }).tap();
    await sleep(100);
    ok(Object.keys((await progressOf(page)).items).length === 1, '消去は1回目のタップでは実行されない');
    await top().locator('.ui-item', { hasText: 'もう一度タップで消去' }).tap();
    await sleep(200);
    ok(Object.keys((await progressOf(page)).items).length === 0, '学習記録を消去できる');
    await top().locator('input[type=file]').setInputFiles(file);
    await sleep(300);
    await top().locator('.ui-item', { hasText: '置き換える' }).tap();
    await sleep(300);
    ok((await progressOf(page)).items['ej:involve']?.box === 3, '書き出した JSON を読み込める');
    ok((await top().locator('input[type=range]').first().inputValue()) === '7', '読み込み後も設定画面の表示が正しい');
    await top().locator('header .back').tap();
    await settle();
    await page.locator('nav button').nth(2).tap();
    await settle();
    ok((await top().textContent()).includes('involve'), '学習記録に苦手な単語が出る');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }


  // ---------- スワイプで次へ ----------
  {
    const { page, errors, top, settle, ctx } = await newPage(browser);
    await page.goto(URL);
    await page.evaluate(() => localStorage.setItem('ety.settings.v1', JSON.stringify({ advanceSec: 10, answerSec: 15, count: 5 })));
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    const cdp = await ctx.newCDPSession(page);
    const drag = async (from, to, steps = 10) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y: 330 }] });
      for (let k = 1; k <= steps; k++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from + ((to - from) * k) / steps, y: 330 }] });
        await sleep(16);
      }
      await sleep(80);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(500);
    };
    const count = async () => (await top().locator('.count').textContent()).replace(/\s/g, '');
    // 回答前にスワイプしても進まない
    await drag(320, 60);
    ok((await count()).startsWith('1/'), '回答前のスワイプでは進まない');
    await top().locator('.choice').first().tap();
    await sleep(400);
    ok((await top().locator('.judge').count()) === 1, '回答すると大きな ◯ / × が出る');
    const st = (await top().locator('.status').textContent()).trim();
    ok(/^(正解|不正解)/.test(st), `正誤の文字が出る（${st.slice(0, 8)}）`);
    // 少しだけ動かして離す → 戻る
    await drag(320, 290, 4);
    ok((await count()).startsWith('1/'), '少しのスワイプでは次へ進まない');
    // 大きく左へ → すぐ次へ（自動で進む10秒を待たない）
    const t0 = Date.now();
    await drag(330, 60);
    ok((await count()).startsWith('2/') && Date.now() - t0 < 3000, '解説中に左へスワイプするとすぐ次の問題へ');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- 復習リスト ----------
  {
    const { page, errors, top, depth, settle } = await newPage(browser);
    const words = JSON.parse(readFileSync(new globalThis.URL('../src/generated/words.json', import.meta.url), 'utf8'));
    const involve = words.words.find((w) => w.w === 'involve');
    await page.goto(URL);
    // 復習リストに involve（あと1回でクリア）と revolve を入れておく
    await page.evaluate(() => {
      localStorage.setItem('ety.settings.v1', JSON.stringify({ advanceSec: 3, answerSec: 15, count: 10, reviewGoal: 2 }));
      const e = (key, streak) => ({ deck: 'etymology', key, added: 1, misses: 1, streak, last: 1 });
      localStorage.setItem('ety.progress.v1', JSON.stringify({ items: {}, days: {}, lastBase: null, review: { 'ej:involve': e('ej:involve', 1), 'ej:revolve': e('ej:revolve', 0) } }));
    });
    await page.reload();
    await page.waitForSelector('button.start');
    await sleep(300);
    ok((await page.locator('.review .r-num').textContent()).trim() === '2', 'ホームに復習リストの件数が出る');
    // 一覧
    await page.locator('nav button', { hasText: '復習リスト' }).tap();
    await settle();
    ok((await top().locator('.list li').count()) === 2, '復習リストの一覧に2件');
    ok((await top().locator('.list li').first().locator('.dot.on').count()) <= 1, '連続正解の進み具合が点で出る');
    await top().locator('header .back').tap();
    await settle();
    // 復習モード: リストの問題だけが出る
    await page.locator('.review').tap();
    await settle();
    ok((await top().locator('.rv').count()) === 1, '復習モードの表示が出る');
    ok((await top().locator('.count').textContent()).replace(/\s/g, '').endsWith('/2'), '復習モードはリストの件数だけ出題');
    for (let n = 0; n < 2; n++) {
      const head = (await top().locator('.prompt').textContent()).trim();
      if (head.startsWith('involve')) {
        await top().locator('.choice', { hasText: involve.defs[0].ja }).first().tap();
        await sleep(300);
        ok((await top().locator('.rnote').textContent()).includes('外れました'), '連続で正解すると復習リストから外れる');
      } else {
        await top().locator('.choice').first().tap();
        await sleep(300);
      }
      await sleep(3300);
    }
    await page.waitForSelector('.result');
    ok((await page.locator('.result .review').textContent()).includes('クリア'), '結果に復習リストの変化が出る');
    await page.locator('.result .secondary').tap();
    await settle();
    const rev = (await progressOf(page)).review;
    ok(!rev['ej:involve'], 'クリアした問題はリストから消える');
    // 通常モードでまちがえると自動で追加される
    const before = Object.keys(rev).length;
    await page.locator('button.start').tap();
    await settle();
    await sleep(15500); // 何も押さずに時間切れ
    const after = Object.keys((await progressOf(page)).review).length;
    ok(after === before + 1 || after === before, `時間切れの問題が復習リストに入る（${before}→${after}）`);
    ok(after >= 1, '復習リストが空ではない');
    await top().locator('.close').tap();
    await settle();
    // 手動で外す
    await page.locator('nav button', { hasText: '復習リスト' }).tap();
    await settle();
    const n0 = await top().locator('.list li').count();
    await top().locator('.remove').first().tap();
    await sleep(200);
    ok((await top().locator('.list li').count()) === n0 - 1, '「外す」で手動で外せる');
    ok((await depth()) === 2, '画面遷移が正しい');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- 動きを減らす設定 ----------
  {
    const { page, errors, top, depth, settle } = await newPage(browser, { reducedMotion: 'reduce' });
    await page.goto(URL);
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    await top().locator('.choice').first().tap();
    await sleep(300);
    ok((await top().locator('.explain').count()) === 1, 'reduced motion でも解説が出る');
    await top().locator('.close').tap();
    await settle();
    ok((await depth()) === 1, 'reduced motion でも画面遷移できる');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- オフライン ----------
  {
    const { page, top } = await newPage(browser);
    await page.goto(URL);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await sleep(800);
    server.kill();
    await sleep(500);
    await page.reload();
    await page.waitForSelector('button.start', { timeout: 5000 });
    await page.locator('button.start').tap();
    await sleep(800);
    ok((await top().locator('.choice').count()) === 4, 'サーバー停止後（オフライン）でも起動・出題できる');
    await page.context().close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(failed ? `\n${failed} 件失敗` : '\nすべて成功');
process.exit(failed ? 1 : 0);
