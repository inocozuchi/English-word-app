<script lang="ts">
  // 表現の解説: チャンク（元の形・バッジ）、意味、例文と訳、補足、音声変化モードへのリンク
  import type { Entry } from '../types.ts';
  import Badges from './Badges.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { loadSound } from '../../sound/state.svelte.ts';

  // show*: 問題文としてすでに画面にあるもの（①のチャンク、②の意味、③の例文）は解説で繰り返さない
  let {
    entry,
    showChunk = true,
    showMeaning = true,
    showExample = true,
    large = false,
  }: { entry: Entry; showChunk?: boolean; showMeaning?: boolean; showExample?: boolean; large?: boolean } = $props();
  const hasBadges = $derived(entry.region.length + entry.style.length > 0);

  /** 例文の中のチャンク部分を強調する */
  const exParts = $derived.by(() => {
    const a = entry.blank?.answer;
    const i = a ? entry.ex.toLowerCase().indexOf(a.toLowerCase()) : -1;
    if (!a || i < 0) return [{ t: entry.ex, hit: false }];
    return [
      { t: entry.ex.slice(0, i), hit: false },
      { t: entry.ex.slice(i, i + a.length), hit: true },
      { t: entry.ex.slice(i + a.length), hit: false },
    ];
  });

  async function openSound(no: number) {
    await loadSound();
    router.push({ name: 'sound/lecture', params: { no } });
  }
</script>

{#if showChunk}
  <div class="head">
    <span class="chunk en" class:large>{entry.chunk}</span><Badges {entry} />
  </div>
{:else if hasBadges}
  <div class="head"><Badges {entry} /></div>
{/if}
{#if entry.gloss}<p class="gloss en">= {entry.gloss}</p>{/if}
{#if showMeaning}<p class="meaning">{entry.meaning}</p>{/if}
{#if showExample}
  <div class="ex">
    <p class="en">{#each exParts as p}{#if p.hit}<b>{p.t}</b>{:else}{p.t}{/if}{/each}</p>
    <p class="ja">{entry.exJa}</p>
  </div>
{/if}
{#if entry.note}<p class="note">{entry.note}</p>{/if}
{#if entry.crossRef?.mode === 'sound'}
  <button class="xref" onclick={() => openSound(entry.crossRef!.lecture)}>聞こえ方は音声変化モードの第{entry.crossRef.lecture}講 ›</button>
{/if}

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px;
  }
  .chunk {
    font-size: 24px;
    font-weight: 750;
    letter-spacing: -0.02em;
    line-height: 1.25;
    margin-right: 4px;
  }
  .chunk.large {
    font-size: 30px;
  }
  .gloss {
    font-size: 14px;
    color: var(--text2);
  }
  .meaning {
    font-size: 18px;
    font-weight: 700;
  }
  .ex {
    padding-left: 12px;
    border-left: 2px solid var(--line);
  }
  .ex .en {
    font-size: 16px;
    line-height: 1.5;
  }
  .ex b {
    color: var(--accent);
    font-weight: 650;
  }
  .ex .ja {
    font-size: 14px;
    color: var(--text2);
  }
  .note {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text2);
  }
  .xref {
    align-self: flex-start;
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    text-align: left;
  }
</style>
