<script lang="ts">
  // 数字。値が変わると、前の値から転がるように数えて「ポン」と弾む（学習の手応え）
  import { untrack } from 'svelte';
  import { reducedMotion } from '../core/spring.ts';
  import { bump } from '../core/transitions.ts';
  let { value, from = null, duration = 520 }: { value: number; from?: number | null; duration?: number } = $props();

  // svelte-ignore state_referenced_locally
  let shown = $state(from ?? value);
  let el: HTMLElement;
  $effect(() => {
    const to = value;
    const start = untrack(() => shown);
    if (start === to) return;
    if (reducedMotion()) {
      shown = to;
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const u = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - u, 3);
      shown = Math.round(start + (to - start) * e);
      if (u < 1) raf = requestAnimationFrame(step);
      else if (el) bump(el, 1.14);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });
</script>

<span class="num-roll" bind:this={el}>{shown}</span>

<style>
  .num-roll {
    display: inline-block;
    font-variant-numeric: tabular-nums;
  }
</style>
