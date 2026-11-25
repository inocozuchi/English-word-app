<script lang="ts">
  // チャンク辞典: 章ごと・優先度ごとの一覧、検索（英語・日本語）、使い分け（pairs）の比較
  import Page from '../../../components/Page.svelte';
  import Icon from '../../../components/Icon.svelte';
  import Segmented from '../../../components/Segmented.svelte';
  import Badges from '../components/Badges.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { store } from '../../../core/store.svelte.ts';
  import { chk, loadChunks } from '../state.svelte.ts';
  import { isMastered } from '../quiz.ts';
  import { PRIORITIES, type Entry } from '../types.ts';

  let { tab: initial = 'section' }: { tab?: 'section' | 'priority' | 'pairs' } = $props();
  loadChunks();
  // svelte-ignore state_referenced_locally
  let tab = $state(initial);
  let q = $state('');
  const ix = $derived(chk.index);

  const results = $derived.by(() => {
    const s = q.trim().toLowerCase();
    if (!ix || !s) return null;
    const pre: Entry[] = [], mid: Entry[] = [], ja: Entry[] = [];
    for (const e of ix.d.entries) {
      const en = `${e.chunk} ${e.bare}`.toLowerCase();
      if (en.startsWith(s)) pre.push(e);
      else if (en.includes(s) || e.ex.toLowerCase().includes(s)) mid.push(e);
      else if (e.meaning.includes(s) || e.exJa.includes(s) || e.note.includes(s)) ja.push(e);
    }
    return [...pre, ...mid, ...ja].slice(0, 80);
  });
  const done = (ids: Entry[]) => ids.filter((e) => isMastered(store.progress.items[e.id])).length;
</script>

<Page title="チャンク辞典">
  <p class="eyebrow-en">Chunks</p>
  <h1 class="ui-title">チャンク辞典</h1>
  <label class="search">
    <Icon name="search" size={18} />
    <input type="search" placeholder="英語・日本語で検索" bind:value={q} autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" />
  </label>

  {#if !ix}
    <p class="none">読み込み中…</p>
  {:else if results}
    {#if results.length}
      <ul class="ui-group list">
        {#each results as e}
          <li><button class="row press" onclick={() => router.push({ name: 'chunks/entry', params: { id: e.id } })}>
            <span class="main"><span class="en b">{e.bare}<Badges entry={e} /></span><span class="s">{e.meaning}</span></span>
            <span class="chev"><Icon name="chevron" size={18} /></span>
          </button></li>
        {/each}
      </ul>
    {:else}
      <p class="none">見つかりませんでした</p>
    {/if}
  {:else}
    <div class="seg">
      <Segmented options={[{ value: 'section', label: '章' }, { value: 'priority', label: '優先度' }, { value: 'pairs', label: '使い分け' }]} value={tab} onchange={(v) => (tab = v)} />
    </div>
    {#if tab === 'section'}
      <ul class="ui-group list">
        {#each ix.d.sections as s}
          {@const es = ix.d.entries.filter((e) => e.section === s.no)}
          <li><button class="row press" onclick={() => router.push({ name: 'chunks/list', params: { section: s.no } })}>
            <span class="no en">{s.no}</span>
            <span class="main"><span class="t">{s.title}</span><span class="meta">{s.count}表現{#if done(es)} · <span class="acc">習得 {done(es)}</span>{/if}</span></span>
            <span class="chev"><Icon name="chevron" size={18} /></span>
          </button></li>
        {/each}
      </ul>
    {:else if tab === 'priority'}
      <ul class="ui-group list">
        {#each PRIORITIES as p}
          {@const es = ix.d.entries.filter((e) => e.priority === p)}
          <li><button class="row press" onclick={() => router.push({ name: 'chunks/list', params: { priority: p } })}>
            <span class="no en pr">{p}</span>
            <span class="main"><span class="t">{ix.d.priorities[p]}</span><span class="meta">{es.length}表現{#if done(es)} · <span class="acc">習得 {done(es)}</span>{/if}</span></span>
            <span class="chev"><Icon name="chevron" size={18} /></span>
          </button></li>
        {/each}
      </ul>
    {:else}
      <p class="lead">間違えやすい2つの表現を並べて比べます。</p>
      <div class="pairs">
        {#each ix.d.pairs as p}
          <div class="pair">
            {#each [p.a, p.b] as side, k}
              <div class="side">
                <span class="lab en">{k === 0 ? 'A' : 'B'}</span>
                <p class="en pen">{side.en}</p>
                <p class="pja">{side.ja}</p>
                {#if p.refs[k]}<button class="ref" onclick={() => { const e = ix.byNum.get(p.refs[k]!); if (e) router.push({ name: 'chunks/entry', params: { id: e.id } }); }}>例文を見る ›</button>{/if}
              </div>
            {/each}
            {#if p.note}<p class="pnote">{p.note}</p>{/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</Page>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 14px;
    border-radius: 12px;
    background: var(--fill);
    color: var(--text3);
    margin: 10px 0 14px;
  }
  .search input {
    flex: 1;
    border: 0;
    outline: 0;
    background: none;
    font-size: 16px;
    color: var(--text);
    min-width: 0;
    -webkit-appearance: none;
    appearance: none;
  }
  .seg {
    margin-bottom: 16px;
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
    gap: 12px;
    min-height: 56px;
    padding: 10px 12px 10px 16px;
    text-align: left;
  }
  .no {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 15px;
    background: var(--fill-strong);
    display: grid;
    place-items: center;
    font-size: 14px;
    font-weight: 700;
    color: var(--text2);
  }
  .no.pr {
    border-radius: 8px;
    background: none;
    border: 2px solid var(--ink);
    color: var(--text);
    font-weight: 800;
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
  .t {
    font-size: 15px;
    font-weight: 600;
  }
  .s,
  .meta {
    font-size: 12px;
    color: var(--text2);
  }
  .acc {
    color: var(--accent);
  }
  .chev {
    flex: none;
    color: var(--text3);
    display: grid;
  }
  .none,
  .lead {
    color: var(--text2);
    font-size: 14px;
  }
  .none {
    text-align: center;
    padding: 40px 0;
    color: var(--text3);
  }
  .lead {
    margin-bottom: 12px;
  }
  .pairs {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 10px;
    border-radius: var(--radius-lg);
    background: var(--surface);
  }
  .side {
    position: relative;
    padding: 10px 12px 10px;
    border-radius: var(--radius);
    background: var(--bg);
    min-width: 0;
  }
  .lab {
    font-size: 10px;
    font-weight: 800;
    color: var(--text3);
  }
  .pen {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .pja {
    font-size: 12px;
    color: var(--text2);
    margin-top: 2px;
  }
  .ref {
    margin-top: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
  }
  .pnote {
    grid-column: 1 / -1;
    font-size: 12px;
    color: var(--text2);
    line-height: 1.6;
    padding: 0 4px;
  }
</style>
