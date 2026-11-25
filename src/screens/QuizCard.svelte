<script lang="ts">
  // クイズの1枚分（問題文 or 解説 ＋ 4択）。クイズ画面はこれを横に並べてめくる。
  import Icon from '../components/Icon.svelte';
  import type { Deck, Question } from '../core/deck.ts';
  import type { ReviewEvent, ReviewEntry } from '../core/review.ts';
  import { spring, SPRINGS, reducedMotion } from '../core/spring.ts';
  import { promptOut, popScale, shake, stagger } from '../core/transitions.ts';

  let {
    deck,
    q,
    phase,
    chosen,
    event = null,
    reviewEntry,
    reviewGoal,
    onchoose,
  }: {
    deck: Deck;
    q: Question;
    phase: 'ask' | 'reveal';
    chosen: number | null;
    event?: ReviewEvent;
    reviewEntry?: ReviewEntry;
    reviewGoal: number;
    onchoose: (k: number) => void;
  } = $props();

  const ok = $derived(phase === 'reveal' && chosen === q.answer);

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

<!-- 上半分: 回答前は問題、回答後は解説に入れ替わる（選択肢は見えたまま） -->
<div class="upper">
  {#if phase === 'ask'}
    <div class="q-area" out:promptOut><deck.Prompt {q} /></div>
  {:else}
    <div class="explain scroll" use:explainFx>
      <div class="status" class:ok>
        {#if ok}
          <span class="badge ring" use:badgeFx={true}></span>正解
        {:else}
          <span class="badge cross" use:badgeFx={false}><Icon name="x" size={15} stroke={3.2} /></span>{chosen === null ? '時間切れ' : '不正解'}
        {/if}
        {#if event && REVIEW_NOTE[event]}
          <span class="rnote" class:cleared={event === 'cleared'}>{REVIEW_NOTE[event]}</span>
        {:else if event === 'progress' && reviewEntry}
          <span class="rnote">復習 {reviewEntry.streak}/{reviewGoal}</span>
        {/if}
      </div>
      <deck.Explain {q} />
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
      onclick={() => onchoose(k)}
      use:choiceFx={k}
    >
      {#if c.tag}<span class="tag">{c.tag}</span>{/if}
      <span class="ct">{c.text}</span>
      {#if isAns}<span class="mark"><span class="mini-ring"></span></span>
      {:else if isMine}<span class="mine">あなたの答え</span><span class="mark"><Icon name="x" size={18} stroke={2.8} /></span>{/if}
    </button>
  {/each}
</div>

<style>
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
</style>
