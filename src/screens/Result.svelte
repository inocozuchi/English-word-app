<script lang="ts">
  import { onMount } from 'svelte';
  import Num from '../components/Num.svelte';
  import { router } from '../core/router.svelte.ts';
  import type { AnswerLog } from '../core/router.svelte.ts';
  import type { SessionMode } from '../core/session.ts';
  import { store, activeDeck } from '../core/store.svelte.ts';
  import { streak } from '../core/day.ts';
  import { reviewCount } from '../core/review.ts';
  import { rise, burst, stagger } from '../core/transitions.ts';
  import Icon from '../components/Icon.svelte';
  import type { Question } from '../core/deck.ts';

  let { logs, mode = 'normal', marks = [] }: { logs: AnswerLog[]; mode?: SessionMode; marks?: ('ok' | 'ng')[] } = $props();
  const deck = activeDeck();
  // 結果画面は表示中に logs が変わらないので、最初の値だけ使う
  // svelte-ignore state_referenced_locally
  const correct = logs.filter((l) => l.chosen === l.q.answer).length;
  // svelte-ignore state_referenced_locally
  const total = logs.length;
  const rate = total ? Math.round((correct / total) * 100) : 0;
  // svelte-ignore state_referenced_locally
  const missed = logs.filter((l) => l.chosen !== l.q.answer);
  // svelte-ignore state_referenced_locally
  const added = logs.filter((l) => l.review === 'added').length;
  // svelte-ignore state_referenced_locally
  const cleared = logs.filter((l) => l.review === 'cleared').length;
  const days = $derived(streak(store.progress.days, store.today));
  const left = $derived(reviewCount(store.progress.review, deck.id));

  const label = (q: Question) => deck.label(q.key) ?? { title: q.key, sub: '' };
  function open(q: Question) {
    const r = deck.detailRoute(q.key);
    if (r) router.push(r);
  }
  // 画面がスライドし終わるころに、スコアを 0 から数え上げ、各問の点を順に弾ませる。よければ紙吹雪
  let score = $state(0);
  let scoreEl: HTMLElement;
  let dotsEl: HTMLElement | undefined = $state();
  onMount(() => {
    // 点は最初から隠した状態で待たせる（表示→消える→出る、のちらつきを作らない）
    if (dotsEl) stagger([...dotsEl.children], { step: 45, distance: 8, delay: 380 });
    const t1 = setTimeout(() => (score = correct), 380);
    const t2 = setTimeout(() => {
      if (total && rate >= 80) burst(scoreEl, rate === 100 ? 40 : 26);
    }, 950);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  });

  const message = rate === 100 ? '全問正解！' : rate >= 80 ? 'いい調子です' : rate >= 50 ? 'もう一息' : 'まちがえた問題は復習リストに入りました';
</script>

<div class="result">
  <div class="scroll body">
    <div class="hero" in:rise>
      <p class="eyebrow-en">{mode === 'review' ? 'Review result' : 'Result'}</p>
      <p class="msg">{message}</p>
      <p class="score en" bind:this={scoreEl}><Num value={score} duration={Math.min(900, 120 * correct + 200)} /><span class="slash">/</span><span class="total">{total}</span></p>
      {#if marks.length}
        <p class="dots" bind:this={dotsEl} aria-hidden="true">{#each marks as m}<span class="mk {m}"></span>{/each}</p>
      {/if}
      <p class="rate">正答率 {rate}% {#if days > 0}<span class="dot">·</span><Icon name="flame" size={15} /> {days}日連続{/if}</p>
    </div>

    {#if added || cleared}
      <div class="review" in:rise={{ delay: 40 }}>
        <Icon name="review" size={20} />
        <span>
          {#if added}復習リストに <b>{added}</b> 件追加{/if}{#if added && cleared}・{/if}{#if cleared}<b>{cleared}</b> 件クリア{/if}
          <small>（リスト {left} 件）</small>
        </span>
      </div>
    {/if}

    {#if missed.length}
      <h2 in:rise={{ delay: 60 }}>まちがえた問題 <span class="n">{missed.length}</span></h2>
      <ul class="list" in:rise={{ delay: 100 }}>
        {#each missed as l}
          {@const lb = label(l.q)}
          <li>
            <button class="row press" onclick={() => open(l.q)}>
              <span class="main">
                <span class="w" class:en={lb.latin}>{lb.title}</span>
                <span class="m">{lb.sub}</span>
                <span class="yours">{l.chosen === null ? '時間切れ' : `あなたの答え: ${l.q.choices[l.chosen].text}`}</span>
              </span>
              <span class="chev"><Icon name="chevron" size={18} /></span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  <div class="actions">
    <button class="primary press" onclick={() => router.replace({ name: 'quiz', params: { seed: Date.now(), mode: mode === 'review' && left === 0 ? 'normal' : mode } })}>
      {mode === 'review' && left > 0 ? '続けて復習' : 'もう一度'}
    </button>
    <button class="secondary press" onclick={() => router.pop()}>ホーム</button>
  </div>
</div>

<style>
  .result {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  .body {
    flex: 1;
    padding: calc(var(--pad-top) + 24px) var(--pad-x-r) 32px var(--pad-x);
    /* 下にまだ続くことがわかるよう、下端をフェードさせる */
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent);
  }
  .hero {
    text-align: center;
    padding: 28px 0 26px;
  }
  .msg {
    font-size: 15px;
    font-weight: 600;
    margin-top: 6px;
  }
  .score {
    font-size: 88px;
    font-weight: 850;
    letter-spacing: -0.04em;
    line-height: 1.05;
    margin: 6px 0;
    font-variant-numeric: tabular-nums;
  }
  .dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin: 4px 0 12px;
  }
  .mk {
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }
  .mk.ok {
    background: var(--accent);
  }
  .mk.ng {
    background: var(--ink);
  }
  .slash {
    color: var(--text3);
    font-weight: 300;
    margin: 0 0.06em;
  }
  .total {
    color: var(--text3);
  }
  .rate {
    font-size: 15px;
    color: var(--text2);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .rate :global(svg) {
    color: var(--accent);
  }
  .dot {
    margin: 0 4px;
    color: var(--text3);
  }
  .review {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    margin-bottom: 18px;
    border-radius: var(--radius);
    border: var(--frame) solid var(--ink);
    font-size: 14px;
  }
  .review b {
    font-family: var(--font-en);
    font-size: 17px;
  }
  .review small {
    color: var(--text3);
  }
  h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text2);
    margin: 0 4px 10px;
  }
  .n {
    color: var(--text3);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    border-radius: var(--radius-lg);
    background: var(--surface);
    overflow: hidden;
  }
  .list li + li {
    border-top: 0.5px solid var(--line);
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 14px 14px 18px;
    text-align: left;
  }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .w {
    font-size: 19px;
    font-weight: 600;
  }
  .m {
    font-size: 15px;
  }
  .yours {
    font-size: 12px;
    color: var(--text3);
  }
  .chev {
    color: var(--text3);
    display: grid;
  }
  .actions {
    flex: none;
    display: flex;
    gap: 10px;
    padding: 12px var(--pad-x-r) var(--pad-bottom) var(--pad-x);
  }
  .actions button {
    flex: 1;
    height: 58px;
    border-radius: 18px;
    border: var(--frame) solid var(--ink);
    font-weight: 650;
    font-size: 17px;
  }
  .primary {
    background: var(--accent);
    color: var(--on-accent);
  }
  .secondary {
    background: var(--bg);
  }
</style>
