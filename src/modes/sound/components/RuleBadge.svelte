<script lang="ts">
  // ルール名の小さなバッジ（ルール色）
  import { snd, ruleColor } from '../state.svelte.ts';
  let { rule, size = 'sm' }: { rule: string; size?: 'sm' | 'md' } = $props();
  const r = $derived(snd.index?.rule.get(rule as any));
</script>

<span class="badge {size}" style:--c={ruleColor(rule)}>{r?.name ?? rule}</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    flex: none;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.6;
    color: var(--c);
    border: 1.5px solid var(--c);
    background: color-mix(in srgb, var(--c) 10%, transparent);
    white-space: nowrap;
  }
  .md {
    font-size: 13px;
    padding: 2px 10px;
  }
</style>
