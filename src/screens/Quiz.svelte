<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import Kana from '../components/Kana.svelte';
  import Breakdown from '../components/Breakdown.svelte';
  import Example from '../components/Example.svelte';
  import { router } from '../lib/router.svelte.ts';
  import type { AnswerLog } from '../lib/router.svelte.ts';
  import { store, loadData, recordAnswer, today } from '../lib/store.svelte.ts';
  import { buildSession, FORMAT_LABEL } from '../lib/quiz.ts';
  import type { Question } from '../lib/quiz.ts';
  import { createRng } from '../lib/rng.ts';
  import { haptic } from '../lib/haptics.ts';
  import { cardIn, cardOut, promptOut, explainIn, popScale, shake } from '../lib/transitions.ts';

  let { seed }: { seed: number } = $props();

  let qs = $state<Question[]>([]);
  let ready = $state(false);
  let i = $state(0);
  let phase = $state<'ask' | 'reveal'>('ask');
  let chosen = $state<number | null>(null);
  let held = $state(false);
  let hidden = $state(false);
  const paused = $derived(held || hidden);
  const logs: AnswerLog[] = [];

  const q = $derived(qs[i]);
  const ok = $derived(phase === 'reveal' && chosen === q?.answer);

  let bar: HTMLElement | undefined = $state();
  let timer: Animation | null = null;
  let done = false;

  onMount(() => {
    (async () => {
      const ix = store.index ?? (await loadData());
      const s = store.settings;
      qs = buildSession(ix, {
        scope: { formats: s.formats, excludedRoots: s.excludedRoots },
        count: s.count,
        items: store.progress.items,
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
    recordAnswer(q.key, q.base, correct);
    logs.push({ q, chosen: k });
    haptic(correct ? 'success' : 'error');
    startTimer(store.settings.advanceSec, next);
  }

  function timeout() {
    answer(null);
  }

  function next() {
    if (i + 1 >= qs.length) {
      done = true;
      router.replace({ name: 'result', logs });
      return;
    }
    i++;
    chosen = null;
    phase = 'ask';
    startTimer(store.settings.answerSec, timeout);
  }

  // ---- 長押しで一時停止（タッチがスクロールに変わっても指を離すまで止める） ----
  let holdTimer = 0;
  let suppressClick = false;
  let lastTouch = 0;
  function touchStart(e: Event) {
    if (e.type === 'touchstart') lastTouch = Date.now();
    else if (Date.now() - lastTouch < 800) return; // タッチ後の互換マウスイベントは無視
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => {
      held = true;
      haptic('light');
    }, 280);
  }
  function touchEnd(e: Event) {
    if (e.type !== 'touchend' && e.type !== 'touchcancel' && Date.now() - lastTouch < 800) return;
    clearTimeout(holdTimer);
    if (held) {
      held = false;
      // 長押しを離したときのタップは選択にしない
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 350);
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

  function choiceFx(node: HTMLElement, k: number) {
    // 回答時の動き: 正解はポップ、選んだ誤答は横揺れ
    $effect(() => {
      if (phase !== 'reveal') return;
      if (k === q.answer) popScale(node);
      else if (k === chosen) shake(node);
    });
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="quiz"
  class:paused
  role="application"
  ontouchstart={touchStart}
  ontouchend={touchEnd}
  ontouchcancel={touchEnd}
  onmousedown={touchStart}
  onmouseup={touchEnd}
>
  <header>
    <button class="close press" onclick={close} aria-label="やめる"><Icon name="close" size={22} /></button>
    <span class="count en">{#if qs.length}{i + 1}<span class="of">&ensp;/&ensp;{qs.length}</span>{/if}</span>
    <span class="fmt">{q ? FORMAT_LABEL[q.format] : ''}</span>
  </header>
  <div class="track" class:reveal={phase === 'reveal'}>
    <div class="bar" bind:this={bar}></div>
  </div>
  <div class="pause-note" aria-live="polite"><Icon name="pause" size={14} stroke={2.4} />一時停止中</div>

  <div class="stage">
    <!-- 範囲が空のときの案内（問題エリアの中だけに出す。✕ を塞がない） -->
    {#if ready && !qs.length}
      <div class="empty">
        <p>出題できる問題がありません。</p>
        <p class="sub">設定で出題範囲や出題形式を確認してください。</p>
        <button class="btn press" onclick={() => router.push({ name: 'settings' })}>設定を開く</button>
      </div>
    {/if}
    {#key i}
      {#if q}
        <div class="card" in:cardIn out:cardOut>
          <!-- 上半分: 回答前は問題、回答後は解説に入れ替わる（選択肢は見えたまま） -->
          <div class="upper">
            {#if phase === 'ask'}
              <div class="prompt" out:promptOut>
                {#if q.subject.kind === 'word' && q.format === 'ej'}
                  <h1 class="headword en" class:long={q.subject.word.w.length > 11}>{q.subject.word.w}</h1>
                  <p class="kana-line"><Kana kana={q.subject.word.kana} /></p>
                {:else if q.subject.kind === 'word'}
                  <p class="ask">この意味の英単語は？</p>
                  <h1 class="ja-prompt">
                    {#each q.subject.word.defs as d, di}
                      {#if di === 0 || d.pos !== q.subject.word.defs[0].pos}<span class="def"><span class="pos">{d.pos}</span>{d.ja}</span>{/if}
                    {/each}
                  </h1>
                {:else if q.subject.kind === 'root'}
                  <p class="ask">{q.subject.root.category === '接頭辞' ? '接頭辞' : '語源'}の意味は？</p>
                  <h1 class="headword en root" class:long={q.subject.root.root.length > 11}>{q.subject.root.root}</h1>
                {:else}
                  <p class="ask">熟語の意味は？</p>
                  <h1 class="phrase en">{q.subject.phrase.en}</h1>
                {/if}
              </div>
            {:else}
              <div class="explain scroll" in:explainIn>
                <div class="status" class:ok>
                  <span class="badge">{#if ok}<Icon name="check" size={16} stroke={3} />{:else}<Icon name="x" size={15} stroke={3} />{/if}</span>
                  {ok ? '正解' : chosen === null ? '時間切れ' : '不正解'}
                </div>

                {#if q.subject.kind === 'word'}
                  {@const w = q.subject.word}
                  <div class="head">
                    <span class="hw en" class:long={w.w.length > 12}>{w.w}</span>
                    <Kana kana={w.kana} />
                  </div>
                  <ul class="defs">
                    {#each w.defs as d}<li><span class="pos">{d.pos}</span>{d.ja}</li>{/each}
                  </ul>
                  <Breakdown parts={w.breakdown} core={w.core} />
                  {#if w.examples[0]}<Example ex={w.examples[0]} word={w.w} />{/if}
                {:else if q.subject.kind === 'root'}
                  {@const r = q.subject.root}
                  <div class="head">
                    <span class="hw en">{r.root}</span>
                    <span class="meaning">{r.meaning}<span class="en sub">{r.meaningEn}</span></span>
                  </div>
                  {#if r.memo}<p class="memo">{r.memo}</p>{/if}
                  <ul class="mini">
                    {#each r.words.filter((id) => !r.refs.includes(id)).slice(0, 4) as id}
                      {@const w = store.index!.ds.words[id]}
                      <li><span class="en">{w.w}</span><span class="mj">{w.defs[0]?.ja}</span></li>
                    {/each}
                  </ul>
                {:else}
                  {@const p = q.subject.phrase}
                  <div class="head">
                    <span class="hw en ph">{p.en}</span>
                  </div>
                  <p class="phrase-ja">{p.ja}</p>
                  {#if p.examples[0]}<Example ex={p.examples[0]} word={p.en} />{/if}
                {/if}
              </div>
            {/if}
          </div>

          <div class="choices">
            {#each q.choices as c, k}
              <button
                class="choice press"
                class:en={c.latin}
                class:correct={phase === 'reveal' && k === q.answer}
                class:wrong={phase === 'reveal' && k === chosen && k !== q.answer}
                class:dim={phase === 'reveal' && k !== q.answer && k !== chosen}
                disabled={phase === 'reveal'}
                onclick={() => choose(k)}
                use:choiceFx={k}
              >
                {#if c.tag}<span class="tag">{c.tag}</span>{/if}
                <span class="ct">{c.text}</span>
                {#if phase === 'reveal' && k === q.answer}<span class="mark"><Icon name="check" size={20} stroke={2.6} /></span>
                {:else if phase === 'reveal' && k === chosen}<span class="mark"><Icon name="x" size={18} stroke={2.6} /></span>{/if}
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
    font-size: 12px;
    font-weight: 600;
    color: var(--text3);
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
  .pause-note {
    position: absolute;
    top: calc(var(--pad-top) + 58px);
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
    opacity: 0;
    transform: translateY(-4px);
    transition: opacity 0.18s, transform 0.18s;
    pointer-events: none;
    z-index: 3;
  }
  .paused .pause-note {
    opacity: 1;
    transform: none;
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
  }
  .upper {
    flex: 1;
    position: relative;
    min-height: 0;
    margin-bottom: 14px;
  }
  .prompt,
  .explain {
    position: absolute;
    inset: 0;
  }
  .prompt {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 12px 0;
  }
  .headword {
    font-size: 48px;
    font-weight: 750;
    line-height: 1.1;
    letter-spacing: -0.03em;
    overflow-wrap: anywhere;
  }
  .headword.long {
    font-size: 38px;
  }
  .headword.root {
    font-size: 42px;
  }
  .kana-line {
    font-size: 18px;
  }
  .ask {
    font-size: 13px;
    font-weight: 600;
    color: var(--text3);
    letter-spacing: 0.04em;
  }
  .ja-prompt {
    font-size: 24px;
    font-weight: 700;
    line-height: 1.45;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .phrase {
    font-size: 30px;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: -0.02em;
  }
  .pos {
    display: inline-block;
    font-size: 0.55em;
    font-weight: 600;
    color: var(--text2);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    padding: 0 5px;
    margin-right: 8px;
    vertical-align: 0.3em;
    line-height: 1.6;
  }

  /* 解説（問題のエリアに入れ替わる。長いときはスクロール、下端はフェード） */
  .explain {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 2px 18px;
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent);
  }
  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    color: var(--text2);
    flex: none;
  }
  .status .badge {
    width: 26px;
    height: 26px;
    border-radius: 13px;
    display: grid;
    place-items: center;
    background: var(--fill-strong);
    color: var(--text2);
  }
  .status.ok {
    color: var(--accent);
  }
  .status.ok .badge {
    background: var(--accent);
    color: var(--on-accent);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    flex: none;
  }
  .hw {
    font-size: 32px;
    font-weight: 750;
    letter-spacing: -0.025em;
    line-height: 1.15;
  }
  .hw.long {
    font-size: 26px;
  }
  .hw.ph {
    font-size: 24px;
  }
  .meaning {
    font-size: 20px;
    font-weight: 700;
  }
  .meaning .sub {
    margin-left: 8px;
    font-size: 15px;
    color: var(--text2);
    font-weight: 400;
  }
  .defs {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 18px;
    font-weight: 700;
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: none;
  }
  .defs .pos {
    font-size: 11px;
    vertical-align: 0.15em;
  }
  .memo {
    font-size: 15px;
    line-height: 1.6;
    color: var(--text2);
  }
  .mini {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mini li {
    display: flex;
    gap: 12px;
    align-items: baseline;
  }
  .mini .en {
    font-weight: 650;
    flex: none;
    width: 7.2em;
    overflow-wrap: anywhere;
  }
  .mini .mj {
    font-size: 14px;
    color: var(--text2);
  }
  .phrase-ja {
    font-size: 18px;
    font-weight: 700;
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
    border-color: var(--fill-strong);
    color: var(--text2);
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
