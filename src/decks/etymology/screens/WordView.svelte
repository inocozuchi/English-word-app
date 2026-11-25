<script lang="ts">
  import { ety } from '../state.svelte.ts';
  import Page from '../../../components/Page.svelte';
  import Kana from '../components/Kana.svelte';
  import Breakdown from '../components/Breakdown.svelte';
  import Example from '../../../components/Example.svelte';
  import Icon from '../../../components/Icon.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { store } from '../../../core/store.svelte.ts';
  import { wordStatus, STATUS_LABEL } from '../summary.ts';
  import { dayKey } from '../../../core/day.ts';

  let { w: text }: { w: string } = $props();
  const ix = ety.index!;
  const w = $derived(ix.word.get(text)!);
  const st = $derived(wordStatus(store.progress.items, w));
  const ej = $derived(store.progress.items['ej:' + w.w]);
  const je = $derived(store.progress.items['je:' + w.w]);
  const tries = $derived((ej?.seen ?? 0) + (je?.seen ?? 0));
  const oks = $derived((ej?.correct ?? 0) + (je?.correct ?? 0));
  const nextDue = $derived([ej, je].filter(Boolean).map((s) => s!.due).sort((a, b) => a - b)[0]);
</script>

<Page title={w.w}>
  <p class="eyebrow-en">Word</p>
  <div class="top">
    <h1 class="en w">{w.w}</h1>
    <span class="badge {st}">{STATUS_LABEL[st]}</span>
  </div>
  <p class="kana"><Kana kana={w.kana} /></p>

  <ul class="defs">
    {#each w.defs as d}<li><span class="pos">{d.pos}</span>{d.ja}</li>{/each}
  </ul>

  {#if w.breakdown.length}
    <h2>語源の分解</h2>
    <Breakdown parts={w.breakdown} core={w.core} />
  {/if}

  {#if w.examples.length}
    <h2>例文</h2>
    <div class="exs">
      {#each w.examples as ex}<Example {ex} word={w.w} />{/each}
    </div>
  {/if}

  {#if w.derivatives.length}
    <h2>派生語</h2>
    <ul class="derivs">
      {#each w.derivatives as d}
        <li><span class="en dw">{d.word}</span><span class="dpos">{d.pos}</span><span class="dja">{d.ja}</span></li>
      {/each}
    </ul>
  {/if}

  {#if w.note}<p class="note">{w.note}</p>{/if}

  {#if w.refIn.length}
    <p class="note">
      {w.refIn.map((id) => ix.root.get(id)!.root).join('、')} の項目には覚え方として併記されています（語源的には別系統）。
    </p>
  {/if}

  <h2>語源</h2>
  <ul class="group">
    {#each w.roots as rid}
      {@const r = ix.root.get(rid)!}
      <li><button class="row press" onclick={() => router.push({ name: 'ety/root', params: { id: rid } })}>
        <span class="en rr">{r.root}</span><span class="rm">{r.meaning}</span><span class="chev"><Icon name="chevron" size={18} /></span>
      </button></li>
    {/each}
  </ul>

  {#if tries}
    <h2>学習</h2>
    <p class="learn">{tries}回出題 · 正解 {oks}回{#if nextDue !== undefined} · 次の復習 {nextDue <= store.today ? '今日' : dayKey(nextDue).slice(5).replace('-', '/')}{/if}</p>
  {/if}
</Page>

<style>
  .top {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
    flex-wrap: wrap;
  }
  .w {
    font-size: 40px;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.15;
  }
  .badge {
    font-size: 12px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--fill);
    color: var(--text2);
  }
  .badge.learning {
    color: var(--accent);
    background: var(--accent-soft);
  }
  .badge.learned {
    color: var(--on-accent);
    background: var(--accent);
  }
  .kana {
    font-size: 18px;
    margin-top: 4px;
  }
  .defs {
    list-style: none;
    margin: 18px 0 0;
    padding: 0;
    font-size: 20px;
    font-weight: 600;
    line-height: 1.5;
  }
  .pos {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    color: var(--text2);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0 5px;
    margin-right: 8px;
    vertical-align: 0.25em;
    line-height: 1.6;
  }
  h2 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
    margin: 28px 2px 10px;
  }
  .exs {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .derivs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .derivs li {
    display: flex;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .dw {
    font-size: 17px;
    font-weight: 600;
  }
  .dpos {
    font-size: 11px;
    color: var(--text3);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0 4px;
  }
  .dja {
    font-size: 15px;
    color: var(--text2);
  }
  .note {
    margin-top: 16px;
    font-size: 13px;
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
    align-items: baseline;
    gap: 10px;
    min-height: 52px;
    padding: 14px 12px 14px 18px;
    text-align: left;
  }
  .rr {
    font-weight: 650;
    font-size: 18px;
  }
  .rm {
    flex: 1;
    font-size: 15px;
    color: var(--text2);
  }
  .chev {
    color: var(--text3);
    align-self: center;
    display: grid;
  }
  .learn {
    font-size: 14px;
    color: var(--text2);
  }
</style>
