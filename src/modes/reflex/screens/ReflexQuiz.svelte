<script lang="ts">
  // 反射版のクイズ: 問題ごとの3〜5秒の制限時間（細いバー）、選んだ瞬間に採点、
  // 正解は0.4秒・不正解は1.5秒（時間切れは1秒）で自動で次へ（タップで早送り）。解説は出さない。
  // まちがえた問題は 3〜6 問後に出し直し、2回続けて正解で終わり（engine.ts の ReflexRun）。
  // 暗記カードは 表（語）→ タップで裏（コアイメージ）→ すぐ出た／あやしい／出ない。
  import { onMount, tick } from 'svelte';
  import Icon from '../../../components/Icon.svelte';
  import ReportSheet from '../../../components/ReportSheet.svelte';
  import PauseOverlay from '../../../components/PauseOverlay.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { store, modeSettings, recordAnswer, today } from '../../../core/store.svelte.ts';
  import { reviewOrder } from '../../../core/review.ts';
  import { createRng } from '../../../core/rng.ts';
  import { haptic } from '../../../core/haptics.ts';
  import { bump, burst, popScale, shake } from '../../../core/transitions.ts';
  import { reducedMotion, spring, SPRINGS } from '../../../core/spring.ts';
  import { loadReports, saveReports, addReport, type ReportReason } from '../../../core/reports.ts';
  import { reflexMode } from '../mode.ts';
  import {
    MODE_ID,
    QuestionTimer,
    ReflexRun,
    grade,
    buildChoices,
    reflexCandidates,
    reflexPick,
    ADVANCE_OK_MS,
    ADVANCE_NG_MS,
    ADVANCE_TIMEOUT_MS,
    METHODS,
    type Built,
    type Grade,
    type Method,
  } from '../engine.ts';
  import type { RCard } from '../types.ts';
  import { rx, loadReflex, qById, cardById, figSrc, figAspect } from '../state.svelte.ts';
  import RPrompt from '../RPrompt.svelte';
  import type { ReflexLog } from '../log.ts';

  let { seed, kind = 'normal', method: forceMethod, group: forceGroup }: { seed: number; kind?: 'normal' | 'review'; method?: Method; group?: string } = $props();

  // svelte-ignore state_referenced_locally
  const settings = { ...modeSettings(reflexMode), ...(forceMethod ? { method: forceMethod } : {}), ...(forceGroup ? { group: forceGroup } : {}) };
  // svelte-ignore state_referenced_locally
  const method = kind === 'review' ? null : settings.method;
  // svelte-ignore state_referenced_locally
  const label = kind === 'review' ? '復習' : METHODS.find((m) => m.id === method)!.label;
  // svelte-ignore state_referenced_locally
  const rng = createRng(seed);

  let run: ReflexRun | null = null;
  let ready = $state(false);
  let empty = $state(false);
  /** 今の項目 */
  let built = $state<Built | null>(null);
  let card = $state<RCard | null>(null);
  let again = $state(false);
  let serial = $state(0);
  let phase = $state<'ask' | 'feedback'>('ask');
  let chosen = $state<number | null>(null);
  let result = $state<Grade | null>(null);
  let flipped = $state(false);
  let left = $state(0);
  /** 残り時間が3割を切った（バーの色を変える） */
  let late = $state(false);
  let stageEl: HTMLElement | undefined = $state();
  let total = $state(0);
  let streak = $state(0);
  let bestStreak = 0;
  let reporting = $state(false);
  /** 一時停止（ボタン・アプリを離れたとき）。「再開する」を押すまで止まったまま */
  let stopped = $state(false);
  let reported = $state('');
  const logs: ReflexLog[] = [];
  const startedAt = Date.now();

  let bar: HTMLElement | undefined = $state();
  let streakEl: HTMLElement | undefined = $state();
  let timer: QuestionTimer | null = null;
  let barAnim: Animation | null = null;
  let deadline = 0;
  let lateT = 0;
  let advanceT = 0;
  let closed = false;
  const now = () => performance.now();

  onMount(() => {
    loadReflex()
      .then(() => {
        if (closed) return;
        const st = store.progress;
        let keys: string[];
        if (kind === 'review') {
          keys = reviewOrder(st.review, rng).map((e) => e.key).filter((k) => qById.has(k) || cardById.has(k)).slice(0, 20);
        } else {
          const pool = { questions: rx.questions ?? [], cards: rx.cards };
          keys = reflexPick(reflexCandidates(pool, settings), st.items, settings, today(), rng);
        }
        run = new ReflexRun(keys, rng, { requeue: method !== 'attack' });
        total = keys.length;
        ready = true;
        if (!keys.length) empty = true;
        else show();
      })
      .catch(() => (ready = true));
    // アプリを離れたら一時停止のまま（戻っても勝手に再開しない）
    const vis = () => {
      if (document.visibilityState === 'hidden' && !closed && ready && !empty) {
        stopped = true;
        pause();
      }
    };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('keydown', onKey);
    return () => {
      closed = true;
      stopTimer();
      clearTimeout(advanceT);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('keydown', onKey);
    };
  });

  // ---- 表示 ----
  async function show() {
    const cur = run?.current;
    if (!cur) return finish();
    left = run!.left;
    again = cur.again;
    phase = 'ask';
    chosen = null;
    result = null;
    flipped = false;
    serial++;
    const q = qById.get(cur.key);
    if (q) {
      card = null;
      built = buildChoices(q, rng);
      if (!built) {
        run!.settle(true);
        return show();
      }
      late = false;
      await tick();
      // 図が描けるようになってから時間を計り始める（読み込み中に時間が減らないように）
      const imgs = [...(stageEl?.querySelectorAll('img') ?? [])];
      await Promise.all(imgs.map((im) => im.decode().catch(() => {})));
      const at = serial;
      requestAnimationFrame(() => at === serial && startTimer(built!.limitMs));
    } else {
      built = null;
      card = cardById.get(cur.key) ?? null;
      if (!card) {
        run!.settle(true);
        return show();
      }
    }
  }

  // ---- タイマー（細いバーが縮む。時間切れは setTimeout。一時停止は両方止める） ----
  function startTimer(limitMs: number) {
    if (closed || phase !== 'ask') return;
    timer = new QuestionTimer(limitMs, now());
    barAnim?.cancel();
    barAnim = bar?.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: limitMs, fill: 'forwards' }) ?? null;
    arm();
    if (paused()) pause();
  }
  function arm() {
    clearTimeout(deadline);
    clearTimeout(lateT);
    if (!timer) return;
    const rem = timer.remaining(now());
    deadline = window.setTimeout(() => answer(null), rem + 5);
    lateT = window.setTimeout(() => (late = true), Math.max(0, rem - timer.limitMs * 0.3));
  }
  function stopTimer() {
    clearTimeout(deadline);
    clearTimeout(lateT);
    barAnim?.pause();
  }
  const paused = () => reporting || stopped || document.visibilityState === 'hidden';
  function pause() {
    if (!timer || phase !== 'ask') return;
    timer.pause(now());
    clearTimeout(deadline);
    clearTimeout(lateT);
    barAnim?.pause();
  }
  function resume() {
    if (!timer || phase !== 'ask' || paused()) return;
    timer.resume(now());
    barAnim?.play();
    arm();
  }

  // ---- 回答 ----
  function answer(k: number | null) {
    if (phase !== 'ask' || !built || !timer || !run || timer.paused) return;
    const g = grade(k, built.answer, timer.elapsed(now()), built.limitMs);
    stopTimer();
    chosen = k;
    result = g;
    phase = 'feedback';
    const key = built.q.id;
    const first = run.settle(g.ok);
    if (first) recordAnswer(key, key, g.ok, [`group:${built.q.group}`], g.slow ? 'low' : undefined, g.ms);
    logs.push({ key, ok: g.ok, timeout: g.timeout, slow: g.slow, ms: g.ms, first, again, card: false });
    streakStep(g.ok);
    haptic(g.ok ? 'light' : 'error');
    tick().then(() => {
      const btns = stageEl?.querySelectorAll<HTMLElement>('.ch');
      if (!btns) return;
      popScale(btns[built!.answer]);
      if (k !== null && !g.ok) shake(btns[k]);
    });
    advanceT = window.setTimeout(next, g.ok ? ADVANCE_OK_MS : g.timeout ? ADVANCE_TIMEOUT_MS : ADVANCE_NG_MS);
  }
  function judge(level: 0 | 1 | 2) {
    if (phase !== 'ask' || !card || !run) return;
    const ok = level > 0;
    phase = 'feedback';
    const first = run.settle(ok);
    if (first) recordAnswer(card.id, card.id, ok, [`group:${card.group}`], level === 1 ? 'low' : level === 2 ? 'high' : undefined);
    logs.push({ key: card.id, ok, timeout: false, slow: level === 1, ms: 0, first, again, card: true });
    streakStep(ok);
    haptic(ok ? 'light' : 'error');
    advanceT = window.setTimeout(next, 180);
  }
  function streakStep(ok: boolean) {
    streak = ok ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
    if (!ok || !streakEl) return;
    // 正解のたびに小さく弾み、5問ごとに少し大きく弾んで小さな紙吹雪（控えめに）
    const el = streakEl;
    tick().then(() => {
      bump(el, streak % 5 === 0 ? 1.35 : 1.12);
      if (streak % 5 === 0) {
        burst(el, 10);
        haptic('success');
      }
    });
  }
  function next() {
    clearTimeout(advanceT);
    if (closed || phase !== 'feedback') return;
    show();
  }
  /** 不正解の表示中はタップで早送り */
  function skip() {
    if (phase === 'feedback') next();
  }
  let cardEl: HTMLElement | undefined = $state();
  let flipping = false;
  /** カードをめくる: 縦軸で 90° 回って裏返る（transform だけ。全体 200ms） */
  async function flip() {
    if (phase !== 'ask' || !card || flipping) return;
    if (reducedMotion() || !cardEl) {
      flipped = !flipped;
      return;
    }
    flipping = true;
    const el = cardEl;
    await el.animate([{ transform: 'perspective(900px) rotateY(0)' }, { transform: 'perspective(900px) rotateY(90deg)' }], { duration: 90, easing: 'ease-in' }).finished.catch(() => {});
    flipped = !flipped;
    await tick();
    await el.animate([{ transform: 'perspective(900px) rotateY(-90deg)' }, { transform: 'perspective(900px) rotateY(0)' }], { duration: 110, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished.catch(() => {});
    flipping = false;
  }

  function finish() {
    if (closed) return;
    closed = true;
    stopTimer();
    router.replace({ name: 'reflex/result', params: { logs, method, kind, bestStreak, startedAt, finishedAt: Date.now(), total } });
  }
  function close() {
    closed = true;
    stopTimer();
    clearTimeout(advanceT);
    router.pop();
  }

  // ---- キーボード: 1〜4 で回答、Enter・Space で早送り。カードは Space でめくり 1/2/3 ----
  function onKey(e: KeyboardEvent) {
    if (reporting || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      return stopped ? unstop() : stop();
    }
    if (stopped) {
      if (e.key === 'Enter') unstop();
      return;
    }
    if (e.key === 'Escape') return close();
    if (phase === 'feedback' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      return skip();
    }
    if (phase !== 'ask') return;
    if (built && /^[1-4]$/.test(e.key)) {
      e.preventDefault();
      answer(+e.key - 1);
    } else if (card) {
      if (e.key === ' ' || (e.key === 'Enter' && !flipped)) {
        e.preventDefault();
        flip();
      } else if (flipped && /^[1-3]$/.test(e.key)) {
        e.preventDefault();
        judge((3 - +e.key) as 0 | 1 | 2);
      }
    }
  }

  // ---- 報告 ----
  function stop() {
    if (closed || !ready || empty) return;
    stopped = true;
    pause();
    haptic('light');
  }
  function unstop() {
    stopped = false;
    resume();
    haptic('light');
  }
  function openReport() {
    reporting = true;
    pause();
  }
  function closeReport() {
    reporting = false;
    resume();
  }
  function report(reason: ReportReason, comment: string) {
    const key = built?.q.id ?? card?.id;
    if (key) saveReports(MODE_ID, addReport(loadReports(MODE_ID), { key, reason, comment: comment || undefined, at: new Date().toISOString() }));
    closeReport();
    haptic('success');
    reported = '報告しました';
    setTimeout(() => (reported = ''), 2000);
  }

  /** 問題が変わるとき: 120ms で浮かぶだけ（遷移は最小限） */
  function appear(node: HTMLElement) {
    if (reducedMotion()) return;
    node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'ease-out' });
  }
  /** 新しい問題: 問題文は少し上がりながら、選択肢は 25ms ずつずらして浮かぶ（全体で 200ms 以内） */
  function enter(node: HTMLElement) {
    if (reducedMotion()) return;
    const ease = 'cubic-bezier(.2,.8,.2,1)';
    node.querySelector('.prompt')?.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 160, easing: ease });
    node.querySelectorAll('.ch').forEach((el, k) =>
      el.animate([{ opacity: 0, transform: 'translateY(10px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 140, delay: 20 + k * 25, easing: ease, fill: 'backwards' }),
    );
  }
  /** 正誤の行: 小さく弾んで出る */
  function pop(node: HTMLElement) {
    if (reducedMotion()) return;
    const sp = spring(SPRINGS.pop);
    node.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: Math.min(sp.duration, 320), easing: sp.easing });
  }
  const isWide = (b: Built) => b.choices.every((c) => c.figure && (figAspect(c.figure) ?? 1) >= 1.8);
  const sec = (ms: number) => (ms / 1000).toFixed(1);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="rq" onclick={() => phase === 'feedback' && skip()}>
  <header>
    <button class="close press" onclick={close} aria-label="やめる"><Icon name="close" size={22} /></button>
    <span class="mid">
      <span class="lbl">{label}</span>
      {#if ready && !empty}<span class="left en" aria-label="残り {left} 問">残り {left}</span>{/if}
    </span>
    <span class="right">
      <span class="streak en" class:on={streak >= 2} bind:this={streakEl} aria-label="連続正解 {streak}"><Icon name="flame" size={15} />{streak}</span>
      <button class="flag press" onclick={(e) => { e.stopPropagation(); stop(); }} aria-label="一時停止"><Icon name="pause" size={18} stroke={2.6} /></button>
      <button class="flag press" onclick={openReport} aria-label="この問題を報告" disabled={!built && !card}><Icon name="flag" size={17} /></button>
    </span>
  </header>
  <div class="track"><div class="bar" class:hide={!!card} class:late bind:this={bar}></div></div>
  <p class="note" aria-live="polite">{reported || (again ? 'もう一度' : '')}</p>

  {#if ready && empty}
    <div class="empty">
      {#if kind === 'review'}<p>復習リストは空です。</p>{:else if method === 'weak'}<p>弱点の問題はまだありません。</p><p class="sub">まちがえた・時間切れ・遅かった問題がここに入ります。</p>{:else}<p>出題できる問題がありません。</p>{/if}
      <button class="btn press" onclick={close}>戻る</button>
    </div>
  {:else if ready && rx.error && !rx.questions}
    <div class="empty"><p>{rx.error}</p><button class="btn press" onclick={close}>戻る</button></div>
  {/if}

  {#key serial}
    {#if built}
      <div class="stage" class:imgq={!!built.choices[0].image} bind:this={stageEl} use:enter>
        <div class="prompt"><RPrompt q={built.q} /></div>
        <div class="fb" aria-live="polite">
          {#if result}
            <span class="fbin" use:pop>
            {#if result.ok}
              <span class="okl"><span class="ring"></span>{result.slow ? 'あやしい（遅め）' : '正解'}<b class="en">{sec(result.ms)}秒</b></span>
            {:else}
              <span class="ngl"><span class="cross"><Icon name="x" size={12} stroke={3.4} /></span>{result.timeout ? '時間切れ' : '不正解'}</span>
              <span class="ans">{built.choices[built.answer].image ? '正解は ✓ の図' : `正解：${built.choices[built.answer].text}`}</span>
              <span class="ref">教科書 p.{built.q.ref_page_a5}（第{built.q.chapter}章）</span>
            {/if}
            </span>
          {/if}
        </div>
        <div class="choices" class:img={!!built.choices[0].image} class:wide={isWide(built)}>
          {#each built.choices as c, k}
            {@const isAns = phase === 'feedback' && k === built.answer}
            {@const isMine = phase === 'feedback' && k === chosen && k !== built.answer}
            <button
              class="ch press"
              class:en={c.latin}
              class:correct={isAns}
              class:wrong={isMine}
              class:dim={phase === 'feedback' && !isAns && !isMine}
              aria-disabled={phase !== 'ask'}
              onclick={(e) => {
                e.stopPropagation();
                // 正誤の表示中に押したら、すぐ次の問題へ（押せないボタンにしない。連打しても反応する）
                if (phase === 'feedback') skip();
                else answer(k);
              }}
            >
              <span class="kn en">{k + 1}</span>
              {#if c.figure}<img src={figSrc(c.figure)} alt={c.text} draggable="false" />{:else}<span class="ct">{c.text}</span>{/if}
              {#if isAns}<span class="mk"><Icon name="check" size={18} stroke={3} /></span>{:else if isMine}<span class="mk"><Icon name="x" size={18} stroke={3} /></span>{/if}
            </button>
          {/each}
        </div>
      </div>
    {:else if card}
      <div class="stage" use:appear>
        <button class="card press" class:flipped bind:this={cardEl} onclick={() => (phase === 'ask' ? flip() : skip())} aria-label={flipped ? '表に戻す' : 'めくる'}>
          <span class="cg">{card.group}</span>
          <span class="cw en">{card.word}</span>
          {#if flipped}
            <span class="ci" use:appear>{card.image}</span>
            <span class="cref">教科書 p.{card.ref_page_a5}（第{card.chapter}章）</span>
          {:else}
            <span class="tap">タップでめくる</span>
          {/if}
        </button>
        {#if flipped}
          <div class="judge">
            <button class="j press" onclick={() => (phase === 'ask' ? judge(0) : skip())}><span class="en kn2">3</span>出ない</button>
            <button class="j press" onclick={() => (phase === 'ask' ? judge(1) : skip())}><span class="en kn2">2</span>あやしい</button>
            <button class="j pri press" onclick={() => (phase === 'ask' ? judge(2) : skip())}><span class="en kn2">1</span>すぐ出た</button>
          </div>
        {:else}
          <div class="judge one"><button class="j pri press" onclick={flip}>めくる</button></div>
        {/if}
      </div>
    {/if}
  {/key}

  {#if stopped}
    <PauseOverlay progress="残り {left} 問" note="制限時間は止まっています。再開すると、この問題の残り時間から続きます。" onresume={unstop} onsuspend={close} />
  {/if}
  {#if reporting && (built || card)}
    <ReportSheet id={built?.q.id ?? card?.id ?? ''} onsend={report} onclose={closeReport} />
  {/if}
</div>

<style>
  .rq {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: var(--pad-top) var(--pad-x-wide-r) var(--pad-bottom) var(--pad-x-wide);
    background: var(--bg);
  }
  header {
    flex: none;
    height: 44px;
    display: grid;
    grid-template-columns: 44px 1fr auto;
    align-items: center;
    margin-left: -10px;
  }
  .close {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    color: var(--text2);
    border-radius: 22px;
  }
  .mid {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 8px;
  }
  .lbl {
    font-size: 13px;
    font-weight: 800;
  }
  .left {
    font-size: 12px;
    font-weight: 700;
    color: var(--text3);
    font-variant-numeric: tabular-nums;
  }
  .right {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .streak {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 8px 2px 6px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 800;
    color: var(--text3);
    font-variant-numeric: tabular-nums;
    transition: background-color 0.2s, color 0.2s;
  }
  .streak.on {
    background: var(--accent);
    color: var(--on-accent);
  }
  .flag {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 18px;
    color: var(--text3);
  }
  .track {
    flex: none;
    height: 5px;
    margin-top: 6px;
    border-radius: 3px;
    background: var(--fill);
    overflow: hidden;
  }
  .bar {
    height: 100%;
    background: var(--ink);
    transform-origin: left center;
  }
  .bar {
    transition: background-color 0.25s;
  }
  .bar.late {
    background: var(--accent);
  }
  .bar.hide {
    opacity: 0;
  }
  .note {
    flex: none;
    height: 20px;
    margin-top: 4px;
    font-size: 12px;
    font-weight: 700;
    color: var(--accent);
    text-align: center;
  }
  .stage {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .prompt {
    flex: 1;
    min-height: 0;
  }
  /* 横向き: 問題と正誤を左、選択肢を右に */
  @media (orientation: landscape) and (min-width: 640px) {
    .stage {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, min(50%, 560px));
      grid-template-rows: minmax(0, 1fr) auto;
      column-gap: clamp(20px, 3vw, 40px);
    }
    .prompt {
      grid-area: 1 / 1;
    }
    .fb {
      grid-area: 2 / 1;
    }
    .stage > .choices {
      grid-area: 1 / 2 / 3 / 3;
      align-self: center;
      max-height: 100%;
    }
  }
  /* 正誤の行（場所は最初から確保。問題文が動かない） */
  .fb {
    flex: none;
    min-height: 46px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 2px 10px;
    font-size: 13px;
    text-align: center;
  }
  .fbin {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 2px 10px;
  }
  .okl,
  .ngl {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 17px;
    font-weight: 800;
  }
  .okl {
    color: var(--accent);
  }
  .okl b {
    font-size: 13px;
    color: var(--text2);
  }
  .ring {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 3px solid var(--accent);
  }
  .cross {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--ink);
    color: var(--bg);
  }
  .ans {
    font-weight: 700;
  }
  .ref {
    width: 100%;
    font-size: 11px;
    color: var(--text3);
  }
  /* 2×2 の大きな選択肢（親指で押せる） */
  .choices {
    flex: none;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .ch {
    position: relative;
    min-height: 96px;
    padding: 18px 10px 12px;
    display: grid;
    place-items: center;
    border-radius: 18px;
    border: 2px solid var(--line-strong);
    background: var(--bg);
    font-size: 16px;
    font-weight: 700;
    line-height: 1.35;
    text-align: center;
    transition: background-color 0.15s, border-color 0.15s, opacity 0.15s, color 0.15s, transform var(--dur-press, 300ms) var(--ease-press, ease-out);
  }
  .ch.en {
    font-size: 22px;
  }
  .ch:active {
    background: var(--fill);
  }
  .kn {
    position: absolute;
    left: 10px;
    top: 6px;
    font-size: 11px;
    font-weight: 800;
    color: var(--text3);
  }
  .ch.correct {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .ch.correct .kn {
    color: var(--on-accent);
  }
  .ch.wrong {
    border-style: dashed;
    border-color: var(--ink);
    background: var(--fill-strong);
    color: var(--text2);
  }
  .ch.wrong .ct {
    text-decoration: line-through;
  }
  .ch.dim {
    opacity: 0.35;
  }
  .mk {
    position: absolute;
    right: 9px;
    top: 7px;
  }
  .choices.img .ch {
    background: #fff;
    padding: 18px 6px 6px;
    aspect-ratio: 1 / 0.82;
    min-height: 0;
  }
  .choices.img .ch.correct {
    background: #fff;
    box-shadow: 0 0 0 3px var(--accent);
  }
  .choices.img .ch.correct .mk {
    color: var(--accent);
  }
  .choices.img .ch.wrong .mk,
  .choices.img .kn {
    color: #111114;
  }
  /* 図を選ぶ問題: 問題文は短いので小さくし、図の4択に場所を譲る（1枚を大きく） */
  .imgq .prompt {
    flex: none;
    padding: 8px 0 0;
  }
  .imgq .choices {
    flex: 1;
    min-height: 0;
    grid-template-rows: 1fr 1fr;
  }
  .imgq .choices.img .ch {
    aspect-ratio: auto;
  }
  /* 横長の図（3:1 など）は1列に並べ、横幅いっぱいに大きく見せる */
  .imgq .choices.wide {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(4, 1fr);
    gap: 8px;
  }
  .choices.wide .ch {
    padding: 6px 10px 6px 30px;
  }
  .choices.wide .kn {
    top: 50%;
    translate: 0 -50%;
    left: 11px;
    font-size: 14px;
  }
  .ch img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
  /* 暗記カード */
  .card {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 20px;
    border: var(--panel-border);
    border-radius: 24px;
    text-align: center;
  }
  .card:disabled {
    cursor: default;
  }
  .cg {
    font-size: 12px;
    font-weight: 700;
    color: var(--text3);
  }
  .cw {
    font-size: clamp(40px, 13vw, 58px);
    font-weight: 850;
    letter-spacing: -0.03em;
  }
  .ci {
    font-size: 22px;
    font-weight: 800;
    color: var(--accent);
    line-height: 1.4;
  }
  .cref {
    font-size: 11px;
    color: var(--text3);
  }
  .tap {
    font-size: 12px;
    color: var(--text3);
  }
  .judge {
    flex: none;
    display: grid;
    grid-template-columns: 1fr 1fr 1.2fr;
    gap: 10px;
  }
  .judge.one {
    grid-template-columns: 1fr;
  }
  .j {
    position: relative;
    min-height: 64px;
    border-radius: 18px;
    border: var(--frame) solid var(--ink);
    font-size: 16px;
    font-weight: 800;
  }
  .j.pri {
    background: var(--accent);
    color: var(--on-accent);
  }
  .kn2 {
    position: absolute;
    left: 9px;
    top: 5px;
    font-size: 10px;
    opacity: 0.6;
  }
  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
  }
  .empty .sub {
    font-size: 13px;
    color: var(--text2);
  }
  .btn {
    margin-top: 12px;
    padding: 12px 24px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 700;
  }
</style>
