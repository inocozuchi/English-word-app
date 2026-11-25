<script lang="ts">
  import { router } from '../lib/router.svelte.ts';
  import type { AnswerLog } from '../lib/router.svelte.ts';
  import { store, today } from '../lib/store.svelte.ts';
  import { streak } from '../lib/day.ts';
  import { rise } from '../lib/transitions.ts';
  import Icon from '../components/Icon.svelte';
  import type { Question } from '../lib/quiz.ts';

  let { logs }: { logs: AnswerLog[] } = $props();
  // 結果画面は表示中に logs が変わらないので、最初の値だけ使う
  // svelte-ignore state_referenced_locally
  const correct = logs.filter((l) => l.chosen === l.q.answer).length;
  // svelte-ignore state_referenced_locally
  const total = logs.length;
  const rate = total ? Math.round((correct / total) * 100) : 0;
  // svelte-ignore state_referenced_locally
  const missed = logs.filter((l) => l.chosen !== l.q.answer);
  const days = $derived(streak(store.progress.days, today()));

  function title(q: Question) {
    const s = q.subject;
    return s.kind === 'word' ? s.word.w : s.kind === 'root' ? s.root.root : s.phrase.en;
  }
  function meaning(q: Question) {
    const s = q.subject;
    return s.kind === 'word' ? s.word.defs.map((d) => d.ja).join('／') : s.kind === 'root' ? s.root.meaning : s.phrase.ja;
  }
  function open(q: Question) {
    const s = q.subject;
    if (s.kind === 'word') router.push({ name: 'word', w: s.word.w });
    else if (s.kind === 'root') router.push({ name: 'root', id: s.root.id });
    else router.push({ name: 'root', id: s.phrase.root });
  }
  const message = rate === 100 ? '全問正解！' : rate >= 80 ? 'いい調子です' : rate >= 50 ? 'もう一息' : 'まちがえた語は次回また出ます';
</script>

<div class="result">
  <div class="scroll body">
    <div class="hero" in:rise>
      <p class="msg">{message}</p>
      <p class="score en">{correct}<span class="slash">/</span><span class="total">{total}</span></p>
      <p class="rate">正答率 {rate}% {#if days > 0}<span class="dot">·</span><Icon name="flame" size={15} /> {days}日連続{/if}</p>
    </div>

    {#if missed.length}
      <h2 in:rise={{ delay: 60 }}>まちがえた単語 <span class="n">{missed.length}</span></h2>
      <ul class="list" in:rise={{ delay: 100 }}>
        {#each missed as l}
          <li>
            <button class="row press" onclick={() => open(l.q)}>
              <span class="main">
                <span class="w en">{title(l.q)}</span>
                <span class="m">{meaning(l.q)}</span>
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
    <button class="primary press" onclick={() => router.replace({ name: 'quiz', seed: Date.now() })}>もう一度</button>
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
    padding: calc(var(--pad-top) + 24px) var(--pad-x-r) 16px var(--pad-x);
  }
  .hero {
    text-align: center;
    padding: 28px 0 32px;
  }
  .msg {
    font-size: 15px;
    color: var(--text2);
  }
  .score {
    font-size: 84px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.05;
    margin: 6px 0;
    font-variant-numeric: tabular-nums;
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
    height: 56px;
    border-radius: var(--radius);
    font-weight: 650;
    font-size: 17px;
  }
  .primary {
    background: var(--accent);
    color: var(--on-accent);
  }
  .secondary {
    background: var(--fill);
  }
</style>
