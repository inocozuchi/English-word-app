<script lang="ts">
  import { ety } from '../state.svelte.ts';
  import Page from '../../../components/Page.svelte';
  import Icon from '../../../components/Icon.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { store } from '../../../core/store.svelte.ts';
  import { wordStatus } from '../summary.ts';

  let { no }: { no: number } = $props();
  const ix = ety.index!;
  const ch = $derived(ix.ds.chapters.find((c) => c.no === no)!);
  const roots = $derived(ix.rootsByChapter.get(no)!);
  const learned = (ids: number[]) => ids.filter((id) => wordStatus(store.progress.items, ix.ds.words[id]) === 'learned').length;
</script>

<Page title={ch.title}>
  <p class="eyebrow-en">Chapter {String(ch.no).padStart(2, '0')}</p>
  <h1 class="title">{ch.title}</h1>
  <ul class="group">
    {#each roots as r}
      {@const n = learned(r.words)}
      <li>
        <button class="row press" onclick={() => router.push({ name: 'ety/root', params: { id: r.id } })}>
          <span class="main">
            <span class="line"><span class="en root">{r.root}</span><span class="m">{r.meaning}</span></span>
            <span class="meta">{r.category} · {r.words.length}語{#if n} · <span class="acc">覚えた {n}</span>{/if}</span>
          </span>
          <span class="bar" style:--p={n / r.words.length}></span>
          <span class="chev"><Icon name="chevron" size={18} /></span>
        </button>
      </li>
    {/each}
  </ul>
</Page>

<style>
  .title {
    font-size: 28px;
    font-weight: 750;
    margin: 2px 0 18px;
    line-height: 1.3;
  }
  .group {
    list-style: none;
    margin: 0;
    padding: 0;
    border-radius: var(--radius-lg);
    background: var(--surface);
    overflow: hidden;
  }
  .group li + li {
    border-top: 0.5px solid var(--line);
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 10px 12px 10px 18px;
    text-align: left;
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .line {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }
  .root {
    font-size: 19px;
    font-weight: 650;
  }
  .m {
    font-size: 15px;
  }
  .meta {
    font-size: 12px;
    color: var(--text3);
  }
  .acc {
    color: var(--accent);
  }
  .bar {
    flex: none;
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right, var(--accent) calc(var(--p) * 100%), var(--fill-strong) 0);
  }
  .chev {
    color: var(--text3);
    display: grid;
  }
</style>
