<script lang="ts">
  // 語源デッキの問題文
  import Kana from './components/Kana.svelte';
  import type { Question } from './quiz.ts';
  let { q }: { q: Question } = $props();
  const s = $derived(q.data);
</script>

<div class="prompt">
  {#if s.kind === 'word' && q.mode === 'ej'}
    <h1 class="headword en" class:long={s.word.w.length > 11}>{s.word.w}</h1>
    <p class="kana-line"><Kana kana={s.word.kana} /></p>
  {:else if s.kind === 'word'}
    <p class="ask">この意味の英単語は？</p>
    <h1 class="ja-prompt">
      {#each s.word.defs as d, di}
        {#if di === 0 || d.pos !== s.word.defs[0].pos}<span class="def"><span class="pos">{d.pos}</span>{d.ja}</span>{/if}
      {/each}
    </h1>
  {:else if s.kind === 'root'}
    <p class="ask">{s.root.category === '接頭辞' ? '接頭辞' : '語源'}の意味は？</p>
    <h1 class="headword en root" class:long={s.root.root.length > 11}>{s.root.root}</h1>
  {:else}
    <p class="ask">熟語の意味は？</p>
    <h1 class="phrase en">{s.phrase.en}</h1>
  {/if}
</div>

<style>
  .prompt {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 12px 0;
  }
  .headword {
    font-size: 48px;
    font-weight: 750;
    line-height: 1.1;
    letter-spacing: -0.03em;
    overflow-wrap: anywhere;
  }
  .headword.long {
    font-size: 38px;
  }
  .headword.root {
    font-size: 42px;
  }
  .kana-line {
    font-size: 18px;
  }
  .ask {
    font-size: 13px;
    font-weight: 600;
    color: var(--text3);
    letter-spacing: 0.04em;
  }
  .ja-prompt {
    font-size: 24px;
    font-weight: 700;
    line-height: 1.45;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .phrase {
    font-size: 30px;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: -0.02em;
  }
  .pos {
    display: inline-block;
    font-size: 0.55em;
    font-weight: 600;
    color: var(--text2);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    padding: 0 5px;
    margin-right: 8px;
    vertical-align: 0.3em;
    line-height: 1.6;
  }
</style>
