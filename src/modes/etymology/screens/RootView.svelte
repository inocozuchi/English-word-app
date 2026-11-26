<script lang="ts">
  import { ety } from '../state.svelte.ts';
  import Page from '../../../components/Page.svelte';
  import Kana from '../components/Kana.svelte';
  import Example from '../../../components/Example.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { store } from '../../../core/store.svelte.ts';
  import { wordStatus } from '../summary.ts';

  let { id }: { id: string } = $props();
  const ix = ety.index!;
  const r = $derived(ix.root.get(id)!);
  const ch = $derived(ix.ds.chapters.find((c) => c.no === r.chapter)!);
  const words = $derived(r.words.map((i) => ix.ds.words[i]));
  const phrases = $derived(r.phrases.map((i) => ix.ds.phrases[i]));
  // 単語の breakdown のうち、この語源に当たる部分以外（接頭辞など）を枝のラベルにする
  const rootParts = $derived(new Set(r.root.split('/').map((s) => s.trim().toLowerCase())));
  function affix(w: (typeof words)[number]) {
    return w.breakdown.filter((p) => !rootParts.has(p.part.toLowerCase())).map((p) => p.part).join(' + ');
  }
</script>

<Page title={r.root}>
  <p class="eyebrow-en">{r.category === '接頭辞' ? 'Prefix' : 'Root'}</p>
  <p class="eyebrow">{ch.no}章 {ch.title} · {r.category}</p>
  <h1 class="root en">{r.root}</h1>
  <p class="meaning">{r.meaning}{#if r.meaningEn}<span class="en mEn">{r.meaningEn}</span>{/if}</p>

  {#if r.intro}<p class="intro">{r.intro}</p>{/if}
  {#if r.memo}
    <div class="memo">
      <span class="memo-label">メモ</span>
      <p>{r.memo}</p>
    </div>
  {/if}
  {#if r.note}<p class="note">{r.note}</p>{/if}

  <h2>単語ツリー</h2>
  <div class="tree">
    <div class="trunk">
      <span class="node"></span><span class="en tr">{r.root}</span><span class="tm">{r.meaning}</span>
    </div>
    <ul>
      {#each words as w}
        {@const st = wordStatus(store.progress.items, w)}
        {@const isRef = r.refs.includes(w.id)}
        <li class:ref={isRef}>
          <button class="branch press" onclick={() => router.push({ name: 'ety/word', params: { w: w.w } })}>
            <span class="bw">
              <span class="en w">{w.w}</span>
              {#if affix(w)}<span class="affix en">{affix(w)}</span>{/if}
              <span class="st {st}" aria-label={st}></span>
            </span>
            {#if isRef}<span class="refnote">覚え方として併記（語源は別系統）</span>{/if}
            <span class="kana"><Kana kana={w.kana} /></span>
            <span class="def">{w.defs.map((d) => d.ja).join('／')}</span>
          </button>
          {#if w.derivatives.length}
            <ul class="derivs">
              {#each w.derivatives as d}
                <li><span class="en dw">{d.word}</span><span class="dpos">{d.pos}</span><span class="dja">{d.ja}</span></li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  </div>

  {#if phrases.length}
    <h2>熟語</h2>
    <ul class="phrases">
      {#each phrases as p}
        <li>
          <p class="en pen">{p.en}</p>
          <p class="pja">{p.ja}</p>
          {#if p.examples[0]}<div class="pex"><Example ex={p.examples[0]} word={p.en} /></div>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</Page>

<style>
  .eyebrow {
    font-size: 12px;
    color: var(--text3);
    margin-top: 4px;
  }
  .root {
    font-size: 40px;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.15;
    margin-top: 4px;
  }
  .meaning {
    font-size: 20px;
    font-weight: 600;
    margin-top: 4px;
  }
  .mEn {
    font-size: 15px;
    font-weight: 400;
    color: var(--text2);
    margin-left: 10px;
  }
  .intro {
    margin-top: 16px;
    font-size: 15px;
    line-height: 1.75;
    color: var(--text2);
  }
  .memo {
    margin-top: 16px;
    padding: 14px 16px;
    border-radius: var(--radius);
    border: var(--frame) solid var(--ink);
  }
  .memo-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.06em;
  }
  .memo p {
    margin-top: 2px;
    font-size: 15px;
    line-height: 1.7;
  }
  .note {
    margin-top: 12px;
    font-size: 13px;
    color: var(--text3);
    line-height: 1.6;
  }
  h2 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
    margin: 28px 2px 12px;
  }

  /* 語源 → 単語 → 派生語 のツリー（左の縦線から枝が伸びる） */
  .tree {
    --x: 9px;
  }
  .trunk {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .node {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-soft);
  }
  .tr {
    font-weight: 700;
    font-size: 18px;
  }
  .tm {
    font-size: 14px;
    color: var(--text2);
  }
  .tree > ul {
    list-style: none;
    margin: 0 0 0 var(--x);
    padding: 6px 0 0;
    position: relative;
  }
  .tree > ul::before {
    /* 幹と最初の枝をつなぐ */
    content: '';
    position: absolute;
    left: 0;
    top: -4px;
    height: 10px;
    width: 2px;
    background: var(--line);
  }
  .tree > ul > li {
    position: relative;
    padding: 6px 0 6px 22px;
  }
  .tree > ul > li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 30px;
    width: 16px;
    height: 2px;
    background: var(--line);
  }
  /* 幹（縦線）は各枝ごとに描き、最後の枝では枝分かれの位置で止める */
  .tree > ul > li::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--line);
  }
  .tree > ul > li:last-child::after {
    bottom: auto;
    height: 32px;
  }
  .branch {
    width: 100%;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 10px 14px;
    border-radius: var(--radius);
    background: var(--panel-bg);
    border: var(--card-border);
  }
  .bw {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .w {
    font-size: 19px;
    font-weight: 650;
  }
  .affix {
    font-size: 12px;
    color: var(--text3);
  }
  .st {
    margin-left: auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    align-self: center;
    background: transparent;
    border: 1.5px solid var(--text3);
  }
  .st.learning {
    border-color: var(--accent);
  }
  .st.learned {
    background: var(--accent);
    border-color: var(--accent);
  }
  .kana {
    font-size: 13px;
  }
  .refnote {
    font-size: 11px;
    font-weight: 600;
    color: var(--text3);
  }
  li.ref .branch {
    background: transparent;
    border: 1.5px dashed var(--line-strong);
  }
  .def {
    font-size: 15px;
  }
  .derivs {
    list-style: none;
    margin: 4px 0 0 14px;
    padding: 0 0 0 14px;
    border-left: 1.5px dashed var(--line);
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .derivs li {
    font-size: 13px;
    display: flex;
    gap: 6px;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .dw {
    font-size: 15px;
    font-weight: 550;
  }
  .dpos {
    font-size: 10px;
    color: var(--text3);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0 3px;
  }
  .dja {
    color: var(--text2);
  }
  .phrases {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .phrases li {
    padding: 14px 16px;
    border-radius: var(--radius);
    background: var(--panel-bg);
    border: var(--card-border);
  }
  .pen {
    font-size: 17px;
    font-weight: 600;
  }
  .pja {
    font-size: 15px;
    margin-top: 2px;
  }
  .pex {
    margin-top: 8px;
  }
</style>
