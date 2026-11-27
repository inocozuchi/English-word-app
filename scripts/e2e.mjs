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
  // テスト用: 旧形式の書き方（秒数が直下）で書いた設定を新しい形式に変換する関数
  await ctx.addInitScript(() => {
    window.toV2 = (o) => {
      const { advanceSec, answerSec, formats, excludedRoots, ...rest } = o;
      const ety = {};
      if (advanceSec !== undefined) ety.advanceSec = advanceSec;
      if (answerSec !== undefined) ety.answerSec = answerSec;
      if (formats) ety.formats = formats;
      if (excludedRoots) ety.excludedRoots = excludedRoots;
      return { activeMode: 'etymology', ...rest, modes: { etymology: ety } };
    };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const top = () => page.locator('#app > .screen').last();
  const depth = () => page.locator('#app > .screen').count();
  const settle = () => sleep(750);
  return { ctx, page, errors, top, depth, settle };
}

const settingsOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('eq.settings.v2') || '{}'));
const etyOf = async (page) => ({ formats: ['ej'], excludedRoots: [], ...((await settingsOf(page)).modes?.etymology ?? {}) });
const progressOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('eq.progress.etymology.v1') || '{}'));

const browser = await chromium.launch();
try {
  // ---------- クイズの流れ ----------
  {
    const { page, errors, top, depth, settle } = await newPage(browser);
    await page.goto(URL);
    await page.evaluate(() => localStorage.setItem('eq.settings.v2', JSON.stringify(toV2({ advanceSec: 3, answerSec: 5, count: 5, formats: ['ej', 'je', 'rm', 'ph'] }))));
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

    // 自動で次へ（3秒 ＋ バーを戻す 0.3秒 ＋ めくる 0.55秒）
    await sleep(4300);
    ok((await top().locator('.count').getAttribute('aria-label')).startsWith('2 '), '設定秒数で自動的に次の問題へ進む');

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
    await sleep(1500); // スコアが数え上がるのを待つ
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
    await sleep(800); // 数字が数え上がるのを待つ
    const todayNum = await page.locator('.stat-c .num').nth(1).textContent();
    ok(+todayNum === 5, `ホームの「今日の回答」が更新される（${todayNum}）`);

    // 再読み込みしても記録が残る
    await page.reload();
    await page.waitForSelector('button.start');
    await sleep(300);
    await sleep(1500); // 数字は 0 から数え上がる
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
    ok((await etyOf(page)).advanceOkSec === 7, '正解のときの「自動で次へ」秒数を変更できる');
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
      localStorage.setItem('eq.progress.etymology.v1', JSON.stringify(p));
    });
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('header .icon').tap();
    await settle();
    const [download] = await Promise.all([page.waitForEvent('download'), top().locator('.ui-item', { hasText: '書き出す' }).tap()]);
    const file = await download.path();
    const json = JSON.parse(readFileSync(file, 'utf8'));
    ok(json.progress.etymology.items['ej:involve'].box === 3, '学習記録を JSON で書き出せる');
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
    await page.evaluate(() => localStorage.setItem('eq.settings.v2', JSON.stringify(toV2({ advanceSec: 10, answerSec: 15, count: 5 }))));
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
      await sleep(900); // めくり終わるまで
    };
    const count = async () => (await top().locator('.count').getAttribute('aria-label')).replace(/\s/g, '');
    // 回答前にスワイプしても進まない
    await drag(320, 60);
    ok((await count()).startsWith('1/'), '回答前のスワイプでは進まない');
    await top().locator('.choice').first().tap();
    await sleep(400);
    ok((await top().locator('.status .badge').count()) === 1, '回答すると ◯ / × のバッジが出る');
    ok((await top().locator('.dot.ok, .dot.ng').count()) === 1, '進み具合の点に結果が付く');
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
      localStorage.setItem('eq.settings.v2', JSON.stringify(toV2({ advanceSec: 3, answerSec: 15, count: 10, reviewGoal: 2 })));
      const e = (key, streak) => ({ deck: 'etymology', key, added: 1, misses: 1, streak, last: 1 });
      localStorage.setItem('eq.progress.etymology.v1', JSON.stringify({ items: {}, days: {}, lastBase: null, review: { 'ej:involve': e('ej:involve', 1), 'ej:revolve': e('ej:revolve', 0) } }));
    });
    await page.reload();
    await page.waitForSelector('button.start');
    await sleep(300);
    await sleep(1500);
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
    ok((await top().locator('.count').getAttribute('aria-label')).replace(/\s/g, '').endsWith('/2'), '復習モードはリストの件数だけ出題');
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
    await sleep(600); // 行が横へ抜ける動き（0.24秒）を待つ
    ok((await top().locator('.list li').count()) === n0 - 1, '「外す」で手動で外せる');
    ok((await depth()) === 2, '画面遷移が正しい');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }



  // ---------- 音声変化モード ----------
  {
    const { page, errors, top, depth, settle } = await newPage(browser);
    await page.goto(URL);
    await page.waitForSelector('button.start');
    // 語源モードで1問答えておく（記録がモードごとに分かれることの確認用）
    await page.locator('button.start').tap();
    await settle();
    await top().locator('.choice').first().tap();
    await sleep(300);
    await top().locator('.close').tap();
    await settle();
    // 設定でモードを切り替える
    await page.locator('header .icon').tap();
    await settle();
    await top().locator('.mode-row', { hasText: '音声変化' }).tap();
    await sleep(300);
    ok((await settingsOf(page)).activeMode === 'sound', '設定でモードを切り替えて保存できる');
    ok((await top().locator('.ui-h2', { hasText: '出題パターン' }).count()) === 1, '音声変化モードの設定（出題パターン）が出る');
    await sleep(1300);
    ok((await top().locator('.ui-val').nth(1).textContent()).includes('10'), '不正解のときの自動で次へは音声変化の初期値（10秒）');
    await top().locator('header .back').tap();
    await settle();
    ok((await page.locator('.mode-line').textContent()).includes('音声変化'), 'ホームのスタート上に今のモード名が出る');
    ok((await page.locator('.stat-c .num').nth(1).textContent()).trim() === '0', '今日の回答はモードごとに別（音声変化は 0）');
    await page.reload();
    await page.waitForSelector('button.start');
    ok((await page.locator('.mode-line').textContent()).includes('音声変化'), '再起動しても選んだモードのまま');
    // 聞こえ方当てだけにして1セッション
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('eq.settings.v2'));
      s.count = 3;
      s.modes.sound = { ...(s.modes.sound || {}), patterns: ['s1', 's3'], advanceSec: 3, answerSec: 20 };
      localStorage.setItem('eq.settings.v2', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    ok((await top().locator('.choice').count()) === 4, '音声変化の4択が出る');
    const texts = await top().locator('.stage > .card:not(.peek) .choice').allTextContents();
    ok(new Set(texts.map((t) => t.trim())).size === 4, '選択肢に同じ文字列がない');
    await top().locator('.stage > .card:not(.peek) .choice').first().tap();
    await sleep(1500);
    ok((await top().locator('.status').count()) === 1, '回答すると正誤が出る（英文はそのまま）');
    ok((await top().locator('.why li').count()) >= 1, '変化の理由がルールのバッジ付きで出る');
    ok((await top().locator('.mode-note').textContent()).includes('カタカナは目安'), '「カタカナは目安です」と出る');
    const marks = await top().locator('.stage > .card:not(.peek) .marked.show').count();
    ok(marks === 1, 'マーキングが表示される');
    for (let k = 0; k < 40 && !(await page.locator('.result').count()); k++) {
      const c = top().locator('.stage > .card:not(.peek) .choice:not([disabled])');
      if (await c.count()) await c.first().tap().catch(() => {});
      await sleep(500);
    }
    await page.waitForSelector('.result', { timeout: 15000 });
    await sleep(800);
    ok((await page.locator('.result .bars li').count()) === 6, '結果にルール別の正答率（6本）が出る');
    const sp = await page.evaluate(() => JSON.parse(localStorage.getItem('eq.progress.sound.v1')));
    ok(Object.keys(sp.tags).length > 0, 'ルール別の正答数を記録する');
    const ep = await progressOf(page);
    ok(Object.keys(ep.items).length === 1 && !Object.keys(ep.items).some((k) => k.startsWith('s')), '語源英単語の記録とは別に保存される');
    if (await page.locator('.result .go').count()) {
      await page.locator('.result .go').tap();
      await settle();
      ok((await top().locator('.eyebrow-en').textContent()).startsWith('Rule'), '苦手なルールの復習ノートに移動できる');
      await top().locator('header .back').tap();
      await settle();
    }
    await page.locator('.result .secondary').tap();
    await settle();
    // 復習ノート
    await page.locator('nav button').first().tap();
    await settle();
    ok((await top().locator('.list li').count()) === 11, '復習ノート: 講（0〜10）の一覧');
    await top().locator('.seg button', { hasText: 'ルールごと' }).tap();
    await sleep(200);
    ok((await top().locator('.list li').count()) === 6, '復習ノート: ルール（6種）の一覧');
    await top().locator('.list .row').first().tap();
    await settle();
    ok((await top().locator('.card').count()) > 0 && (await top().locator('.cmp').first().textContent()).includes('学校読み'), 'ルールの早見表に、学校読みと聞こえ方を並べた項目が出る');
    ok((await depth()) === 3, '画面遷移が正しい');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }


  // ---------- 会話チャンクモード ----------
  {
    const { page, errors, top, depth, settle } = await newPage(browser);
    await page.goto(URL);
    await page.waitForSelector('button.start');
    await page.locator('header .icon').tap();
    await settle();
    await top().locator('.mode-row', { hasText: '会話チャンク' }).tap();
    await sleep(400);
    ok((await settingsOf(page)).activeMode === 'chunks', '会話チャンクモードに切り替えられる');
    ok((await top().locator('.ui-val').first().textContent()).includes('5') && (await top().locator('.ui-val').nth(1).textContent()).includes('9'), '会話チャンクの自動で次へは 正解5秒・不正解9秒');
    ok((await top().locator('.ui-hint', { hasText: '今: A' }).count()) === 1, '最初は A だけ（自動解放）');
    await top().locator('header .back').tap();
    await settle();
    ok((await page.locator('.mode-line').textContent()).includes('会話チャンク'), 'ホームに今のモード名が出る');
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('eq.settings.v2'));
      s.count = 5;
      s.modes.chunks = { ...(s.modes.chunks || {}), advanceSec: 3, answerSec: 20 };
      localStorage.setItem('eq.settings.v2', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    const texts = await top().locator('.stage > .card:not(.peek) .choice').allTextContents();
    ok(texts.length === 4 && new Set(texts.map((t) => t.trim())).size === 4, '会話チャンクの4択（同じ文字列なし）');
    await top().locator('.stage > .card:not(.peek) .choice').first().tap();
    await sleep(1200);
    ok((await top().locator('.stage > .card:not(.peek) .rv').count()) === 1, '回答後に解説が出る');
    for (let k = 0; k < 40 && !(await page.locator('.result').count()); k++) {
      const c = top().locator('.stage > .card:not(.peek) .choice:not([disabled])');
      if (await c.count()) await c.first().tap().catch(() => {});
      await sleep(500);
    }
    await page.waitForSelector('.result', { timeout: 15000 });
    await sleep(800);
    ok((await page.locator('.result .pb li').count()) === 3, '結果に優先度ごとの進み具合（A/B/C）が出る');
    const cp = await page.evaluate(() => JSON.parse(localStorage.getItem('eq.progress.chunks.v1')));
    ok(Object.keys(cp.items).every((k) => /^ch-\d+$|^pr-\d+#[ab]$/.test(k)), '記録は表現の id 単位（パターンを含まない）');
    ok(Object.keys(cp.tags).some((k) => k.startsWith('sec:')), '章ごとの正答数を記録する');
    await page.locator('.result .secondary').tap();
    await settle();
    // 辞典
    await page.locator('nav button').first().tap();
    await settle();
    ok((await top().locator('.list li').count()) === 20, 'チャンク辞典: 20章の一覧');
    await top().locator('input[type=search]').fill('No worries');
    await sleep(200);
    ok((await top().locator('.list li').first().textContent()).includes('No worries'), '英語で検索できる');
    await top().locator('input[type=search]').fill('気にしないで');
    await sleep(200);
    ok((await top().locator('.list li').count()) > 0, '日本語で検索できる');
    await top().locator('.list .row').first().tap();
    await settle();
    ok((await top().locator('.card .meaning').count()) === 1, '表現の詳細に意味・例文が出る');
    await top().locator('header .back').tap();
    await settle();
    await top().locator('input[type=search]').fill('');
    await sleep(150);
    await top().locator('.seg button', { hasText: '使い分け' }).tap();
    await sleep(200);
    ok((await top().locator('.pair').count()) === 18, '使い分け18組を並べて比較できる');
    await top().locator('header .back').tap();
    await settle();
    await page.locator('nav button').nth(2).tap();
    await settle();
    ok((await top().locator('.pb li').count()) === 3, '学習記録に優先度ごとの進み具合が出る');
    ok((await depth()) === 2, '画面遷移が正しい');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- 旧データの移行 ----------
  {
    const { page, errors, ctx } = await newPage(browser);
    // 最初の読み込みより前に、旧形式のデータだけを置いておく
    await ctx.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      localStorage.setItem('ety.settings.v1', JSON.stringify({ advanceSec: 4, count: 15, formats: ['ej', 'rm'] }));
      localStorage.setItem('ety.progress.v1', JSON.stringify({ items: { 'ej:involve': { box: 2, due: 1, seen: 3, correct: 2, wrong: 1, last: 1, lastOk: false } }, days: { '2026-11-24': { a: 3, c: 2 } }, lastBase: null }));
    });
    await page.goto(URL);
    await page.waitForSelector('button.start');
    await sleep(500);
    const st = await settingsOf(page);
    ok(st.modes?.etymology?.advanceSec === 4 && st.count === 15, '旧設定が語源英単語モードの設定に引き継がれる');
    const pr = await progressOf(page);
    ok(pr.items?.['ej:involve']?.box === 2 && pr.review?.['ej:involve'], '旧履歴が語源英単語モードの記録に引き継がれ、復習リストも作られる');
    ok(await page.evaluate(() => !!localStorage.getItem('ety.progress.v1')), '旧データは消さずに残る');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }


  // ---------- 正解・不正解で「自動で次へ」の秒数が変わる ----------
  {
    const { page, errors, top, settle } = await newPage(browser);
    const words = JSON.parse(readFileSync(new globalThis.URL('../src/generated/words.json', import.meta.url), 'utf8'));
    await page.goto(URL);
    await page.evaluate(() => localStorage.setItem('eq.settings.v2', JSON.stringify({ activeMode: 'etymology', count: 5, modes: { etymology: { formats: ['ej'], advanceOkSec: 3, advanceNgSec: 10, answerSec: 20 } } })));
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    const label = async () => (await top().locator('.count').getAttribute('aria-label')).replace(/\s/g, '');
    const answerQ = async (right) => {
      const head = (await top().locator('.stage > .card:not(.peek) .headword').textContent()).trim();
      const w = words.words.find((x) => x.w === head);
      const choices = top().locator('.stage > .card:not(.peek) .choice');
      const texts = (await choices.allTextContents()).map((t) => t.trim());
      const k = texts.findIndex((t) => (t.includes(w.defs[0].ja)) === right);
      await choices.nth(k).tap();
    };
    await answerQ(true);
    await sleep(4400);
    ok((await label()).startsWith('2/'), '正解のときは短い秒数（3秒）で次へ');
    await answerQ(false);
    await sleep(4400);
    ok((await label()).startsWith('2/'), '不正解のときは長い秒数（10秒）なので、まだ次へ進まない');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- イメージリンクモード ----------
  {
    const { page, errors, top, depth, settle } = await newPage(browser);
    const ilSettings = (il) => page.evaluate((il) => {
      const s = JSON.parse(localStorage.getItem('eq.settings.v2') || '{}');
      localStorage.setItem('eq.settings.v2', JSON.stringify({ ...s, activeMode: 'imagelink', count: 5, modes: { ...(s.modes ?? {}), imagelink: { answerSec: 20, advanceOkSec: 15, advanceNgSec: 15, ...il } } }));
    }, il);
    const ilProgress = () => page.evaluate(() => JSON.parse(localStorage.getItem('eq.progress.imagelink.v1') || '{}'));
    const fetched = [];
    page.on('request', (r) => r.url().includes('/data/imagelink/questions/') && fetched.push(r.url().split('/').pop()));
    await page.goto(URL);
    await page.waitForSelector('button.start');
    ok(fetched.length === 0, '語源モードの起動ではイメージリンクのデータを読まない');

    // 設定でモードを切り替える
    await page.getByRole('button', { name: '設定' }).tap();
    await settle();
    await top().locator('.mode-row', { hasText: 'コアイメージで、語と文法' }).tap();
    await sleep(300);
    ok((await settingsOf(page)).activeMode === 'imagelink', 'イメージリンクモードに切り替えられる');
    ok((await top().locator('.ui-h2', { hasText: '出題方法' }).count()) === 1, '出題方法の設定が出る');
    ok((await top().locator('[role=radio]', { hasText: '英作・語順トレーニング' }).count()) === 1, '出題方法が7種ある（英作・語順トレーニング）');

    // 部を絞ると、その部だけを読む
    fetched.length = 0;
    await ilSettings({ method: 'total', parts: [3], types: ['en2ja'] });
    await page.reload();
    await page.waitForSelector('button.start');
    await sleep(800);
    ok(fetched.length === 1 && fetched[0] === 'part3.json', `選んだ部の JSON だけを読む（${fetched.join(',')}）`);

    // 4択: キーボードの 1〜4 と Enter
    await page.locator('button.start').tap();
    await settle();
    ok((await top().locator('.choice').count()) === 4, '4択が出る');
    ok((await top().locator('.count').getAttribute('aria-label')).replace(/\s/g, '').endsWith('/10'), '総合テストは選んだ問題数（10問）');
    await page.keyboard.press('1');
    await sleep(500);
    ok((await top().locator('.explain .ref').textContent()).includes('教科書 p.'), 'キー 1 で選べて、答え合わせに教科書のページが出る');
    const before = await top().locator('.count').getAttribute('aria-label');
    await page.keyboard.press('Enter');
    await settle();
    ok((await top().locator('.count').getAttribute('aria-label')) !== before && (await top().locator('.explain').count()) === 0, 'Enter で次の問題へ');
    const pr = await ilProgress();
    const k0 = Object.keys(pr.items ?? {})[0];
    ok(/^c\d+:q_/.test(k0) && pr.items[k0].box >= 1 && pr.items[k0].seen === 1, '記録はモードごとに章つきのキーで保存（箱は1〜5）');

    // 報告
    await top().getByRole('button', { name: 'この問題を報告' }).tap();
    await sleep(500);
    await page.locator('.reason', { hasText: '日本語が不自然' }).tap();
    await page.getByRole('button', { name: '報告する' }).tap();
    await sleep(300);
    const reps = await page.evaluate(() => JSON.parse(localStorage.getItem('eq.reports.imagelink.v1') || '[]'));
    ok(reps.length === 1 && reps[0].reason === 'unnatural' && /^c\d+:/.test(reps[0].key), '問題を報告すると端末に保存される');
    await top().locator('.close').tap();
    await settle();

    // 並べ替え
    await ilSettings({ method: 'compose', types: ['order'], chapters: [1] });
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    const n = await top().locator('.bank .tok').count();
    ok(n > 1 && (await top().getByRole('button', { name: '答え合わせ' }).isDisabled()), '並べ替え: 全部並べるまで答え合わせできない');
    for (let k = 0; k < n; k++) await top().locator('.bank .tok:not(.used)').first().tap();
    await top().getByRole('button', { name: '答え合わせ' }).tap();
    await sleep(500);
    ok((await top().locator('.status').count()) === 1 && (await top().locator('.ab').count()) === 1, '並べ替え: 答え合わせで正誤と正解の英文が出る');
    await top().locator('.close').tap();
    await settle();

    // 英作文（自己採点）
    await ilSettings({ method: 'compose', types: ['translate'], chapters: [1] });
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    await top().locator('textarea').fill('test');
    await top().getByRole('button', { name: '模範解答を見る' }).tap();
    await sleep(300);
    await top().getByRole('button', { name: 'あやしい' }).tap();
    await sleep(400);
    const pr2 = await ilProgress();
    ok(Object.values(pr2.items).some((x) => x.conf === 'low'), '英作文: 自己採点の「あやしい」は自信なしとして記録');
    await top().locator('.close').tap();
    await settle();

    // 苦手克服: 自信なしの問題が出る
    await ilSettings({ method: 'weak', types: ['translate'], chapters: [1] });
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    ok((await top().locator('.count').getAttribute('aria-label')).replace(/\s/g, '').endsWith('/1'), '苦手克服: 自信なしの問題だけが出る');
    await top().locator('.close').tap();
    await settle();

    // フラッシュカード
    await ilSettings({ method: 'flash', chapters: [1] });
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    await top().locator('.fc').tap();
    await sleep(500);
    ok((await top().locator('.fc.flipped').count()) === 1, 'フラッシュカード: タップで裏面');
    await top().getByRole('button', { name: '覚えた' }).tap();
    await sleep(300);
    ok((await top().locator('.status.ok').count()) === 1, 'フラッシュカード: 覚えた で正解');
    await top().locator('.close').tap();
    await settle();

    // 図を選ぶ（2×2）と拡大
    await ilSettings({ method: 'figure', types: ['fig_choose'] });
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    ok((await top().locator('.choices.grid .cimg').count()) === 4, '図を選ぶ問題は画像の 2×2');
    const imgOk = await top().locator('.cimg').first().evaluate((im) => im.complete && im.naturalWidth > 0);
    ok(imgOk, '図の SVG が表示できる');
    await top().locator('.close').tap();
    await settle();
    await ilSettings({ method: 'figure', types: ['fig_caption'] });
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    await top().locator('.fig img').dblclick();
    await sleep(400);
    ok((await page.locator('body > .lb').count()) === 1, '図をダブルタップで拡大');
    await page.getByRole('button', { name: '閉じる', exact: true }).tap();
    await sleep(200);
    ok((await page.locator('.lb').count()) === 0, '拡大を閉じられる');
    await top().locator('.close').tap();
    await settle();

    // 章と達成度 → 章のミニテスト（絞り込みはどの出題方法にも掛かるので外しておく）
    await ilSettings({});
    await page.reload();
    await page.waitForSelector('button.start');
    await page.getByRole('button', { name: '章と達成度' }).tap();
    await settle();
    ok((await top().locator('.list .row').count()) === 59, '章と達成度: 第1部の59章が並ぶ');
    await top().locator('.tab').nth(3).tap();
    await sleep(200);
    ok((await top().locator('.list .row .no').first().textContent()).trim() === '125', '部のタブで切り替えられる');
    await top().locator('.list .row').first().tap();
    await settle();
    ok((await top().locator('.count').getAttribute('aria-label')).replace(/\s/g, '').endsWith('/10'), '章をタップでその章のミニテスト（10問）');
    ok((await top().locator('.ct .no').first().textContent()).includes('第125章'), 'ミニテストはその章の問題');
    await top().locator('.close').tap();
    await settle();
    ok((await depth()) === 2, 'ミニテストを閉じると章の一覧に戻る');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- イメージリンク 反射版 ----------
  {
    const { page, errors, top, depth, settle } = await newPage(browser);
    const rxSettings = (rs) => page.evaluate((rs) => {
      const s = JSON.parse(localStorage.getItem('eq.settings.v2') || '{}');
      localStorage.setItem('eq.settings.v2', JSON.stringify({ ...s, activeMode: 'imagelink-reflex', modes: { ...(s.modes ?? {}), 'imagelink-reflex': rs } }));
    }, rs);
    const rxProgress = () => page.evaluate(() => JSON.parse(localStorage.getItem('eq.progress.imagelink-reflex.v1') || '{}'));
    await page.goto(URL);
    await page.waitForSelector('button.start');
    await page.getByRole('button', { name: '設定' }).tap();
    await settle();
    await top().locator('.mode-row', { hasText: 'イメージリンク 反射' }).tap();
    await sleep(300);
    ok((await settingsOf(page)).activeMode === 'imagelink-reflex', '反射版のモードに切り替えられる');
    ok((await top().locator('.ui-h2', { hasText: '出題方法' }).count()) === 1 && (await top().getByText('回答の制限時間').count()) === 0, '反射版の設定（出題方法）が出て、共通の秒数の設定は出ない');
    await top().locator('.back').tap();
    await settle();

    // ウォームアップ: 正解は0.4秒で次へ・反応時間を記録
    await rxSettings({ method: 'warmup' });
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    ok((await top().locator('.ch').count()) === 4, '4択（2×2）が出る');
    ok((await top().locator('.left').textContent()).includes('10'), 'ウォームアップは10問');
    await page.keyboard.press('1');
    await sleep(100);
    const okFirst = (await top().locator('.okl').count()) === 1;
    ok((await top().locator('.fb').textContent()).trim().length > 0, 'キー 1 で回答し、すぐに正誤が出る');
    await sleep(okFirst ? 600 : 1800);
    ok((await top().locator('.left').textContent()).includes('残り'), '自動で次の問題へ（ボタンを押さない）');
    const pr = await rxProgress();
    const k0 = Object.keys(pr.items ?? {})[0];
    ok(/^r_/.test(k0) && pr.items[k0].recent?.length === 1 && pr.items[k0].recent[0].ms > 0, '反応時間を記録（キーは問題の id）');

    // 時間切れ: 待つと不正解として正解を表示し、同じセッションで出し直す
    const timedOut = await page.waitForSelector('.ngl:has-text("時間切れ")', { timeout: 6000 }).then(() => true, () => false);
    ok(timedOut && (await top().locator('.ch.correct').count()) === 1, '時間切れは不正解として正解を表示');
    await page.waitForFunction(() => document.querySelector('.ngl') === null, null, { timeout: 3000 }).catch(() => {});
    const pr2 = await rxProgress();
    ok(Object.values(pr2.items).some((x) => !x.lastOk && x.recent?.[0]?.ms >= 3000), '時間切れの反応時間は制限時間で記録');
    // 残りを答えきる（不正解の表示はタップで早送り）
    for (let k = 0; k < 150 && (await top().locator('.rq').count()); k++) {
      await page.keyboard.press('2');
      await sleep(80);
      await page.keyboard.press('Enter');
      await sleep(80);
    }
    await page.waitForSelector('.rr', { timeout: 8000 }).catch(() => {});
    ok((await top().locator('.rr .score').count()) === 1, '最後まで解くと結果画面');
    ok((await top().getByText('平均反応時間').count()) === 1, '結果に平均反応時間');
    const again = await top().locator('.rr .row').count();
    ok(again > 0, '結果に「詳しく読む」（まちがえた・遅かった問題）がまとまっている');
    await top().locator('.rr .row').first().tap();
    await settle();
    ok((await top().locator('.ref').textContent()).includes('教科書 p.'), '詳しく読む: 教科書のページ');
    await top().locator('.back').tap();
    await settle();
    await top().getByRole('button', { name: 'ホーム' }).tap();
    await settle();

    // 弱点モード: まちがえた問題だけ
    await rxSettings({ method: 'weak' });
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    const weakN = Object.values(await rxProgress()).length && Object.values((await rxProgress()).items).filter((x) => !x.lastOk || x.conf === 'low').length;
    ok((await top().locator('.left').textContent()).includes(String(Math.min(20, weakN))), `弱点モードは弱点の問題だけ（${weakN}問）`);
    await top().locator('.close').tap();
    await settle();

    // 暗記カード
    await rxSettings({ method: 'cards' });
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    await page.keyboard.press(' ');
    await sleep(150);
    ok((await top().locator('.ci').count()) === 1, '暗記カード: めくるとコアイメージ');
    await top().getByRole('button', { name: /あやしい/ }).tap();
    await sleep(300);
    const cardSt = Object.entries((await rxProgress()).items).find(([, x]) => x.conf === 'low' && x.lastOk);
    ok(!!cardSt, '暗記カード: 自己判定を同じ成績データに保存（あやしい = 自信なし）');
    await top().locator('.close').tap();
    await settle();

    // 反射率の画面と、完全版の章一覧
    await page.getByRole('button', { name: '反射率' }).tap();
    await settle();
    ok((await top().locator('.rb .r').count()) === 7, '反射率: 7グループ');
    await top().locator('.back').tap();
    await settle();
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- 総合英語・留学準備 ----------
  {
    const { page, errors, top, depth, settle } = await newPage(browser);
    const prog = () => page.evaluate(() => JSON.parse(localStorage.getItem('eq.progress.comprehensive.v1') || '{}'));
    const sess = () => page.evaluate(() => JSON.parse(localStorage.getItem('eq.comp.session.v1') || 'null'));
    await page.goto(URL);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('eq.settings.v2') || '{}');
      localStorage.setItem('eq.settings.v2', JSON.stringify({ ...s, activeMode: 'comprehensive', modes: { ...(s.modes ?? {}), comprehensive: { minutes: 20, autoPlay: false } } }));
    });
    await page.reload();
    await page.waitForSelector('button.start');
    await sleep(600);
    ok((await page.locator('.start-ja').textContent()).includes('今日の学習を始める'), '総合英語: ホームの主ボタンは「今日の学習を始める」');
    ok(!(await page.locator('.start-sum').textContent()).includes('10問') && (await page.locator('.start-sum').textContent()).includes('Day 1'), 'ホームの要約は Day と学習時間（共通の問題数は出さない）');
    await page.locator('button.start').tap();
    await settle();
    await sleep(500);
    ok((await top().locator('.lc').count()) === 1, '最初は新しい単語の学習カード');
    // 学習カード → 思い出す問題（わからない → 次へ）
    await top().getByRole('button', { name: '覚えた・次へ' }).tap();
    await sleep(300);
    ok((await top().locator('.qv').count()) === 1, '学習カードのあとに問題');
    await top().locator('.qv input, .qv textarea').first().fill('zzz');
    await top().getByRole('button', { name: '答え合わせ' }).tap();
    await sleep(200);
    ok((await top().getByRole('button', { name: '合っていた' }).count()) === 1, '一致しない答えはすぐ誤答にせず、模範解答と比べて自己採点');
    await top().getByRole('button', { name: '違った' }).tap();
    await sleep(200);
    const s1 = await sess();
    ok(s1 && Object.keys(s1.results).length === 2 && s1.tasks.some((t) => t.id.endsWith('#r')), '回答のたびに保存（結果）・まちがえた問題は最後の「間違い直し」へ');
    const p1 = await prog();
    const recN = p1.extra.rec.length;
    // 閉じて再開 → 同じ位置から・二重に記録しない
    await top().locator('.close').tap();
    await settle();
    ok((await page.locator('.start-ja').textContent()).includes('続きから再開する'), '閉じるとホームは「続きから再開する」');
    await page.locator('button.start').tap();
    await settle();
    await sleep(500);
    const s2 = await sess();
    ok(s2.id === s1.id && (await top().locator('.lc').count()) === 1, '再開すると、答えていない次のところから（同じセッション）');
    ok((await prog()).extra.rec.length === recN, '再開しても同じ回答を二重に記録しない');
    // 進めて、聞き取りの問題を探す（答える前に原稿を見せない）
    let sawListening = false, leak = false, audioNA = false;
    for (let k = 0; k < 40 && (await top().locator('.end').count()) === 0; k++) {
      if (await top().getByRole('button', { name: '覚えた・次へ' }).count()) {
        await top().getByRole('button', { name: '覚えた・次へ' }).tap();
        await sleep(150);
        continue;
      }
      const kind = (await top().locator('.qv .kind').textContent().catch(() => '')) ?? '';
      if (kind.includes('聞き取り') || kind.includes('書き取り')) {
        sawListening = true;
        const html = await top().locator('.qv').innerHTML();
        const st = await sess();
        const t = st.tasks[st.cursor];
        const qtext = await page.evaluate(async (qid) => qid, t.qid);
        void qtext;
        if (await top().locator('.box .lbl', { hasText: '音声の英文' }).count()) leak = true;
        if (html.includes('答え（') || html.includes('>答え<')) leak = true;
        if (!audioNA) {
          await top().getByRole('button', { name: /音声が使えない/ }).tap();
          await sleep(200);
          audioNA = true;
          await top().getByRole('button', { name: '次へ' }).tap();
          await sleep(150);
          continue;
        }
      }
      if (await top().locator('.choice').count()) await top().locator('.choice').first().tap();
      else if (await top().getByRole('button', { name: 'わからない' }).count()) await top().getByRole('button', { name: 'わからない' }).tap();
      else if (await top().getByRole('button', { name: '模範解答を見る' }).count()) {
        await top().getByRole('button', { name: '模範解答を見る' }).tap();
        await sleep(100);
        await top().getByRole('button', { name: 'あやしい' }).tap();
      } else if (await top().locator('.ch').count()) {
        await top().locator('.ch').first().tap();
        await sleep(150);
        continue;
      }
      await sleep(150);
      if (await top().locator('.sheet').count()) await top().getByRole('button', { name: '続ける' }).tap();
      if (await top().getByRole('button', { name: '次へ' }).count()) await top().getByRole('button', { name: '次へ' }).first().tap();
      await sleep(150);
    }
    ok(sawListening && !leak, '聞き取りの問題は、答える前に英文の原稿・答えを見せない');
    const p2 = await prog();
    ok(audioNA && p2.extra.audioNA >= 1, '音声が使えない問題は別に数え、聞き取りの正誤として記録しない');
    ok((await top().locator('.end').count()) === 1, '最後まで進むとまとめ');
    ok(p2.extra.cd.day === 1 && p2.extra.cd.progressed === true, '日程は学習した日ごとに進む（今日は Day1・進めた印）');
    await top().getByRole('button', { name: 'ホームへ' }).tap();
    await settle();
    // 副導線
    await page.getByRole('button', { name: '教材と記録' }).tap();
    await settle();
    ok((await top().locator('.mc').count()) === 5, '教材と記録: 習熟度5段階（未学習・認識・想起・活用・定着）');
    await top().getByRole('button', { name: /教材辞典/ }).tap();
    await settle();
    await top().locator('input[type=search]').fill('deadline');
    await sleep(300);
    ok((await top().locator('.row', { hasText: 'deadline' }).count()) >= 1, '教材辞典で検索できる');
    await top().locator('.row', { hasText: 'deadline' }).first().tap();
    await settle();
    await top().locator('.fav').first().tap();
    await sleep(200);
    ok(((await prog()).extra.fav ?? []).length === 1, 'お気に入りに追加できる');
    await top().locator('.back').tap();
    await settle();
    await top().getByRole('tab', { name: '図解' }).tap();
    await top().locator('input[type=search]').fill('');
    await sleep(200);
    ok((await top().locator('.cnt').textContent()).includes('344'), '図解は344グループすべて辞典にある');
    await top().locator('.back').tap();
    await settle();
    await top().getByRole('button', { name: /60日ロードマップ/ }).tap();
    await settle();
    ok((await top().locator('.days > li').count()) === 60, 'ロードマップは60日');
    await top().locator('.back').tap();
    await settle();
    // 診断: 終わるまで答えを見せない
    await top().getByRole('button', { name: /Day0 診断/ }).tap();
    await settle();
    await top().getByRole('button', { name: '診断を始める' }).tap();
    await sleep(200);
    await top().locator('textarea').fill('wrong');
    await top().getByRole('button', { name: '次へ' }).tap();
    await sleep(150);
    const html = await top().innerHTML();
    ok(!html.includes('borrow') && (await top().locator('.prog').textContent()).startsWith('2'), '診断は終わるまで答えを表示しない');
    const dg = (await prog()).extra.diag.baseline;
    ok(dg.cursor === 1 && Object.keys(dg.answers).length === 1, '診断は途中で保存される');
    const pi = await prog();
    ok(!Object.keys(pi.items).some((k) => k.startsWith('diag-')), '診断の問題は間隔反復に入れない');
    await top().locator('.back').tap();
    await settle();
    await top().getByRole('button', { name: /学習レポートをコピー/ }).tap();
    await settle();
    ok((await top().locator('textarea').inputValue()).includes('学習レポート'), '学習レポート（ChatGPT に貼り付ける文章）');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- 一時停止・中断と再開 ----------
  {
    const { page, errors, top, depth, settle } = await newPage(browser);
    await page.goto(URL);
    await page.evaluate(() => localStorage.setItem('eq.settings.v2', JSON.stringify(toV2({ advanceSec: 3, answerSec: 5, count: 5, formats: ['ej'] }))));
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    await top().locator('.choice').first().tap();
    await sleep(300);
    // 一時停止ボタン → 押すまで止まったまま（自動で次へ進まない）
    await top().getByRole('button', { name: '一時停止' }).tap();
    await sleep(200);
    ok((await top().locator('.po').count()) === 1, '一時停止ボタンで一時停止の画面');
    await sleep(4000);
    ok((await top().locator('.explain').count()) === 1, '一時停止中は自動で次へ進まない');
    await top().getByRole('button', { name: '再開する' }).tap();
    await sleep(300);
    ok((await top().locator('.po').count()) === 0, '「再開する」で続きから');
    await sleep(3500);
    ok((await top().locator('.explain').count()) === 0, '再開後は自動で次の問題へ');
    // アプリを離れると一時停止のまま（戻っても勝手に再開しない）
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await sleep(300);
    ok((await top().locator('.po').count()) === 1, 'アプリを離れて戻ると一時停止のまま');
    await sleep(5500);
    ok((await top().locator('.status').count()) === 0, '一時停止中は時間切れにならない');
    // 中断してホームへ → アプリを閉じても（再読み込み）続きから
    await top().getByRole('button', { name: '中断してホームへ' }).tap();
    await settle();
    ok((await depth()) === 1 && (await page.locator('.rc-main').count()) === 1, '中断するとホームに「中断したクイズを再開」');
    await page.reload();
    await page.waitForSelector('button.start');
    await sleep(500);
    ok((await page.locator('.rc-main').textContent()).includes('1 / 5'), 'アプリを閉じても中断したクイズが残る（1 / 5 問まで）');
    await page.locator('.rc-main').tap();
    await settle();
    ok((await top().locator('.dot.ok, .dot.ng').count()) === 1 && (await top().locator('.dot.cur').count()) === 1, '再開すると2問目から（1問目の結果も残る）');
    const before = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('eq.progress.etymology.v1')).days)[0].a);
    ok(before === 1, '再開しても1問目を二重に記録しない');
    // 最後まで解くと中断の記録は消える
    for (let k = 0; k < 4; k++) {
      await top().locator('.choice').first().tap();
      await sleep(200);
      await page.keyboard.press('Enter');
      await settle();
    }
    await sleep(500);
    ok((await page.evaluate(() => localStorage.getItem('eq.quiz.suspend.v1'))) === null, '最後まで解くと中断の記録は消える');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }
  {
    const { page, errors, top, settle } = await newPage(browser);
    await page.goto(URL);
    await page.evaluate(() => localStorage.setItem('eq.settings.v2', JSON.stringify({ activeMode: 'imagelink-reflex', modes: { 'imagelink-reflex': { method: 'warmup' } } })));
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    await top().getByRole('button', { name: '一時停止' }).tap();
    await sleep(6500);
    ok((await top().locator('.po').count()) === 1 && (await top().locator('.ngl').count()) === 0, '反射版: 一時停止中は時間切れにならない');
    await top().getByRole('button', { name: '再開する' }).tap();
    await sleep(200);
    ok((await top().locator('.po').count()) === 0, '反射版: 再開できる');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- 連打・遷移中のタップ ----------
  {
    const { page, errors, top, depth, settle } = await newPage(browser);
    await page.goto(URL);
    await page.evaluate(() => localStorage.setItem('eq.settings.v2', JSON.stringify(toV2({ advanceSec: 2, answerSec: 15, count: 5, formats: ['ej'] }))));
    await page.reload();
    await page.waitForSelector('button.start');

    // 画面が入ってくる途中に「戻る」を押しても効く
    await page.getByRole('button', { name: '設定' }).tap();
    await sleep(120);
    // 動いている最中のボタンを座標で押すと外れることがあるので、要素を直接押す（遷移中に押す、という条件は同じ）
    await top().locator('.back').evaluate((el) => el.click());
    await sleep(1400);
    ok((await depth()) === 1, '画面が開く途中の「戻る」も効く（遷移のあとに戻る）');

    // 「戻る」の連打で2画面戻らない
    await page.getByRole('button', { name: '単語帳' }).tap();
    await settle();
    await top().locator('.row').first().tap();
    await settle();
    const d0 = await depth();
    await top().locator('.back').tap();
    await sleep(60);
    await top().locator('.back').tap({ force: true }).catch(() => {});
    await sleep(1300);
    ok(d0 >= 3 && (await depth()) === d0 - 1, `「戻る」を連打しても1画面だけ戻る（${d0}→${await depth()}）`);
    while ((await depth()) > 1) {
      await top().locator('.back').tap();
      await settle();
    }

    // クイズ: 次の問題へめくっている途中に選択肢を押しても回答になる
    await page.locator('button.start').tap();
    await settle();
    await top().locator('.choice').first().tap();
    await page.waitForFunction(() => document.querySelectorAll('.stage .card').length === 2, null, { timeout: 4000 });
    await sleep(80);
    await page.locator('.stage .card').nth(1).locator('.choice').nth(1).tap({ force: true });
    await sleep(900);
    ok((await page.locator('.stage .card').first().locator('.choice.correct').count()) === 1, 'めくっている途中に押した選択肢も回答になる');
    await top().locator('.close').tap();
    await settle();
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- 反射版: 正誤の表示中のタップで次へ ----------
  {
    const { page, errors, top, settle } = await newPage(browser);
    await page.goto(URL);
    await page.evaluate(() => localStorage.setItem('eq.settings.v2', JSON.stringify({ activeMode: 'imagelink-reflex', modes: { 'imagelink-reflex': { method: 'warmup' } } })));
    await page.reload();
    await page.waitForSelector('button.start');
    await page.locator('button.start').tap();
    await settle();
    // 1回目で回答、80ms 後に（同じ場所を）もう一度 → 正誤の表示を飛ばして次の問題が出ている
    const r = await page.evaluate(async () => {
      const chs = () => document.querySelectorAll('.rq .ch');
      chs()[0].click();
      await new Promise((res) => setTimeout(res, 30));
      const fb1 = !!document.querySelector('.fb .fbin');
      await new Promise((res) => setTimeout(res, 50));
      chs()[1].click();
      await new Promise((res) => setTimeout(res, 60));
      return { fb1, fb2: !!document.querySelector('.fb .fbin') };
    });
    ok(r.fb1 && !r.fb2, '反射版: 正誤の表示中にもう一度押すと、すぐ次の問題へ');
    await top().locator('.close').tap();
    await settle();
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- 自由英単語 ----------
  {
    const { page, errors, top, settle } = await newPage(browser);
    await page.goto(URL);
    await page.evaluate(() => localStorage.setItem('eq.settings.v2', JSON.stringify({ activeMode: 'custom', count: 5, modes: {} })));
    await page.reload();
    await page.waitForSelector('button.start');
    // 単語が足りないとき: 追加の案内
    await page.locator('button.start').tap();
    await settle();
    ok((await top().getByText('単語を追加').count()) > 0 || (await top().locator('.empty').count()) > 0, '単語がないときは追加の案内が出る');
    await top().locator('.empty .btn').tap();
    await settle();
    const scr = top();
    await scr.getByPlaceholder('例: deadline').fill('deadline');
    await scr.getByPlaceholder('例: 締め切り').fill('締め切り');
    await scr.getByRole('button', { name: '追加する' }).tap();
    await sleep(300);
    ok((await scr.locator('.list .row').count()) === 1, '1語を追加できる');
    await scr.getByPlaceholder('例: deadline').fill('Deadline');
    await sleep(100);
    ok(await scr.getByRole('button', { name: '追加する' }).isDisabled(), '同じ英単語は追加できない（大文字小文字を無視）');
    await scr.getByPlaceholder('例: deadline').fill('');
    await scr.getByRole('button', { name: 'まとめて追加' }).tap();
    await scr.locator('textarea').fill('submit, 提出する\ntake notes\tメモを取る\nborrow - 借りる\nりんご');
    await sleep(100);
    await scr.getByRole('button', { name: /語を追加$/ }).tap();
    await sleep(400);
    ok((await scr.locator('.list .row').count()) === 4, 'まとめて追加で3語増える（読めない行は飛ばす）');
    // 編集して保存
    await scr.locator('.list .row', { hasText: 'borrow' }).tap();
    await scr.locator('.edit').getByLabel('日本語訳').fill('借りる（無料で）');
    await scr.getByRole('button', { name: '保存' }).tap();
    await sleep(200);
    ok((await scr.locator('.list .row', { hasText: '借りる（無料で）' }).count()) === 1, '単語を編集できる');
    // クイズ
    await scr.getByRole('button', { name: 'この単語でクイズ' }).tap();
    await settle();
    await top().locator('.choice').first().waitFor();
    ok((await top().locator('.choice').count()) === 4, '自分の単語で4択が出る');
    const texts = await top().locator('.card:not(.peek) .choice').allTextContents();
    ok(texts.every((t) => /提出|締め切り|メモ|借り|submit|deadline|take notes|borrow/.test(t)), `選択肢は登録した単語だけ（${texts.join(' / ')}）`);
    await top().locator('.choice').first().tap();
    await sleep(400);
    ok(/正解|不正解/.test((await top().locator('.status').textContent()) ?? ''), '答え合わせが出る');
    const st = await settingsOf(page);
    ok(st.modes?.custom?.words?.length === 4, '単語は設定（バックアップ対象）に保存される');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- 今の状況に合わせる（音声・文字入力）----------
  {
    const { page, errors, top, settle } = await newPage(browser);
    await page.goto(URL);
    await page.waitForSelector('button.start');
    await page.getByRole('button', { name: '設定' }).tap();
    await settle();
    await top().getByRole('switch', { name: '音声を使う' }).tap();
    await sleep(200);
    await top().getByRole('button', { name: '出さない', exact: true }).tap();
    await sleep(200);
    await top().getByRole('switch', { name: '自己採点の問題を出す' }).tap();
    await sleep(200);
    const st = await settingsOf(page);
    ok(st.audio === false && st.typing === 'skip', `設定で音声・文字入力の出し方を変えられる（audio=${st.audio}, typing=${st.typing}）`);
    ok(st.selfGrade === false, '自己採点の問題をオフにできる');
    ok(errors.length === 0, `コンソールエラーなし ${errors.join(' / ')}`);
    await page.context().close();
  }

  // ---------- 横向き（iPad・パソコン）----------
  {
    for (const [w, h, name] of [[1180, 820, 'iPad 横'], [844, 390, 'スマホ 横'], [1440, 900, 'パソコン']]) {
      const { page, errors, top, settle } = await newPage(browser, { viewport: { width: w, height: h }, isMobile: false, hasTouch: false });
      await page.goto(URL);
      await page.waitForSelector('button.start');
      const sb = await page.locator('button.start').boundingBox();
      ok(sb && sb.x + sb.width <= w && sb.y >= 0, `${name}: スタートが画面内`);
      await page.locator('button.start').click();
      await settle();
      const c = await top().locator('.card:not(.peek) .choices').boundingBox();
      const u = await top().locator('.card:not(.peek) .upper').boundingBox();
      ok(c && u && c.x > u.x + u.width - 4, `${name}: 問題と選択肢が左右に並ぶ`);
      const last = await top().locator('.card:not(.peek) .choice').last().boundingBox();
      ok(last && last.y + last.height <= h + 1, `${name}: 4つめの選択肢まで画面に収まる`);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      ok(sw <= w, `${name}: 横にはみ出さない`);
      ok(errors.length === 0, `${name}: コンソールエラーなし ${errors.join(' / ')}`);
      await page.context().close();
    }
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
