<script lang="ts" generics="T extends string | number">
  // 複数選択のチップ（空 = すべて）。color があれば選んだとき枠をその色にする
  let {
    items,
    selected,
    onchange,
  }: {
    items: { id: T; label: string; color?: string }[];
    selected: T[];
    onchange: (next: T[]) => void;
  } = $props();
  function toggle(id: T) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    // すべて選んだら「すべて（空）」に戻す
    onchange(next.length === items.length ? [] : items.map((x) => x.id).filter((x) => next.includes(x)));
  }
</script>

<div class="chips">
  <button class="chip press" class:on={!selected.length} aria-pressed={!selected.length} onclick={() => onchange([])}>すべて</button>
  {#each items as it}
    {@const on = selected.includes(it.id)}
    <button class="chip press" class:on aria-pressed={on} style:--c={it.color} onclick={() => toggle(it.id)}>
      {#if it.color}<span class="cd"></span>{/if}{it.label}
    </button>
  {/each}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 38px;
    padding: 0 13px;
    border-radius: 999px;
    border: 2px solid var(--line-strong);
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
    transition: border-color 0.2s, color 0.2s, background-color 0.2s;
  }
  .chip.on {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--bg);
  }
  .cd {
    width: 9px;
    height: 9px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--c) var(--part-mix), #fff);
  }
</style>
