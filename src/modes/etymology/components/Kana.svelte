<script lang="ts">
  import type { KanaVariant } from '../types.ts';
  // 強く読む部分（^…^）を太字＋アクセント色で表示
  let { kana }: { kana: KanaVariant[] } = $props();
</script>

<span class="kana">
  {#each kana as v, vi}
    {#if vi > 0}<span class="sep">／</span>{/if}
    {#each v.parts as p, i}{#if i % 2 === 1}<b>{p}</b>{:else}{p}{/if}{/each}
    {#if v.label}<span class="label">{v.label}</span>{/if}
  {/each}
</span>

<style>
  .kana {
    color: var(--text2);
    letter-spacing: 0.02em;
  }
  b {
    color: var(--accent);
    font-weight: 700;
  }
  .sep {
    margin: 0 0.3em;
    color: var(--text3);
  }
  .label {
    font-size: 0.72em;
    color: var(--text3);
    margin-left: 0.15em;
  }
</style>
