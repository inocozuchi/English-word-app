<script lang="ts">
  // 表現の詳細: 意味・例文・訳・補足・バッジ、似た意味の表現、使い分けの組
  import Page from '../../../components/Page.svelte';
  import EntryDetail from '../components/EntryDetail.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { store } from '../../../core/store.svelte.ts';
  import { chk } from '../state.svelte.ts';
  import { isMastered } from '../quiz.ts';
  import { dayKey } from '../../../core/day.ts';
  import AddToMine from '../../custom/AddToMine.svelte';

  let { id }: { id: string } = $props();
  const ix = $derived(chk.index!);
  const e = $derived(ix.byId.get(id)!);
  const sec = $derived(ix.section.get(e.section)!);
  const similar = $derived([...e.sameMeaning, ...e.similarMeaning].map((n) => ix.byNum.get(n)).filter((x) => !!x));
  const pairs = $derived(ix.d.pairs.filter((p) => p.refs.includes(e.num)));
  const st = $derived(store.progress.items[e.id]);
</script>

<Page title={e.bare}>
  <p class="eyebrow-en">Chunk · {e.priority}</p>
  <p class="where">第{e.section}章 {sec.title} · {ix.d.priorities[e.priority]}</p>
  <div class="card">
    <EntryDetail entry={e} large />
  </div>
  <div class="mine-row"><AddToMine en={e.bare} ja={e.meaning} ex={e.ex} /></div>

  {#if st}
    <p class="learn">
      {isMastered(st) ? '習得済み' : '学習中'} · {st.seen}回出題・正解 {st.correct}回 · 次の復習 {st.due <= store.today ? '今日' : dayKey(st.due).slice(5).replace('-', '/')}
    </p>
  {/if}

  {#if similar.length}
    <h2 class="ui-h2">意味が近い表現</h2>
    <ul class="ui-group list">
      {#each similar as x}
        <li><button class="row" onclick={() => router.push({ name: 'chunks/entry', params: { id: x!.id } })}>
          <span class="en b">{x!.bare}</span><span class="s">{x!.meaning}</span>
        </button></li>
      {/each}
    </ul>
  {/if}

  {#if pairs.length}
    <h2 class="ui-h2">使い分け</h2>
    {#each pairs as p}
      <div class="pair">
        <div class:me={p.refs[0] === e.num}><p class="en pen">{p.a.en}</p><p class="pja">{p.a.ja}</p></div>
        <div class:me={p.refs[1] === e.num}><p class="en pen">{p.b.en}</p><p class="pja">{p.b.ja}</p></div>
      </div>
    {/each}
  {/if}
</Page>

<style>
  .mine-row {
    margin-top: 10px;
    display: flex;
  }
  .where {
    font-size: 12px;
    color: var(--text3);
    margin: 4px 0 12px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    border-radius: var(--radius-lg);
    border: var(--frame) solid var(--ink);
  }
  .learn {
    margin-top: 12px;
    font-size: 13px;
    color: var(--text2);
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
    flex-direction: column;
    padding: 11px 16px;
    text-align: left;
  }
  .b {
    font-size: 15px;
    font-weight: 650;
  }
  .s {
    font-size: 12px;
    color: var(--text2);
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 8px;
  }
  .pair > div {
    padding: 10px 12px;
    border-radius: var(--radius);
    border: 2px solid var(--line-strong);
  }
  .pair > div.me {
    border-color: var(--accent);
  }
  .pen {
    font-size: 15px;
    font-weight: 700;
  }
  .pja {
    font-size: 12px;
    color: var(--text2);
  }
</style>
