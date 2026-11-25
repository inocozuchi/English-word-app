<script lang="ts">
  // 変化の理由（1行ずつ。ルールはバッジで）
  import type { Change } from '../types.ts';
  import RuleBadge from './RuleBadge.svelte';
  let { changes, focus = -1 }: { changes: Change[]; focus?: number } = $props();
</script>

<ul class="why">
  {#each changes as c, k}
    <li class:focus={k === focus}>
      <RuleBadge rule={c.rule} />
      <span class="t"><span class="span en">{c.span}</span>{c.why}</span>
    </li>
  {/each}
</ul>

<style>
  .why {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 14px;
    line-height: 1.55;
    color: var(--text2);
  }
  li.focus {
    color: var(--text);
    font-weight: 600;
  }
  li :global(.badge) {
    margin-top: 1px;
  }
  .span {
    font-weight: 650;
    color: var(--text);
    margin-right: 6px;
  }
</style>
