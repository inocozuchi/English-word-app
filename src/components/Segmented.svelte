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
    padding: 2px;
    border-radius: 10px;
    background: var(--fill);
  }
  .thumb {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 2px;
    width: calc((100% - 4px) / var(--n));
    border-radius: 8px;
    background: var(--bg);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
    transform: translateX(calc(100% * var(--i)));
    transition: transform var(--dur-card, 400ms) var(--ease-card, ease-out);
  }
  :global(:root[data-theme='dark']) .thumb {
    background: var(--fill-strong);
  }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) .thumb {
      background: var(--fill-strong);
    }
  }
  button {
    position: relative;
    height: 34px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text2);
    transition: color 0.2s;
  }
  button.sel {
    color: var(--text);
    font-weight: 600;
  }
</style>
