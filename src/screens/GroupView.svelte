<script lang="ts">
  import Page from '../components/Page.svelte';
  import Kana from '../components/Kana.svelte';
  import Example from '../components/Example.svelte';
  import { store } from '../lib/store.svelte.ts';

  let { id }: { id: string } = $props();
  const g = $derived(store.index!.ds.groups.find((x) => x.id === id)!);
</script>

<Page title={g.title}>
  <p class="eyebrow">その他（語源ではないグループ）</p>
  <h1 class="title">{g.title}</h1>
  <ul class="list">
    {#each g.words as w}
      <li>
        <p class="en w">{w.w}</p>
        <p class="kana"><Kana kana={w.kana} /></p>
        {#each w.defs as d}<p class="def"><span class="pos">{d.pos}</span>{d.ja}</p>{/each}
        {#each w.examples as ex}<div class="ex"><Example {ex} word={w.w} /></div>{/each}
      </li>
    {/each}
  </ul>
</Page>

<style>
  .eyebrow {
    font-size: 12px;
    color: var(--text3);
    margin-top: 4px;
  }
  .title {
    font-size: 28px;
    font-weight: 750;
    margin: 2px 0 18px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .list li {
    padding: 16px 18px;
    border-radius: var(--radius-lg);
    background: var(--surface);
  }
  .w {
    font-size: 22px;
    font-weight: 650;
  }
  .kana {
    font-size: 14px;
  }
  .def {
    margin-top: 8px;
    font-size: 15px;
    line-height: 1.6;
  }
  .pos {
    font-size: 11px;
    color: var(--text2);
    border: 1px solid var(--line);
    border-radius: 5px;
    padding: 0 4px;
    margin-right: 6px;
  }
  .ex {
    margin-top: 10px;
  }
</style>
