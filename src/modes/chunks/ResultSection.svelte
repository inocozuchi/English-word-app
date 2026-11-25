<script lang="ts">
  // 会話チャンクモードの結果: 優先度ごとの進み具合、苦手な章（上位3つ）、まちがえた表現
  import type { AnswerRecord } from '../../core/mode.ts';
  import { router } from '../../core/router.svelte.ts';
  import { store } from '../../core/store.svelte.ts';
  import PriorityBars from './components/PriorityBars.svelte';
  import Badges from './components/Badges.svelte';
  import { chk } from './state.svelte.ts';
  import { weakSections } from './sections.ts';
  import type { ChunkQuestion } from './quiz.ts';
  import { rise } from '../../core/transitions.ts';

  let { logs }: { logs: AnswerRecord[] } = $props();
  // svelte-ignore state_referenced_locally
  const missed = logs.filter((l) => l.chosen !== l.q.answer).map((l) => l.q as ChunkQuestion);
  const weak = $derived(chk.index ? weakSections(chk.index, store.progress.tags) : []);
</script>

<h2 in:rise={{ delay: 60 }}>優先度ごとの進み具合</h2>
<div class="card" in:rise={{ delay: 80 }}>
  <PriorityBars delay={500} />
  <p class="hint">習得済み = 3回続けて正解（次の復習まで7日以上）</p>
</div>

{#if weak.length}
  <h2 in:rise={{ delay: 90 }}>苦手な章</h2>
  <ol class="weak" in:rise={{ delay: 100 }}>
    {#each weak as w, k}
      <li>
        <button class="row press" onclick={() => router.push({ name: 'chunks/list', params: { section: w.no } })}>
          <span class="rank en">{k + 1}</span>
          <span class="t">第{w.no}章 {w.title}</span>
          <span class="pct en">{Math.round(w.rate * 100)}%</span>
        </button>
      </li>
    {/each}
  </ol>
{/if}

{#if missed.length}
  <h2 in:rise={{ delay: 100 }}>まちがえた表現 <span class="n">{missed.length}</span></h2>
  <ul class="missed" in:rise={{ delay: 120 }}>
    {#each missed as q}
      {@const s = q.data}
      <li>
        {#if s.kind === 'entry'}
          <button class="m press" onclick={() => router.push({ name: 'chunks/entry', params: { id: s.entry.id } })}>
            <span class="chunk en">{s.entry.chunk}<Badges entry={s.entry} /></span>
            <span class="mean">{s.entry.meaning}</span>
            <span class="ex en">{s.entry.ex}</span>
          </button>
        {:else}
          <button class="m press" onclick={() => router.push({ name: 'chunks/dict', params: { tab: 'pairs' } })}>
            <span class="chunk en">{s.pair[s.side].en}</span>
            <span class="mean">{s.pair[s.side].ja}</span>
            <span class="ex">vs. <span class="en">{s.pair[s.side === 'a' ? 'b' : 'a'].en}</span></span>
          </button>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text2);
    margin: 0 4px 10px;
  }
  .n {
    color: var(--text3);
  }
  .card {
    padding: 16px;
    border-radius: var(--radius-lg);
    background: var(--surface);
    margin-bottom: 22px;
  }
  .hint {
    margin-top: 10px;
    font-size: 11px;
    color: var(--text3);
  }
  .weak {
    list-style: none;
    margin: 0 0 22px;
    padding: 0;
    border-radius: var(--radius-lg);
    background: var(--surface);
    overflow: hidden;
  }
  .weak li + li {
    border-top: 0.5px solid var(--line);
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    text-align: left;
  }
  .rank {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--bg);
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 800;
  }
  .t {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
  }
  .pct {
    font-size: 14px;
    font-weight: 700;
    color: var(--text2);
  }
  .missed {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .m {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 16px;
    border-radius: var(--radius-lg);
    background: var(--surface);
    text-align: left;
  }
  .chunk {
    font-size: 17px;
    font-weight: 700;
  }
  .mean {
    font-size: 14px;
    font-weight: 600;
  }
  .ex {
    font-size: 13px;
    color: var(--text2);
  }
</style>
