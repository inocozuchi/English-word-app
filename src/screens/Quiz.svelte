<script lang="ts">
  // 共通のクイズ画面。問題文と解説の中身はデッキ（deck.Prompt / deck.Explain）が描く。
  import { onMount } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import { router } from '../core/router.svelte.ts';
  import type { AnswerLog } from '../core/router.svelte.ts';
  import { store, activeDeck, deckSettings, loadData, recordAnswer, today } from '../core/store.svelte.ts';
  import { buildSession } from '../core/session.ts';
  import type { SessionMode } from '../core/session.ts';
  import type { Question } from '../core/deck.ts';
  import type { ReviewEvent } from '../core/review.ts';
  import { createRng } from '../core/rng.ts';
  import { haptic } from '../core/haptics.ts';
  import { spring, SPRINGS, reducedMotion } from '../core/spring.ts';
  import { cardIn, promptOut, explainIn, popScale, shake } from '../core/transitions.ts';

  let { seed, mode = 'normal' }: { seed: number; mode?: SessionMode } = $props();

  const deck = activeDeck();
  let qs = $state<Question[]>([]);
  let ready = $state(false);
  let i = $state(0);
  let phase = $state<'ask' | 'reveal'>('ask');
  let chosen = $state<number | null>(null);
  let event = $state<ReviewEvent>(null);
  let held = $state(false);
  let hidden = $state(false);
  let dragging = $state(false);
  let dragX = $state(0);
  const paused = $derived(held || hidden || dragging);
  const logs: AnswerLog[] = [];

  const q = $derived(qs[i]);
  const ok = $derived(phase === 'reveal' && chosen === q?.answer);

  let bar: HTMLElement | undefined = $state();
  let timer: Animation | null = null;
  let done = false;

  onMount(() => {
    (async () => {
      await loadData();
      const s = store.settings;
      qs = buildSession({
        deck,
        deckSettings: deckSettings(deck),
        mode,
        count: s.count,
        items: store.progress.items,
        review: store.progress.review,
        today: today(),
        rng: createRng(seed),
        lastBase: store.progress.lastBase,
      });
      ready = true;
      if (qs.length) requestAnimationFrame(() => startTimer(s.answerSec, timeout));
    })();
    const vis = () => (hidden = document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', vis);
    return () => {
      done = true;
      timer?.cancel();
      document.removeEventListener('visibilitychange', vis);
    };
  });

  // 残り時間は WAAPI で細いバーを縮める（コンポジタで動くので JS は毎フレーム動かない）
  function startTimer(sec: number, onEnd: () => void) {
    timer?.cancel();
    if (!bar || done) return;
    const anim = bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], {
      duration: sec * 1000,
      easing: 'linear',
      fill: 'forwards',
    });
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

  function answer(k: number | null) {
    if (phase !== 'ask' || !q) return;
    chosen = k;
    phase = 'reveal';
    const correct = k === q.answer;
    event = recordAnswer(q.deck, q.key, q.base, correct);
    logs.push({ q, chosen: k, review: event });
    haptic(correct ? 'success' : 'error');
    startTimer(store.settings.advanceSec, next);
  }

  function timeout() {
    answer(null);
  }

  /** 左へスワイプして抜けたカードの位置（次のカードの出入りに使う） */
  let swipeFrom = 0;

  function next() {
    if (done) return;
    if (i + 1 >= qs.length) {
      done = true;
      timer?.cancel();
      router.replace({ name: 'result', params: { logs, mode } });
      return;
    }
    i++;
    chosen = null;
    event = null;
    phase = 'ask';
    startTimer(store.settings.answerSec, timeout);
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
      if (axis === 'x' && phase === 'reveal') {
        clearTimeout(holdTimer);
        held = false;
        dragging = true;
      }
    }
    if (!dragging) return;
    hist.push({ t: e.timeStamp, x: pt.clientX });
    if (hist.length > 6) hist.shift();
    // 左へは指についてくる。右へは少しだけ（戻れないことを示す）
    dragX = dx < 0 ? dx : dx * 0.2;
  }
  function touchEnd(e: Event) {
    if (e.type !== 'touchend' && e.type !== 'touchcancel' && Date.now() - lastTouch < 800) return;
    clearTimeout(holdTimer);
    if (dragging) {
      const a = hist[0], b = hist[hist.length - 1];
      const vx = (b.x - a.x) / Math.max(1, b.t - a.t);
      const commit = e.type !== 'touchcancel' && (dragX < -70 || (vx < -0.45 && dragX < -20));
      dragging = false;
      suppress();
      if (commit && phase === 'reveal') {
        swipeFrom = dragX;
        dragX = 0;
        haptic('light');
        next();
      } else {
        dragX = 0; // CSS transition でスプリングのように戻る
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

  /** 前のカードの退場: スワイプなら指を離した位置からそのまま左へ抜ける */
  function cardLeave(_node: Element) {
    const from = swipeFrom;
    swipeFrom = 0;
    if (reducedMotion()) return { duration: 100, css: (t: number) => `opacity:${t}` };
    if (from) {
      const w = window.innerWidth;
      return {
        duration: 260,
        css: (_t: number, u: number) => `transform:translate3d(${from + (-w * 0.9 - from) * u * (2 - u)}px,0,0);opacity:${1 - u * 0.6}`,
      };
    }
    return {
      duration: 200,
      css: (t: number, u: number) => `transform:translate3d(${-u * u * 48}px,0,0) scale(${1 - u * 0.03});opacity:${t * t}`,
    };
  }

  function choiceFx(node: HTMLElement, k: number) {
    // 回答時の動き: 正解はポップ、選んだ誤答は横揺れ
    $effect(() => {
      if (phase !== 'reveal') return;
      if (k === q.answer) popScale(node);
      else if (k === chosen) shake(node);
    });
  }

  /** 回答した瞬間の大きな ◯ / ×（色だけに頼らず形で正誤を示す） */
  function judgeFx(node: HTMLElement) {
    if (reducedMotion()) {
      node.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 700, fill: 'forwards' });
      return;
    }
    const s = spring(SPRINGS.pop);
    node.animate([{ transform: 'scale(0.4)' }, { transform: 'scale(1)' }], { duration: s.duration, easing: s.easing });
    node.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }],
      { duration: 820, fill: 'forwards' },
    );
  }

  const REVIEW_NOTE: Record<Exclude<ReviewEvent, null>, string> = {
    added: '復習リストに追加',
    missed: '復習リスト：やり直し',
    progress: '',
    cleared: '復習リストから外れました',
  };
  const reviewEntry = $derived(q ? store.progress.review[q.key] : undefined);
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
    <span class="count en">{#if qs.length}{i + 1}<span class="of">&ensp;/&ensp;{qs.length}</span>{/if}</span>
    <span class="fmt">{#if mode === 'review'}<span class="rv">復習</span>{/if}{q ? q.modeLabel : ''}</span>
  </header>
  <div class="track" class:reveal={phase === 'reveal'}>
    <div class="bar" bind:this={bar}></div>
  </div>
  <div class="sub-row">
    <span class="pause-note" aria-live="polite"><Icon name="pause" size={14} stroke={2.4} />一時停止中</span>
    <span class="swipe-hint" class:show={phase === 'reveal' && !paused}><Icon name="back" size={14} stroke={2.4} />スワイプで次へ</span>
  </div>

  <div class="stage">
    {#if ready && !qs.length}
      <!-- 範囲が空のときの案内（問題エリアの中だけに出す。✕ を塞がない） -->
      <div class="empty">
        {#if mode === 'review'}
          <p>復習リストは空です。</p>
          <p class="sub">まちがえた問題が自動で入ります。</p>
        {:else}
          <p>出題できる問題がありません。</p>
          <p class="sub">設定で出題範囲や出題形式を確認してください。</p>
          <button class="btn press" onclick={() => router.push({ name: 'settings' })}>設定を開く</button>
        {/if}
      </div>
    {/if}

    {#key i}
      {#if q}
        <div
          class="card"
          class:dragging
          style:transform={dragX ? `translate3d(${dragX}px,0,0)` : null}
          in:cardIn
          out:cardLeave
        >
          <!-- 上半分: 回答前は問題、回答後は解説に入れ替わる（選択肢は見えたまま） -->
          <div class="upper">
            {#if phase === 'ask'}
              <div class="q-area" out:promptOut><deck.Prompt {q} /></div>
            {:else}
              <div class="explain scroll" in:explainIn>
                <div class="status" class:ok>
                  {#if ok}
                    <span class="badge ring"></span>正解
                  {:else}
                    <span class="badge cross"><Icon name="x" size={15} stroke={3.2} /></span>{chosen === null ? '時間切れ' : '不正解'}
                  {/if}
                  {#if event && REVIEW_NOTE[event]}
                    <span class="rnote" class:cleared={event === 'cleared'}>{REVIEW_NOTE[event]}</span>
                  {:else if event === 'progress' && reviewEntry}
                    <span class="rnote">復習 {reviewEntry.streak}/{store.settings.reviewGoal}</span>
                  {/if}
                </div>
                <deck.Explain {q} />
              </div>
              <div class="judge" class:ok use:judgeFx aria-hidden="true">
                {#if ok}<span class="j-ring"></span>{:else}<Icon name="x" size={150} stroke={2.4} />{/if}
              </div>
            {/if}
          </div>

          <div class="choices">
            {#each q.choices as c, k}
              {@const isAns = phase === 'reveal' && k === q.answer}
              {@const isMine = phase === 'reveal' && k === chosen && k !== q.answer}
              <button
                class="choice press"
                class:en={c.latin}
                class:correct={isAns}
                class:wrong={isMine}
                class:dim={phase === 'reveal' && !isAns && !isMine}
                disabled={phase === 'reveal'}
                onclick={() => choose(k)}
                use:choiceFx={k}
              >
                {#if c.tag}<span class="tag">{c.tag}</span>{/if}
                <span class="ct">{c.text}</span>
                {#if isAns}<span class="mark"><span class="mini-ring"></span></span>
                {:else if isMine}<span class="mine">あなたの答え</span><span class="mark"><Icon name="x" size={18} stroke={2.8} /></span>{/if}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    {/key}
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
    transition: opacity 0.2s;
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
    height: 20px;
    margin: 4px var(--pad-x-r) 0 var(--pad-x);
    font-size: 12px;
    font-weight: 600;
    color: var(--text3);
  }
  .pause-note,
  .swipe-hint {
    position: absolute;
    top: 0;
    display: flex;
    align-items: center;
    gap: 3px;
    opacity: 0;
    transform: translateY(-3px);
    transition: opacity 0.18s, transform 0.18s;
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
  }
  .card {
    grid-area: 1 / 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0 var(--pad-x-r) var(--pad-bottom) var(--pad-x);
    transition: transform var(--dur-card, 400ms) var(--ease-card, ease-out);
  }
  .card.dragging {
    transition: none;
  }
  .upper {
    flex: 1;
    position: relative;
    min-height: 0;
    margin-bottom: 14px;
  }
  .q-area,
  .explain {
    position: absolute;
    inset: 0;
  }

  /* 解説（問題のエリアに入れ替わる。長いときはスクロール、下端はフェード） */
  .explain {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 10px 2px 18px;
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent);
  }
  .status {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 20px;
    font-weight: 800;
    color: var(--text);
    flex: none;
  }
  .status.ok {
    color: var(--accent);
  }
  /* 正解 = ◯（輪）、不正解 = ×（黒地）。色が見分けにくくても形で分かる */
  .badge {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: grid;
    place-items: center;
  }
  .badge.ring {
    border: 4px solid var(--accent);
  }
  .badge.cross {
    background: var(--ink);
    color: var(--bg);
  }
  .rnote {
    margin-left: auto;
    font-size: 12px;
    font-weight: 700;
    color: var(--text2);
    padding: 3px 9px;
    border-radius: 999px;
    border: 1.5px solid var(--line-strong);
    white-space: nowrap;
  }
  .rnote.cleared {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* 回答の瞬間の大きな ◯ / × */
  .judge {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 160px;
    height: 160px;
    margin: -80px 0 0 -80px;
    display: grid;
    place-items: center;
    pointer-events: none;
    color: var(--ink);
    opacity: 0;
    z-index: 3;
  }
  .j-ring {
    width: 150px;
    height: 150px;
    border-radius: 50%;
    border: 16px solid var(--accent);
  }

  /* 選択肢 */
  .choices {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .choice {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 60px;
    padding: 11px 46px 11px 16px;
    border-radius: var(--radius);
    border: 2px solid var(--line-strong);
    background: var(--bg);
    text-align: left;
    font-size: 17px;
    font-weight: 500;
    line-height: 1.35;
    transition:
      background-color 0.2s,
      border-color 0.2s,
      color 0.2s,
      opacity 0.25s,
      transform var(--dur-press, 300ms) var(--ease-press, ease-out);
  }
  .choice:active {
    background: var(--fill);
  }
  .choice.en {
    font-size: 20px;
    font-weight: 600;
  }
  .choice:disabled {
    cursor: default;
  }
  .choice .tag {
    flex: none;
    font-size: 11px;
    font-weight: 600;
    color: var(--text2);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    padding: 0 5px;
    line-height: 1.6;
  }
  .choice.correct {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
    font-weight: 700;
  }
  .choice.correct .tag {
    color: var(--on-accent);
    border-color: color-mix(in srgb, var(--on-accent) 40%, transparent);
  }
  .choice.wrong {
    background: var(--fill-strong);
    border-color: var(--ink);
    border-style: dashed;
    color: var(--text2);
    padding-top: 22px;
  }
  .choice.wrong .ct {
    text-decoration: line-through;
    text-decoration-thickness: 1.5px;
  }
  .mine {
    position: absolute;
    left: 16px;
    top: 5px;
    font-size: 10px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: 0.04em;
  }
  .choice.dim {
    opacity: 0.4;
  }
  .mark {
    position: absolute;
    right: 14px;
    top: 50%;
    translate: 0 -50%;
    display: grid;
  }
  .mini-ring {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 3px solid currentColor;
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
