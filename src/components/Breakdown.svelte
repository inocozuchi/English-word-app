<script lang="ts">
  import type { Part } from '../lib/types.ts';
  // 語源の分解: [in 中に] + [volve 回る] → コアイメージ
  let { parts, core = null }: { parts: Part[]; core?: string | null } = $props();
</script>

{#if parts.length}
  <div class="bd">
    {#each parts as p, i}
      {#if i > 0}<span class="plus">+</span>{/if}
      <span class="chip"><span class="en part">{p.part}</span><span class="m">{p.meaning}</span></span>
    {/each}
    {#if core}<span class="plus">→</span><span class="core">{core}</span>{/if}
  </div>
{/if}

<style>
  .bd {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 12px 5px;
    border-radius: 12px;
    background: var(--fill);
    line-height: 1.2;
  }
  .part {
    font-weight: 650;
    font-size: 17px;
  }
  .m {
    font-size: 12px;
    color: var(--text2);
    margin-top: 2px;
  }
  .plus {
    color: var(--text3);
    font-size: 15px;
  }
  .core {
    font-size: 15px;
    font-weight: 600;
    color: var(--accent);
  }
</style>
