<script lang="ts">
  // 共通のクイズ画面。問題文と解説の中身はモード（mode.Prompt / mode.Explain）が描く。
  // 問題の切り替えは「カルーセル」: 次の問題のカードが右に並んでいて、
  // 左スワイプでは指についてきて、自動で進むときも同じ動きで横にめくれる。
  import { onMount, tick } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import QuizCard from './QuizCard.svelte';
  import { router } from '../core/router.svelte.ts';
  import type { AnswerLog } from '../core/router.svelte.ts';
  import { store, activeMode, modeSettings, timingOf, answeredCount, loadData, recordAnswer, today } from '../core/store.svelte.ts';
  import { buildSession } from '../core/session.ts';
  import type { SessionKind } from '../core/session.ts';
  import type { Question } from '../core/mode.ts';
  import type { ReviewEvent } from '../core/review.ts';
  import { createRng } from '../core/rng.ts';
  import { haptic } from '../core/haptics.ts';
  import { spring, SPRINGS, reducedMotion } from '../core/spring.ts';
  import { bump } from '../core/transitions.ts';

  let { seed, kind = 'normal' }: { seed: number; kind?: SessionKind } = $props();

  const mode = activeMode();
  const timing = timingOf(mode);
  let qs = $state<Question[]>([]);
  let ready = $state(false);
  let i = $state(0);
  let phase = $state<'ask' | 'reveal'>('ask');
  let chosen = $state<number | null>(null);
  let event = $state<ReviewEvent>(null);
  let held = $state(false);
  let hidden = $state(false);
  let dragging = $state(false);
  const paused = $derived(held || hidden || dragging);
  const logs: AnswerLog[] = [];
  /** 各問の結果（ヘッダーの点） */
  let marks = $state<('ok' | 'ng')[]>([]);
  /** 連続正解 */
  let combo = $state(0);

  const q = $derived(qs[i]);

  let bar: HTMLElement | undefined = $state();
  let stage: HTMLElement | undefined = $state();
  let timer: Animation | null = null;
  let done = false;

  onMount(() => {
    (async () => {
      await loadData();
      const s = store.settings;
      qs = buildSession({
        mode,
        modeSettings: modeSettings(mode),
        kind,
        count: s.count,
        items: store.progress.items,
        review: store.progress.review,
        tags: store.progress.tags,
        answered: answeredCount(store.progress),
        today: today(),
        rng: createRng(seed),
        lastBase: store.progress.lastBase,
      });
      ready = true;
      if (qs.length) requestAnimationFrame(() => startTimer(timing.answerSec, timeout));
    })();
    const vis = () => (hidden = document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', vis);
    return () => {
      done = true;
      timer?.cancel();
      document.removeEventListener('visibilitychange', vis);
    };
  });

  // ---- タイマー: WAAPI で細いバーを縮める（コンポジタで動くので JS は毎フレーム動かない） ----
  /** 今のバーの長さ（0〜1） */
  function barScale(): number {
    if (!bar) return 1;
    const m = getComputedStyle(bar).transform;
    if (!m || m === 'none') return 1;
    const a = parseFloat(m.slice(m.indexOf('(') + 1));
    return isFinite(a) ? a : 1;
  }
  function startTimer(sec: number, onEnd: () => void) {
    if (!bar || done) return;
    // バーを一気に満タンに戻さず、今の長さからなめらかに戻してから減らす
    const from = barScale();
    timer?.cancel();
    const refill = reducedMotion() || from > 0.97 ? 0 : 320;
    const total = refill + sec * 1000;
    const kf: Keyframe[] = refill
      ? [
          { transform: `scaleX(${from})`, easing: 'cubic-bezier(.2,.8,.2,1)' },
          { transform: 'scaleX(1)', offset: refill / total, easing: 'linear' },
          { transform: 'scaleX(0)' },
        ]
      : [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }];
    const anim = bar.animate(kf, { duration: total, fill: 'forwards' });
    anim.onfinish = () => {
      if (timer === anim && !done) onEnd();
    };
    timer = anim;
    if (paused) anim.pause();
  }

  $effect(() => {
    const p = paused; // 先に読んで依存に登録する（timer はリアクティブではない）
    if (!timer) return;
    if (p) timer.pause();
    else if (timer.playState === 'paused') timer.play();
  });

  let dots: HTMLElement[] = $state([]);
  function answer(k: number | null) {
    if (phase !== 'ask' || !q || sliding) return;
    chosen = k;
    phase = 'reveal';
    const correct = k === q.answer;
    event = recordAnswer(q.key, q.base, correct, q.tags);
    logs.push({ q, chosen: k, review: event });
    marks[i] = correct ? 'ok' : 'ng';
    combo = correct ? combo + 1 : 0;
    haptic(correct ? 'success' : 'error');
    tick().then(() => dots[i] && bump(dots[i], 1.6));
    startTimer(correct ? timing.advanceOkSec : timing.advanceNgSec, next);
  }

  function timeout() {
    answer(null);
  }

  function next() {
    advance(0, 0);
  }

  // ---- カルーセル ----
  const GAP = 24;
  /** 次の問題のカードも並べる（スワイプ中・めくる途中） */
  let peek = $state(false);
  let sliding = false;
  const shown = $derived(!qs.length ? [] : peek && i + 1 < qs.length ? [i, i + 1] : [i]);
  const els = new Map<number, HTMLElement>();
  const width = () => (stage?.clientWidth ?? window.innerWidth) + GAP;

  function cardRef(node: HTMLElement, idx: number) {
    els.set(idx, node);
    // 次のカードは右に控えておく
    if (idx !== i) node.style.transform = `translate3d(${width() + offset}px,0,0)`;
    return {
      destroy() {
        if (els.get(idx) === node) els.delete(idx);
      },
    };
  }

  /** 今のカードの横位置（px）。次のカードはその右に並ぶ */
  let offset = 0;
  function setOffset(off: number) {
    offset = off;
    const c = els.get(i), n = els.get(i + 1);
    if (c) c.style.transform = off ? `translate3d(${off}px,0,0)` : '';
    if (n) n.style.transform = `translate3d(${width() + off}px,0,0)`;
  }

  /** from → to へ、2枚そろってスプリングで動かす。velocity は px/秒（to に向かう向きが正） */
  async function slide(from: number, to: number, velocity: number) {
    const c = els.get(i), n = els.get(i + 1);
    const w = width();
    const dist = Math.abs(to - from) || 1;
    const s = spring({ ...SPRINGS.nav, velocity: Math.max(0, velocity) / dist });
    const o = { duration: reducedMotion() ? 1 : s.duration, easing: s.easing };
    const anims: Animation[] = [];
    if (c) anims.push(c.animate([{ transform: `translate3d(${from}px,0,0)` }, { transform: `translate3d(${to}px,0,0)` }], o));
    if (n) anims.push(n.animate([{ transform: `translate3d(${w + from}px,0,0)` }, { transform: `translate3d(${w + to}px,0,0)` }], o));
    setOffset(to);
    await Promise.all(anims.map((a) => a.finished.catch(() => {})));
    anims.forEach((a) => a.cancel());
  }

  /** 次の問題へめくる。from は今のカードの位置、velocity は左向きの速さ（px/秒） */
  async function advance(from: number, velocity: number) {
    if (sliding || done) return;
    sliding = true;
    timer?.pause();
    if (i + 1 >= qs.length) {
      // 最後の問題: 結果画面が右から重なってくる
      done = true;
      timer?.cancel();
      if (from) await slide(from, 0, 0);
      router.replace({ name: 'result', params: { logs, kind, marks: [...marks] } });
      return;
    }
    peek = true;
    await tick();
    setOffset(from);
    await slide(from, -width(), velocity);
    // めくり終わったら、右にあったカードを今の問題にする（同じ要素のまま。差し替えのちらつきなし）
    i++;
    chosen = null;
    event = null;
    phase = 'ask';
    peek = false;
    await tick();
    offset = 0;
    const c = els.get(i);
    if (c) c.style.transform = '';
    sliding = false;
    startTimer(timing.answerSec, timeout);
  }

  // ---- タッチ: 長押しで一時停止 / 解説中に左スワイプで次へ ----
  let holdTimer = 0;
  let suppressClick = false;
  let lastTouch = 0;
  let x0 = 0, y0 = 0;
  let axis: 'x' | 'y' | null = null;
  let hist: { t: number; x: number }[] = [];

  function suppress() {
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 350);
  }
  function touchStart(e: TouchEvent | MouseEvent) {
    if (e.type === 'touchstart') lastTouch = Date.now();
    else if (Date.now() - lastTouch < 800) return; // タッチ後の互換マウスイベントは無視
    const pt = 'touches' in e ? e.touches[0] : e;
    x0 = pt.clientX;
    y0 = pt.clientY;
    axis = null;
    hist = [{ t: e.timeStamp, x: x0 }];
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => {
      held = true;
      haptic('light');
    }, 280);
  }
  function touchMove(e: TouchEvent) {
    const pt = e.touches[0];
    const dx = pt.clientX - x0, dy = pt.clientY - y0;
    if (!axis && Math.hypot(dx, dy) > 10) {
      axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (axis === 'x' && phase === 'reveal' && !sliding) {
        clearTimeout(holdTimer);
        held = false;
        dragging = true;
        peek = true; // 次の問題を右に並べる
      }
    }
    if (!dragging) return;
    hist.push({ t: e.timeStamp, x: pt.clientX });
    if (hist.length > 6) hist.shift();
    // 左へは指にぴったりついてくる。右へは少しだけ（戻れないことを示すゴムのような抵抗）
    setOffset(dx < 0 ? dx : dx * 0.18);
  }
  async function touchEnd(e: Event) {
    if (e.type !== 'touchend' && e.type !== 'touchcancel' && Date.now() - lastTouch < 800) return;
    clearTimeout(holdTimer);
    if (dragging) {
      const a = hist[0], b = hist[hist.length - 1];
      const vx = (b.x - a.x) / Math.max(1, b.t - a.t); // px/ms（左が負）
      const off = offset;
      const commit = e.type !== 'touchcancel' && (off < -70 || (vx < -0.35 && off < -16));
      dragging = false;
      suppress();
      if (commit && phase === 'reveal') {
        haptic('light');
        advance(off, -vx * 1000);
      } else {
        sliding = true;
        await slide(off, 0, vx > 0 ? vx * 1000 : 0);
        peek = false;
        sliding = false;
      }
      return;
    }
    if (held) {
      held = false;
      // 長押しを離したときのタップは選択にしない
      suppress();
    }
  }
  function choose(k: number) {
    if (suppressClick) return;
    answer(k);
  }

  function close() {
    done = true;
    timer?.cancel();
    router.pop();
  }

  /** 連続正解のバッジ: 数が増えるたびに弾む */
  function comboFx(node: HTMLElement) {
    if (reducedMotion()) return;
    const s = spring(SPRINGS.pop);
    node.animate([{ transform: 'scale(0.5)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: s.duration, easing: s.easing });
  }

  const useDots = $derived(qs.length > 0 && qs.length <= 20);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="quiz"
  class:paused
  role="application"
  ontouchstart={touchStart}
  ontouchmove={touchMove}
  ontouchend={touchEnd}
  ontouchcancel={touchEnd}
  onmousedown={touchStart}
  onmouseup={touchEnd}
>
  <header>
    <button class="close press" onclick={close} aria-label="やめる"><Icon name="close" size={22} /></button>
    <span class="count en" aria-label="{i + 1} / {qs.length}">
      {#if useDots}
        <span class="dots">
          {#each qs as _, k}
            <span bind:this={dots[k]} class="dot {marks[k] ?? ''}" class:cur={k === i && !marks[k]}></span>
          {/each}
        </span>
      {:else if qs.length}{i + 1}<span class="of">&ensp;/&ensp;{qs.length}</span>{/if}
    </span>
    <span class="fmt">{#if kind === 'review'}<span class="rv">復習</span>{/if}{q ? q.patternLabel : ''}</span>
  </header>
  <div class="track" class:reveal={phase === 'reveal'}>
    <div class="bar" bind:this={bar}></div>
  </div>
  <div class="sub-row">
    {#if combo >= 2}
      {#key combo}<span class="combo" use:comboFx><b class="en">{combo}</b>連続正解</span>{/key}
    {/if}
    <span class="pause-note" aria-live="polite"><Icon name="pause" size={14} stroke={2.4} />一時停止中</span>
    <span class="swipe-hint" class:show={phase === 'reveal' && !paused}><Icon name="back" size={14} stroke={2.4} />スワイプで次へ</span>
  </div>

  <div class="stage" bind:this={stage}>
    {#if ready && !qs.length}
      <!-- 範囲が空のときの案内（問題エリアの中だけに出す。✕ を塞がない） -->
      <div class="empty">
        {#if kind === 'review'}
          <p>復習リストは空です。</p>
          <p class="sub">まちがえた問題が自動で入ります。</p>
        {:else}
          <p>出題できる問題がありません。</p>
          <p class="sub">設定で出題範囲や出題形式を確認してください。</p>
          <button class="btn press" onclick={() => router.push({ name: 'settings' })}>設定を開く</button>
        {/if}
      </div>
    {/if}

    {#each shown as idx (idx)}
      <div class="card" class:peek={idx !== i} use:cardRef={idx} inert={idx !== i}>
        <QuizCard
          {mode}
          q={qs[idx]}
          phase={idx === i ? phase : 'ask'}
          chosen={idx === i ? chosen : null}
          event={idx === i ? event : null}
          reviewEntry={store.progress.review[qs[idx].key]}
          reviewGoal={store.settings.reviewGoal}
          onchoose={choose}
        />
      </div>
    {/each}
  </div>
</div>

<style>
  .quiz {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: var(--pad-top) 0 0;
    background: var(--bg);
  }
  header {
    flex: none;
    height: 44px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0 var(--pad-x-r) 0 calc(var(--pad-x) - 10px);
  }
  .close {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    color: var(--text2);
    border-radius: 22px;
  }
  .count {
    font-weight: 800;
    font-size: 16px;
    font-variant-numeric: tabular-nums;
  }
  .of {
    color: var(--text3);
    font-weight: 600;
  }
  /* 進み具合の点: 正解 = 青、不正解 = 黒、今の問題 = 横長 */
  .dots {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 4px;
    background: var(--fill-strong);
    transition: width 0.35s var(--ease-card, ease-out), background-color 0.25s;
  }
  .dot.cur {
    width: 18px;
    background: var(--text3);
  }
  .dot.ok {
    background: var(--accent);
  }
  .dot.ng {
    background: var(--ink);
  }
  .fmt {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text3);
  }
  .rv {
    padding: 1px 7px;
    border-radius: 999px;
    border: 1.5px solid var(--ink);
    color: var(--text);
    font-weight: 700;
  }
  .track {
    flex: none;
    height: 4px;
    margin: 6px var(--pad-x-r) 0 var(--pad-x);
    border-radius: 2px;
    background: var(--fill);
    overflow: hidden;
  }
  .bar {
    height: 100%;
    background: var(--text3);
    transform-origin: left center;
    border-radius: 2px;
    transition: opacity 0.2s, background-color 0.35s;
  }
  .track.reveal .bar {
    background: var(--accent);
  }
  .paused .bar {
    opacity: 0.35;
  }
  .sub-row {
    position: relative;
    flex: none;
    height: 22px;
    margin: 5px var(--pad-x-r) 0 var(--pad-x);
    font-size: 12px;
    font-weight: 600;
    color: var(--text3);
  }
  .combo {
    position: absolute;
    left: 0;
    top: 0;
    display: flex;
    align-items: baseline;
    gap: 3px;
    padding: 1px 9px 1px 8px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 11px;
    font-weight: 700;
    transform-origin: left center;
  }
  .combo b {
    font-size: 14px;
    font-weight: 800;
  }
  .pause-note,
  .swipe-hint {
    position: absolute;
    top: 2px;
    display: flex;
    align-items: center;
    gap: 3px;
    opacity: 0;
    transform: translateY(-3px);
    transition: opacity 0.25s, transform 0.25s;
    pointer-events: none;
  }
  .pause-note {
    left: 50%;
    translate: -50% 0;
    color: var(--text2);
  }
  .paused .pause-note,
  .swipe-hint.show {
    opacity: 1;
    transform: none;
  }
  .swipe-hint {
    right: 0;
  }

  .stage {
    flex: 1;
    display: grid;
    min-height: 0;
    position: relative;
    overflow: hidden;
  }
  .card {
    grid-area: 1 / 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0 var(--pad-x-r) var(--pad-bottom) var(--pad-x);
    background: var(--bg);
    will-change: transform;
  }

  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 32px;
    text-align: center;
    z-index: 1;
  }
  .empty .sub {
    color: var(--text2);
    font-size: 14px;
  }
  .btn {
    margin-top: 16px;
    padding: 12px 22px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 700;
  }
</style>
