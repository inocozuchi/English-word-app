<script lang="ts" generics="T extends string | number">
  // セグメントコントロール（選択中の背景がスプリングで滑る）
  let { options, value, onchange }: { options: { value: T; label: string }[]; value: T; onchange: (v: T) => void } = $props();
  const idx = $derived(Math.max(0, options.findIndex((o) => o.value === value)));
</script>

<div class="seg" style:--n={options.length} style:--i={idx}>
  <span class="thumb"></span>
  {#each options as o}
    <button class:sel={o.value === value} onclick={() => onchange(o.value)}>{o.label}</button>
  {/each}
</div>

<style>
  .seg {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--n), 1fr);
    padding: 3px;
    border-radius: 14px;
    border: 2px solid var(--ink);
    background: var(--bg);
  }
  .thumb {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: calc((100% - 6px) / var(--n));
    border-radius: 10px;
    background: var(--accent);
    transform: translateX(calc(100% * var(--i)));
    transition: transform var(--dur-card, 400ms) var(--ease-card, ease-out);
  }
  button {
    position: relative;
    height: 36px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text2);
    transition: color 0.2s;
  }
  button.sel {
    color: var(--on-accent);
    font-weight: 700;
  }
  button:active:not(.sel) {
    color: var(--text);
  }
</style>
