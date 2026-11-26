<script lang="ts">
  // イメージリンクの学習記録: 部ごとの進み具合と、正答率の低い章（タップでその章のミニテスト）
  import Icon from '../../components/Icon.svelte';
  import { store } from '../../core/store.svelte.ts';
  import { router } from '../../core/router.svelte.ts';
  import PartBars from './PartBars.svelte';
  import { chapterStats } from './quiz.ts';
  import { il } from './state.svelte.ts';
  import { startChapter } from './start.ts';

  const weak = $derived.by(() => {
    const st = chapterStats(store.progress.items);
    return [...st.entries()]
      .filter(([, x]) => x.seen >= 5)
      .map(([no, x]) => ({ no, rate: x.correct / x.seen, title: il.index?.chapters.find((c) => c.no === no)?.title ?? '' }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 8);
  });
</script>

<h2 class="ui-h2">部ごとの進み具合</h2>
<div class="card"><PartBars /></div>
<button class="all press" onclick={() => router.push({ name: 'imagelink/chapters' })}>章ごとの達成度を見る<Icon name="chevron" size={18} /></button>

{#if weak.length}
  <h2 class="ui-h2">正答率の低い章</h2>
  <ul class="chs">
    {#each weak as x}
      <li>
        <button class="row press" onclick={() => startChapter(x.no)}>
          <span class="cn">第{x.no}章 {x.title}</span>
          <span class="track"><span class="fill" style:transform="scaleX({x.rate})"></span></span>
          <span class="cr en">{Math.round(x.rate * 100)}%</span>
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .card {
    padding: 16px;
    border-radius: var(--radius-lg);
    background: var(--panel-bg);
    border: var(--panel-border);
  }
  .all {
    margin-top: 10px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    padding: 0 16px;
    border-radius: 16px;
    border: var(--panel-border);
    font-weight: 700;
  }
  .chs {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .row {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 70px 40px;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    min-height: 40px;
    text-align: left;
  }
  .cn {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .track {
    height: 6px;
    border-radius: 3px;
    background: var(--fill);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--accent);
    transform-origin: left center;
  }
  .cr {
    text-align: right;
    font-weight: 700;
  }
</style>
