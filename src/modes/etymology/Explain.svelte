<script lang="ts">
  // 語源デッキの解説（回答後、問題のエリアに出る）
  import Kana from './components/Kana.svelte';
  import Breakdown from './components/Breakdown.svelte';
  import Example from '../../components/Example.svelte';
  import { ety } from './state.svelte.ts';
  import type { Question } from './quiz.ts';
  let { q }: { q: Question } = $props();
  const s = $derived(q.data);
</script>

{#if s.kind === 'word'}
  {@const w = s.word}
  <div class="head">
    <span class="hw en" class:long={w.w.length > 12}>{w.w}</span>
    <Kana kana={w.kana} />
  </div>
  <ul class="defs">
    {#each w.defs as d}<li><span class="pos">{d.pos}</span>{d.ja}</li>{/each}
  </ul>
  <Breakdown parts={w.breakdown} core={w.core} animate />
  {#if w.examples[0]}<Example ex={w.examples[0]} word={w.w} />{/if}
{:else if s.kind === 'root'}
  {@const r = s.root}
  <div class="head">
    <span class="hw en">{r.root}</span>
    <span class="meaning">{r.meaning}<span class="en sub">{r.meaningEn}</span></span>
  </div>
  {#if r.memo}<p class="memo">{r.memo}</p>{/if}
  <ul class="mini">
    {#each r.words.filter((id) => !r.refs.includes(id)).slice(0, 4) as id}
      {@const w = ety.index!.ds.words[id]}
      <li><span class="en">{w.w}</span><span class="mj">{w.defs[0]?.ja}</span></li>
    {/each}
  </ul>
{:else}
  {@const p = s.phrase}
  <div class="head"><span class="hw en ph">{p.en}</span></div>
  <p class="phrase-ja">{p.ja}</p>
  {#if p.examples[0]}<Example ex={p.examples[0]} word={p.en} />{/if}
{/if}

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    flex: none;
  }
  .hw {
    font-size: 32px;
    font-weight: 750;
    letter-spacing: -0.025em;
    line-height: 1.15;
  }
  .hw.long {
    font-size: 26px;
  }
  .hw.ph {
    font-size: 24px;
  }
  .meaning {
    font-size: 20px;
    font-weight: 700;
  }
  .meaning .sub {
    margin-left: 8px;
    font-size: 15px;
    color: var(--text2);
    font-weight: 400;
  }
  .defs {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 18px;
    font-weight: 700;
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: none;
  }
  .pos {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    color: var(--text2);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    padding: 0 5px;
    margin-right: 8px;
    vertical-align: 0.15em;
    line-height: 1.6;
  }
  .memo {
    font-size: 15px;
    line-height: 1.6;
    color: var(--text2);
  }
  .mini {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mini li {
    display: flex;
    gap: 12px;
    align-items: baseline;
  }
  .mini .en {
    font-weight: 650;
    flex: none;
    width: 7.2em;
    overflow-wrap: anywhere;
  }
  .mini .mj {
    font-size: 14px;
    color: var(--text2);
  }
  .phrase-ja {
    font-size: 18px;
    font-weight: 700;
  }
</style>
