<script lang="ts">
  // 会話チャンクモードの学習記録: 優先度ごとの進み具合と、章ごとの正答率
  import { store } from '../../core/store.svelte.ts';
  import { router } from '../../core/router.svelte.ts';
  import PriorityBars from './components/PriorityBars.svelte';
  import { chk } from './state.svelte.ts';
  import { weakSections } from './sections.ts';

  const sections = $derived(chk.index ? weakSections(chk.index, store.progress.tags, 20) : []);
</script>

<h2 class="ui-h2">優先度ごとの進み具合</h2>
<div class="card"><PriorityBars /></div>

{#if sections.length}
  <h2 class="ui-h2">章ごとの正答率（低い順）</h2>
  <ul class="chs">
    {#each sections as x}
      <li>
        <button class="row" onclick={() => router.push({ name: 'chunks/list', params: { section: x.no } })}>
          <span class="cn">{x.no}. {x.title}</span>
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
    background: var(--surface);
  }
  .chs {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 70px 40px;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    padding: 4px 0;
    text-align: left;
  }
  .cn {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .track {
    height: 5px;
    border-radius: 3px;
    background: var(--fill-strong);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--accent);
    transform-origin: left;
  }
  .cr {
    text-align: right;
    color: var(--text2);
    font-variant-numeric: tabular-nums;
  }
</style>
