<script lang="ts">
  // 自由英単語の問題文（英→日: 英単語 / 日→英: 意味）
  import type { CQuestion } from './quiz.ts';
  let { q }: { q: CQuestion; phase: 'ask' | 'reveal' } = $props();
  const w = $derived(q.data.word);
</script>

<div class="prompt">
  {#if q.pattern === 'ej'}
    <p class="ask">この英単語の意味は？</p>
    <h1 class="hw en" class:long={w.en.length > 12}>{w.en}</h1>
  {:else}
    <p class="ask">この意味の英単語は？</p>
    <h1 class="ja">{w.ja}</h1>
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
  .ask {
    font-size: 13px;
    font-weight: 600;
    color: var(--text3);
    letter-spacing: 0.04em;
  }
  .hw {
    font-size: 48px;
    font-weight: 750;
    line-height: 1.1;
    letter-spacing: -0.03em;
    overflow-wrap: anywhere;
  }
  .hw.long {
    font-size: 36px;
  }
  .ja {
    font-size: 28px;
    font-weight: 800;
    line-height: 1.4;
  }
</style>
