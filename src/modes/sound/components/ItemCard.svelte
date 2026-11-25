<script lang="ts">
  // 1フレーズ分のカード（復習ノート・結果画面で使う）。
  // マーキング付きの英文、学校読みと実際の聞こえ方の比較、変化の理由、文脈（ctx）・補足（note）・別の聞こえ方（alt）
  import type { Item } from '../types.ts';
  import Marked from './Marked.svelte';
  import WhyList from './WhyList.svelte';
  let { item, compact = false, onopen }: { item: Item; compact?: boolean; onopen?: () => void } = $props();
</script>

<div class="card" class:compact>
  <div class="head">
    {#if onopen}
      <button class="text press" onclick={onopen}><Marked words={item.words} marks={item.marks} size="sm" /></button>
    {:else}
      <p class="text"><Marked words={item.words} marks={item.marks} size={item.text.length > 30 ? 'sm' : 'md'} /></p>
    {/if}
    {#if item.source === 'supplement'}<span class="sup">補足例</span>{/if}
  </div>
  <dl class="cmp">
    <dt>学校読み</dt>
    <dd class="plain">{item.plain}</dd>
    <dt>聞こえ方</dt>
    <dd class="kana">{item.kana}{#if item.alt}<span class="alt">／別の聞こえ方 {item.alt}</span>{/if}</dd>
  </dl>
  {#if !compact}
    <p class="ja">{item.ja}</p>
    <WhyList changes={item.changes} />
    {#if item.ctx}<p class="extra"><span>文脈</span><span class="en">{item.ctx}</span></p>{/if}
    {#if item.note}<p class="extra"><span>補足</span>{item.note}</p>{/if}
  {/if}
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    border-radius: var(--radius-lg);
    background: var(--surface);
  }
  .card.compact {
    gap: 6px;
  }
  .head {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .text {
    flex: 1;
    min-width: 0;
    text-align: left;
  }
  .sup {
    flex: none;
    font-size: 10px;
    font-weight: 700;
    color: var(--text2);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 0 5px;
    margin-top: 6px;
  }
  .cmp {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    margin: 0;
    font-size: 14px;
    align-items: baseline;
  }
  dt {
    font-size: 11px;
    font-weight: 700;
    color: var(--text3);
  }
  dd {
    margin: 0;
  }
  .plain {
    color: var(--text2);
  }
  .kana {
    font-weight: 750;
    color: var(--accent);
    letter-spacing: 0.03em;
  }
  .alt {
    font-weight: 500;
    color: var(--text2);
    margin-left: 6px;
    font-size: 12px;
  }
  .ja {
    font-size: 13px;
    color: var(--text2);
  }
  .extra {
    display: flex;
    gap: 8px;
    font-size: 13px;
    color: var(--text2);
    line-height: 1.55;
  }
  .extra span:first-child {
    flex: none;
    font-size: 11px;
    font-weight: 700;
    color: var(--text3);
    margin-top: 2px;
  }
</style>
