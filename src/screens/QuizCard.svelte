<script lang="ts">
  // クイズの1枚分（問題文 or 解説 ＋ 4択）。クイズ画面はこれを横に並べてめくる。
  import Icon from '../components/Icon.svelte';
  import type { QuizMode, Question, InteractResult } from '../core/mode.ts';
  import type { ReviewEvent, ReviewEntry } from '../core/review.ts';
  import { spring, SPRINGS, reducedMotion } from '../core/spring.ts';
  import { promptOut, popScale, shake, stagger } from '../core/transitions.ts';

  let {
    mode,
    q,
    phase,
    chosen,
    event = null,
    reviewEntry,
    reviewGoal,
    onchoose,
    result = null,
    oninteract,
  }: {
    mode: QuizMode;
    q: Question;
    phase: 'ask' | 'reveal';
    chosen: number | null;
    event?: ReviewEvent;
    reviewEntry?: ReviewEntry;
    reviewGoal: number;
    onchoose: (k: number) => void;
    /** Interact で答えた問題の正誤 */
    result?: boolean | null;
    oninteract?: (r: InteractResult) => void;
  } = $props();

  const ok = $derived(phase === 'reveal' && (result ?? chosen === q.answer));
  const interactive = $derived(!!(q.interactive && mode.Interact));
  /** 画像の選択肢は 2×2 に並べる */
  const grid = $derived(q.choices.length > 0 && q.choices.every((c) => c.image));
  /** 画像の縦横比（読み込んだら分かる）。横長の図ばかりなら1列に並べて大きく見せる */
  let aspects = $state<Record<string, number>>({});
  const wide = $derived(grid && q.choices.every((c) => (aspects[c.image!] ?? 0) >= 1.8));
  function measure(e: Event) {
    const im = e.currentTarget as HTMLImageElement;
    if (im.naturalWidth && im.naturalHeight) aspects[im.getAttribute('src')!] = im.naturalWidth / im.naturalHeight;
  }
  const note = $derived(typeof mode.note === 'function' ? mode.note(q) : (mode.note ?? null));

  const REVIEW_NOTE: Record<Exclude<ReviewEvent, null>, string> = {
    added: '復習リストに追加',
    missed: '復習リスト：やり直し',
    progress: '',
    cleared: '復習リストから外れました',
  };

  /** 解説: 中の要素を上から順に浮かび上がらせる */
  function explainFx(node: HTMLElement) {
    stagger([...node.children], { step: 45, distance: 10, delay: 40 });
  }

  /** ◯ / × のバッジ: 弾むように出る（正解は大きく弾み、不正解は小さく揺れる） */
  function badgeFx(node: HTMLElement, good: boolean) {
    if (reducedMotion()) return;
    const s = spring(good ? SPRINGS.pop : SPRINGS.card);
    node.animate([{ transform: 'scale(0.2) rotate(-25deg)' }, { transform: 'none' }], { duration: s.duration, easing: s.easing });
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

{#snippet status()}
  <div class="status" class:ok>
    {#if ok}
      <span class="badge ring" use:badgeFx={true}></span>正解
    {:else}
      <span class="badge cross" use:badgeFx={false}><Icon name="x" size={15} stroke={3.2} /></span>{result === false ? '不正解' : chosen === null ? '時間切れ' : '不正解'}
    {/if}
    {#if event && REVIEW_NOTE[event]}
      <span class="rnote" class:cleared={event === 'cleared'}>{REVIEW_NOTE[event]}</span>
    {:else if event === 'progress' && reviewEntry}
      <span class="rnote">復習 {reviewEntry.streak}/{reviewGoal}</span>
    {/if}
  </div>
{/snippet}

{#if interactive && mode.Interact}
  <!-- 4択以外（並べ替え・入力・自己採点・カード）: カード全体をモードが描く -->
  <div class="interact"><mode.Interact {q} {phase} onanswer={(r) => oninteract?.(r)} {status} /></div>
{:else}
<!-- 上半分 -->
<div class="upper">
  {#if mode.inlineExplain}
    <!-- 問題文を残したまま、回答後はその上に解説を重ねる（音声変化のマーキングなど）。
         正誤の行の場所は最初から確保しておき、回答の瞬間に文が動かないようにする -->
    <div class="inline scroll">
      <div class="status-slot">{#if phase === 'reveal'}{@render status()}{/if}</div>
      <mode.Prompt {q} {phase} />
      {#if phase === 'reveal' && note}<p class="mode-note">{note}</p>{/if}
    </div>
  {:else if phase === 'ask'}
    <!-- 回答前は問題、回答後は解説に入れ替わる（選択肢は見えたまま） -->
    <div class="q-area" out:promptOut><mode.Prompt {q} {phase} /></div>
  {:else}
    <div class="explain scroll" use:explainFx>
      {@render status()}
      {#if mode.Explain}<mode.Explain {q} />{/if}
      {#if note}<p class="mode-note">{note}</p>{/if}
    </div>
  {/if}
</div>

<div class="choices" class:grid class:wide>
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
      onclick={() => onchoose(k)}
      use:choiceFx={k}
    >
      {#if c.image}
        <img class="cimg" src={c.image} alt={c.text} draggable="false" onload={measure} />
        <span class="cnum en">{k + 1}</span>
      {:else}
      {#if c.color}<span class="cdot" style:--c={c.color}></span>{/if}
      {#if c.tag}<span class="tag">{c.tag}</span>{/if}
      <span class="ct">{c.text}</span>
      {#if phase !== 'reveal' && k < 9}<kbd class="ck en" aria-hidden="true">{k + 1}</kbd>{/if}
      {/if}
      {#if isAns}<span class="mark"><span class="mini-ring"></span></span>
      {:else if isMine}<span class="mine">あなたの答え</span><span class="mark"><Icon name="x" size={18} stroke={2.8} /></span>{/if}
    </button>
  {/each}
</div>
{/if}

<style>
  .interact {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .upper {
    flex: 1;
    position: relative;
    min-height: 0;
    margin-bottom: 14px;
  }
  .q-area,
  .explain,
  .inline {
    position: absolute;
    inset: 0;
  }
  .inline {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 2px 18px;
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent);
  }
  .status-slot {
    flex: none;
    min-height: 30px;
  }
  .mode-note {
    font-size: 11px;
    color: var(--text3);
    margin-top: 2px;
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
      background-color 0.25s,
      border-color 0.25s,
      color 0.25s,
      opacity 0.3s,
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
  .cdot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c);
  }
  .choice.correct .cdot {
    box-shadow: 0 0 0 2px var(--on-accent);
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
  /* パソコン: 選択肢のキー（1〜4）を右端に小さく */
  .ck {
    display: none;
  }
  @media (hover: hover) and (pointer: fine) {
    .ck {
      display: grid;
      place-items: center;
      position: absolute;
      right: 14px;
      top: 50%;
      translate: 0 -50%;
      min-width: 22px;
      height: 22px;
      border-radius: 6px;
      border: 1.5px solid var(--line-strong);
      font-size: 11px;
      font-weight: 700;
      color: var(--text3);
      transition: border-color 0.15s, color 0.15s;
    }
    /* 答えたあとの選択肢（disabled）はマウスのイベントを受けないので、下のカードに通してドラッグで「次へ」できるようにする */
    .choice:disabled {
      pointer-events: none;
    }
    .choice:not(:disabled):hover {
      border-color: var(--ink);
    }
    .choice:not(:disabled):hover .ck {
      border-color: var(--ink);
      color: var(--text);
    }
  }
  .mark {
    position: absolute;
    right: 14px;
    top: 50%;
    translate: 0 -50%;
    display: grid;
  }
  /* 画像の選択肢（2×2）。図は白地のまま見せる（ダークモードでも図の線が読める） */
  .choices.grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .grid .choice {
    padding: 6px;
    min-height: 0;
    aspect-ratio: 4 / 3;
    justify-content: center;
    background: #fff;
  }
  .grid .choice:active {
    background: #f2f2f4;
  }
  .grid .choice.correct {
    background: #fff;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent);
  }
  .grid .choice.wrong {
    background: #fff;
    padding-top: 6px;
  }
  .choices.grid.wide {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .grid.wide .choice {
    aspect-ratio: auto;
    height: clamp(70px, 12.5vh, 118px);
    padding: 5px 10px 5px 30px;
  }
  .grid.wide .cnum {
    top: 50%;
    translate: 0 -50%;
    left: 11px;
    font-size: 14px;
  }
  .cimg {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
  .cnum {
    position: absolute;
    left: 7px;
    top: 5px;
    font-size: 12px;
    font-weight: 800;
    color: #6b6b73;
  }
  .grid .mark,
  .grid .mine {
    color: var(--accent);
  }
  .grid .choice.wrong .mark,
  .grid .choice.wrong .mine {
    color: #111114;
  }
  .grid .mine {
    top: auto;
    bottom: 5px;
    left: 8px;
    background: #fff;
    padding: 0 4px;
    border-radius: 4px;
  }
  .grid .mark {
    top: 18px;
    right: 8px;
  }
  .mini-ring {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 3px solid currentColor;
  }
</style>
