<script lang="ts">
  import { ety, loadEty } from '../state.svelte.ts';
  import Page from '../../../components/Page.svelte';
  import Icon from '../../../components/Icon.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { store } from '../../../core/store.svelte.ts';
  import { wordStatus } from '../summary.ts';
  import type { Word, Root } from '../types.ts';

  loadEty();
  let q = $state('');
  const ix = $derived(ety.index);

  // 検索: 英単語（前方一致を優先）・日本語の意味・語源
  const results = $derived.by(() => {
    const s = q.trim().toLowerCase();
    if (!ix || !s) return null;
    const roots: Root[] = ix.ds.roots.filter(
      (r) => r.root.toLowerCase().includes(s) || r.meaning.includes(s) || r.meaningEn.toLowerCase().includes(s),
    );
    const pre: Word[] = [], mid: Word[] = [], ja: Word[] = [];
    for (const w of ix.ds.words) {
      const t = w.w.toLowerCase();
      if (t.startsWith(s)) pre.push(w);
      else if (t.includes(s) || w.derivatives.some((d) => d.word.toLowerCase().startsWith(s))) mid.push(w);
      else if (w.defs.some((d) => d.ja.includes(s))) ja.push(w);
    }
    return { roots: roots.slice(0, 20), words: [...pre, ...mid, ...ja].slice(0, 60) };
  });

  function chapterStats(no: number) {
    if (!ix) return { words: 0, learned: 0, roots: 0 };
    const ws = ix.wordsByChapter.get(no)!;
    const learned = ws.filter((w) => wordStatus(store.progress.items, w) === 'learned').length;
    return { words: ws.length, learned, roots: ix.rootsByChapter.get(no)!.length };
  }
</script>

<Page title="単語帳">
  <p class="eyebrow-en">Wordbook</p>
  <h1 class="title">単語帳</h1>
  <label class="search">
    <Icon name="search" size={18} />
    <input type="search" placeholder="単語・意味・語源で検索" bind:value={q} autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" />
  </label>

  {#if !ix}
    <p class="loading">読み込み中…</p>
  {:else if results}
    {#if results.roots.length}
      <h2>語源</h2>
      <ul class="group">
        {#each results.roots as r}
          <li><button class="row press" onclick={() => router.push({ name: 'ety/root', params: { id: r.id } })}>
            <span class="en strong">{r.root}</span><span class="sub">{r.meaning}</span><span class="chev"><Icon name="chevron" size={18} /></span>
          </button></li>
        {/each}
      </ul>
    {/if}
    <h2>単語 {#if results.words.length}<span class="n">{results.words.length}</span>{/if}</h2>
    {#if results.words.length}
      <ul class="group">
        {#each results.words as w}
          <li><button class="row press" onclick={() => router.push({ name: 'ety/word', params: { w: w.w } })}>
            <span class="en strong">{w.w}</span><span class="sub ell">{w.defs[0]?.ja}</span><span class="chev"><Icon name="chevron" size={18} /></span>
          </button></li>
        {/each}
      </ul>
    {:else}
      <p class="none">見つかりませんでした</p>
    {/if}
  {:else}
    <ul class="group">
      {#each ix.ds.chapters as c}
        {@const st = chapterStats(c.no)}
        <li><button class="row tall press" onclick={() => router.push({ name: 'ety/chapter', params: { no: c.no } })}>
          <span class="no en">{c.no}</span>
          <span class="main">
            <span class="ct">{c.title}</span>
            <span class="meta">{st.roots}語源 · {st.words}語{#if st.learned} · <span class="acc">覚えた {st.learned}</span>{/if}</span>
          </span>
          <span class="chev"><Icon name="chevron" size={18} /></span>
        </button></li>
      {/each}
      {#each ix.ds.groups as g}
        <li><button class="row tall press" onclick={() => router.push({ name: 'ety/group', params: { id: g.id } })}>
          <span class="no">他</span>
          <span class="main"><span class="ct">{g.title}</span><span class="meta">{g.words.length}語</span></span>
          <span class="chev"><Icon name="chevron" size={18} /></span>
        </button></li>
      {/each}
    </ul>
  {/if}
</Page>

<style>
  .title {
    font-size: 32px;
    font-weight: 750;
    letter-spacing: 0.01em;
    margin: 4px 0 14px;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 14px;
    border-radius: 12px;
    background: var(--fill);
    color: var(--text3);
    margin-bottom: 20px;
  }
  .search input {
    flex: 1;
    border: 0;
    outline: 0;
    background: none;
    font-size: 16px; /* 16px 未満だと iOS がフォーカス時に拡大する */
    color: var(--text);
    min-width: 0;
    -webkit-appearance: none;
    appearance: none;
  }
  .search input::placeholder {
    color: var(--text3);
  }
  h2 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
    margin: 18px 6px 8px;
  }
  .n {
    color: var(--text3);
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
    min-height: 52px;
    padding: 10px 12px 10px 18px;
    text-align: left;
  }
  .row.tall {
    min-height: 64px;
  }
  .strong {
    font-weight: 600;
    font-size: 18px;
  }
  .sub {
    flex: 1;
    font-size: 14px;
    color: var(--text2);
    min-width: 0;
  }
  .ell {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    font-weight: 650;
    color: var(--text2);
  }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .ct {
    font-size: 16px;
    font-weight: 600;
  }
  .meta {
    font-size: 12px;
    color: var(--text3);
  }
  .acc {
    color: var(--accent);
  }
  .chev {
    flex: none;
    color: var(--text3);
    display: grid;
  }
  .loading,
  .none {
    color: var(--text3);
    text-align: center;
    padding: 40px 0;
    font-size: 14px;
  }
</style>
