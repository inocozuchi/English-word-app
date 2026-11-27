<script lang="ts">
  // 4択以外の問題（カード全体を描く）:
  //   order      語句をタップで枠に並べる（枠の語をタップで戻す）→ 答え合わせ
  //   translate  英文を入力 → 模範解答を見る → 合っていた／あやしい／違った（自己採点）
  //   exercise   short: 入力して自動採点 / self: 答えを見て自己採点
  //   flashcard  表 → タップでめくる → 覚えた／もう一度
  // キーボード: 並べ替えは 1〜9 で語を選ぶ・Backspace で戻す・Enter で答え合わせ。自己採点は 1/2/3、カードは Space でめくる
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import type { InteractResult } from '../../core/mode.ts';
  import type { IlQuestion } from './quiz.ts';
  import { checkOrder, checkShort, speakText } from './quiz.ts';
  import { speak } from '../../core/speech.ts';
  import { haptic } from '../../core/haptics.ts';
  import { store } from '../../core/store.svelte.ts';
  import { spring, SPRINGS, reducedMotion } from '../../core/spring.ts';
  import { stagger, shake } from '../../core/transitions.ts';
  import { autoSpeakOn } from './autoSpeak.ts';
  import ChapterTag from './ChapterTag.svelte';
  import AnswerBlock from './AnswerBlock.svelte';

  let { q, phase, onanswer, status }: { q: IlQuestion; phase: 'ask' | 'reveal'; onanswer: (r: InteractResult) => void; status: Snippet } = $props();
  const r = $derived(q.data.raw);
  const kind = $derived(q.data.kind);
  // 文字入力を「頭の中で」にしているときは、入力せずに答えを見て自己採点
  const shortMode = $derived(kind === 'exercise' && r.answer_mode === 'short' && store.settings.typing !== 'self');

  let root: HTMLElement;
  // ---- 並べ替え ----
  const tokens = $derived(q.data.tokens ?? []);
  let picked = $state<number[]>([]);
  const full = $derived(picked.length === tokens.length && tokens.length > 0);
  // ---- 入力・自己採点 ----
  let text = $state('');
  /** 模範解答を見せた（自己採点の前） */
  let shown = $state(false);
  let given = $state<string | undefined>(undefined);
  let okState = $state<boolean | undefined>(undefined);
  // ---- カード ----
  let flipped = $state(false);

  function pick(k: number) {
    if (phase !== 'ask' || picked.includes(k)) return;
    picked = [...picked, k];
    haptic('light');
  }
  function unpick(k: number) {
    if (phase !== 'ask') return;
    picked = picked.filter((x) => x !== k);
  }
  let slot: HTMLElement | undefined = $state();
  function checkOrderNow() {
    if (!full || phase !== 'ask') return;
    const words = picked.map((k) => tokens[k]);
    const ok = checkOrder(words, r.answer ?? '');
    given = words.join(' ');
    okState = ok;
    if (!ok && slot) shake(slot);
    send({ ok, given });
  }
  function checkShortNow(skip = false) {
    if (phase !== 'ask') return;
    const t = skip ? '' : text.trim();
    if (!skip && !t) return;
    const ok = !skip && checkShort(t, r.answer ?? '');
    given = t;
    okState = ok;
    send({ ok, given: t });
  }
  function show() {
    if (shown || phase !== 'ask') return;
    shown = true;
    given = kind === 'flashcard' ? undefined : text.trim() || undefined;
    haptic('light');
    const t = speakText(r);
    if (t && autoSpeakOn() && kind === 'translate') speak(t);
  }
  function grade(level: 0 | 1 | 2) {
    if (phase !== 'ask') return;
    // 0 = 違った／もう一度、1 = あやしい（正解として進めるが自信なし）、2 = 合っていた／覚えた
    okState = level > 0;
    send({ ok: level > 0, given: kind === 'flashcard' ? undefined : text.trim(), conf: level === 2 ? 'high' : 'low' });
  }
  function flip() {
    if (phase !== 'ask') return;
    flipped = !flipped;
    if (flipped) shown = true;
    haptic('light');
  }
  function send(res: InteractResult) {
    onanswer(res);
    if (kind !== 'translate' && kind !== 'flashcard') {
      const t = speakText(r);
      if (t && autoSpeakOn()) speak(t);
    }
  }

  // ---- キーボード ----
  function onKey(e: KeyboardEvent) {
    if (phase !== 'ask' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (root?.closest('[inert]')) return; // 右に控えている次のカード
    const el = e.target as HTMLElement | null;
    const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
    if (kind === 'order' && !typing) {
      if (/^[1-9]$/.test(e.key)) {
        const free = tokens.map((_, k) => k).filter((k) => !picked.includes(k));
        const k = free[+e.key - 1];
        if (k !== undefined) pick(k);
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        picked = picked.slice(0, -1);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        checkOrderNow();
        e.preventDefault();
      }
    } else if (kind === 'flashcard' && !typing) {
      if (e.key === ' ' || (e.key === 'Enter' && !flipped)) {
        flip();
        e.preventDefault();
      } else if (flipped && (e.key === '1' || e.key === '2')) {
        grade(e.key === '1' ? 0 : 2);
        e.preventDefault();
      }
    } else if (shortMode) {
      if (e.key === 'Enter') {
        checkShortNow();
        e.preventDefault();
      }
    } else if (kind === 'translate' || kind === 'exercise') {
      if (!shown && e.key === 'Enter') {
        show();
        e.preventDefault();
      } else if (shown && !typing && /^[123]$/.test(e.key)) {
        grade((+e.key - 1) as 0 | 1 | 2);
        e.preventDefault();
      }
    }
  }
  onMount(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** 語が枠に入るとき: 小さく弾む */
  function chipIn(node: HTMLElement) {
    if (reducedMotion()) return;
    const s = spring(SPRINGS.pop);
    node.animate([{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: s.duration, easing: s.easing });
  }
  /** 答えの表示: 上から順に浮かぶ */
  function riseIn(node: HTMLElement) {
    stagger([...node.children], { step: 45, distance: 10, delay: 30 });
  }
</script>

<div class="ia" class:card-mode={kind === 'flashcard'} bind:this={root}>
  <div class="top scroll">
    <div class="status-slot">{#if phase === 'reveal'}{@render status()}{:else}<ChapterTag part={r.part} chapter={r.chapter} title={r.chapter_title} />{/if}</div>

    {#if kind === 'flashcard'}
      <!-- 表と裏のカード。タップでめくる（transform の回転だけ） -->
      <button class="fc press" class:flipped onclick={flip} aria-label={flipped ? '表に戻す' : 'めくる'} disabled={phase === 'reveal'}>
        <span class="face front">
          <span class="fl">{r.tags.join('・') || 'カード'}</span>
          <span class="ft">{r.question}</span>
          <span class="tap">タップでめくる</span>
        </span>
        <span class="face back scroll">
          <span class="fl">{r.question}</span>
          <span class="fb">{r.answer}</span>
          <span class="ref">教科書 p.{r.ref_page_a5}（第{r.chapter}章「{r.chapter_title}」）</span>
        </span>
      </button>
    {:else}
      <p class="qt">{r.question}</p>
      {#if r.prompt_ja && kind !== 'exercise'}<p class="pj">{r.prompt_ja}</p>{/if}

      {#if kind === 'order'}
        <div class="slot" class:ok={okState === true} class:ng={okState === false} bind:this={slot} aria-label="並べた英文">
          {#each picked as k (k)}
            <button class="tok on en press" use:chipIn onclick={() => unpick(k)} disabled={phase === 'reveal'}>{tokens[k]}</button>
          {:else}
            <span class="ph">下の語句をタップして並べる</span>
          {/each}
        </div>
      {:else if !(kind === 'exercise' && phase === 'reveal' && !shortMode && !text)}
        <label class="inp">
          <span class="il">{shortMode ? '答え' : kind === 'exercise' ? '自分の答え（任意）' : '英文'}</span>
          {#if shortMode}
            <input
              type="text"
              bind:value={text}
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              enterkeyhint="done"
              disabled={phase === 'reveal'}
              placeholder="入力して答え合わせ"
            />
          {:else}
            <textarea
              bind:value={text}
              rows="2"
              autocomplete="off"
              autocapitalize={kind === 'translate' ? 'sentences' : 'off'}
              spellcheck="false"
              enterkeyhint="done"
              disabled={shown || phase === 'reveal'}
              placeholder={kind === 'translate' ? '頭の中で答えるだけでも OK' : '書かなくても OK'}
              onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); show(); } }}
            ></textarea>
          {/if}
        </label>
      {/if}
    {/if}

    {#if (shown && kind !== 'flashcard') || (phase === 'reveal' && kind !== 'flashcard')}
      <div use:riseIn>
        <AnswerBlock {r} given={kind === 'translate' || kind === 'exercise' ? (given || undefined) : given} ok={okState} />
      </div>
    {/if}
  </div>

  {#if phase === 'ask'}
    <div class="bottom">
      {#if kind === 'order'}
        <div class="bank">
          {#each tokens as t, k}
            <button class="tok en press" class:used={picked.includes(k)} onclick={() => pick(k)} disabled={picked.includes(k)} aria-hidden={picked.includes(k)}>{t}</button>
          {/each}
        </div>
        <div class="acts two">
          <button class="sec press" onclick={() => (picked = [])} disabled={!picked.length}>やり直す</button>
          <button class="pri press" onclick={checkOrderNow} disabled={!full}>答え合わせ</button>
        </div>
      {:else if kind === 'flashcard'}
        {#if flipped}
          <div class="acts two">
            <button class="sec press" onclick={() => grade(0)}>もう一度</button>
            <button class="pri press" onclick={() => grade(2)}>覚えた</button>
          </div>
        {:else}
          <div class="acts"><button class="pri press" onclick={flip}>めくる</button></div>
        {/if}
      {:else if shortMode}
        <div class="acts two">
          <button class="sec press" onclick={() => checkShortNow(true)}>わからない</button>
          <button class="pri press" onclick={() => checkShortNow()} disabled={!text.trim()}>答え合わせ</button>
        </div>
      {:else if !shown}
        <div class="acts"><button class="pri press" onclick={show}>{kind === 'translate' ? '模範解答を見る' : '答えを見る'}</button></div>
      {:else}
        <p class="ask">自分の答えはどうでしたか？</p>
        <div class="acts three">
          <button class="sec press" onclick={() => grade(0)}>違った</button>
          <button class="sec press" onclick={() => grade(1)}>あやしい</button>
          <button class="pri press" onclick={() => grade(2)}>合っていた</button>
        </div>
      {/if}
    </div>
  {:else if kind === 'flashcard'}
    <div class="bottom"><p class="ask done">{okState ? '覚えた' : 'もう一度（苦手克服・復習に入ります）'}</p></div>
  {/if}
</div>

<style>
  .ia {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .top {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 6px 2px 16px;
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 16px), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 16px), transparent);
  }
  .status-slot {
    flex: none;
    min-height: 30px;
    display: flex;
    align-items: center;
  }
  .status-slot > :global(*) {
    flex: 1;
  }
  .qt {
    font-size: 14px;
    font-weight: 600;
    color: var(--text2);
    line-height: 1.5;
  }
  .pj {
    font-size: clamp(19px, 5.6vw, 23px);
    font-weight: 800;
    line-height: 1.45;
  }

  /* 並べ替え */
  .slot {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 8px;
    min-height: 112px;
    padding: 12px;
    border: var(--panel-border);
    border-radius: 18px;
    transition: border-color 0.25s;
  }
  .slot.ok {
    border-color: var(--accent);
  }
  .slot.ng {
    border-style: dashed;
  }
  .ph {
    font-size: 13px;
    color: var(--text3);
    align-self: center;
    margin: auto;
  }
  .bank {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-bottom: 12px;
  }
  .tok {
    min-height: 46px;
    padding: 0 15px;
    border-radius: 12px;
    border: 2px solid var(--ink);
    font-size: 18px;
    font-weight: 600;
    background: var(--bg);
    transition: opacity 0.2s, transform var(--dur-press, 300ms) var(--ease-press, ease-out);
  }
  .tok.on {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--on-accent);
  }
  .slot.ng .tok.on {
    background: var(--fill-strong);
    border-color: var(--ink);
    color: var(--text);
  }
  .tok.used {
    opacity: 0;
    pointer-events: none;
  }

  /* 入力 */
  .inp {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .il {
    font-size: 11px;
    font-weight: 700;
    color: var(--text3);
  }
  input,
  textarea {
    font: inherit;
    font-family: var(--font-en);
    font-size: 18px;
    padding: 12px 14px;
    border-radius: 16px;
    border: var(--panel-border);
    background: var(--bg);
    color: var(--text);
    resize: none;
    width: 100%;
  }
  input:disabled,
  textarea:disabled {
    opacity: 0.7;
  }

  /* カード */
  .card-mode .top {
    -webkit-mask-image: none;
    mask-image: none;
    overflow: hidden;
  }
  .fc {
    flex: 1;
    position: relative;
    min-height: 260px;
    perspective: 1200px;
    text-align: left;
  }
  .fc:disabled {
    cursor: default;
  }
  .face {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 20px 18px;
    border: var(--panel-border);
    border-radius: 24px;
    background: var(--bg);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    transition: transform 0.5s cubic-bezier(0.3, 1.25, 0.5, 1);
  }
  .front {
    justify-content: center;
  }
  .back {
    transform: rotateY(180deg);
  }
  .fc.flipped .front {
    transform: rotateY(-180deg);
  }
  .fc.flipped .back {
    transform: none;
  }
  .fl {
    font-size: 12px;
    font-weight: 700;
    color: var(--text3);
  }
  .ft {
    font-size: clamp(21px, 6.2vw, 26px);
    font-weight: 800;
    line-height: 1.45;
  }
  .tap {
    font-size: 12px;
    color: var(--text3);
    margin-top: auto;
  }
  .fb {
    font-size: 15px;
    line-height: 1.7;
    white-space: pre-line;
  }
  .ref {
    margin-top: auto;
    font-size: 12px;
    color: var(--text2);
    font-weight: 600;
  }

  /* 下の操作 */
  .bottom {
    flex: none;
    padding-top: 6px;
  }
  .ask {
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
    text-align: center;
    margin-bottom: 8px;
  }
  .ask.done {
    margin: 4px 0 0;
  }
  .acts {
    display: grid;
    gap: 10px;
  }
  .acts.two {
    grid-template-columns: 1fr 1.4fr;
  }
  .acts.three {
    grid-template-columns: 1fr 1fr 1.2fr;
  }
  .acts button {
    min-height: 58px;
    border-radius: 18px;
    font-size: 16px;
    font-weight: 800;
  }
  .pri {
    background: var(--accent);
    color: var(--on-accent);
    border: var(--frame) solid var(--ink);
  }
  .sec {
    border: var(--frame) solid var(--ink);
  }
  .acts button:disabled {
    opacity: 0.35;
  }
  @media (prefers-reduced-motion: reduce) {
    .face {
      transition: opacity 0.2s;
    }
  }
</style>
