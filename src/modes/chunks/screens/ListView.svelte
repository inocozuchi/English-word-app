<script lang="ts">
  // 章ごと・優先度ごとの表現一覧
  import Page from '../../../components/Page.svelte';
  import Icon from '../../../components/Icon.svelte';
  import Badges from '../components/Badges.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { store } from '../../../core/store.svelte.ts';
  import { chk } from '../state.svelte.ts';
  import { isMastered } from '../quiz.ts';
  import type { Priority } from '../types.ts';

  let { section, priority }: { section?: number; priority?: Priority } = $props();
  const ix = $derived(chk.index!);
  const list = $derived(ix.d.entries.filter((e) => (section ? e.section === section : e.priority === priority)));
  const title = $derived(section ? ix.section.get(section)!.title : `${priority} · ${ix.d.priorities[priority!]}`);
</script>

<Page {title}>
  <p class="eyebrow-en">{section ? `Chapter ${String(section).padStart(2, '0')}` : `Priority ${priority}`}</p>
  <h1 class="title">{title}</h1>
  <ul class="ui-group list">
    {#each list as e}
      {@const st = store.progress.items[e.id]}
      <li><button class="row press" onclick={() => router.push({ name: 'chunks/entry', params: { id: e.id } })}>
        <span class="main">
          <span class="en b">{e.chunk}<Badges entry={e} /></span>
          <span class="s">{e.meaning}</span>
        </span>
        <span class="pri en">{e.priority}</span>
        <span class="dot" class:learning={!!st && !isMastered(st)} class:done={isMastered(st)}></span>
        <span class="chev"><Icon name="chevron" size={18} /></span>
      </button></li>
    {/each}
  </ul>
</Page>

<style>
  .title {
    font-size: 26px;
    font-weight: 750;
    margin: 4px 0 16px;
    line-height: 1.3;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list li + li {
    border-top: 0.5px solid var(--line);
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 58px;
    padding: 10px 12px 10px 16px;
    text-align: left;
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .b {
    font-size: 16px;
    font-weight: 650;
  }
  .s {
    font-size: 13px;
    color: var(--text2);
  }
  .pri {
    font-size: 11px;
    font-weight: 800;
    color: var(--text3);
  }
  .dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--text3);
  }
  .dot.learning {
    border-color: var(--accent);
  }
  .dot.done {
    background: var(--accent);
    border-color: var(--accent);
  }
  .chev {
    flex: none;
    color: var(--text3);
    display: grid;
  }
</style>
