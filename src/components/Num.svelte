<script lang="ts">
  // 数字。値が変わると、前の値から転がるように数えて「ポン」と弾む（学習の手応え）
  import { untrack } from 'svelte';
  import { reducedMotion } from '../core/spring.ts';
  import { bump } from '../core/transitions.ts';
  let {
    value,
    from = 0,
    duration = 520,
    delay = 160,
  }: {
    value: number;
    /** 最初に表示したときに数え始める値（既定 0: 0 から数え上がる） */
    from?: number | null;
    duration?: number;
    /** 最初の数え上げを始めるまで（画面が出てくる動きに合わせる） */
    delay?: number;
  } = $props();

  // svelte-ignore state_referenced_locally
  let shown = $state(reducedMotion() ? value : (from ?? value));
  let first = true;
  let el: HTMLElement;
  $effect(() => {
    const to = value;
    const start = untrack(() => shown);
    if (start === to) return;
    if (reducedMotion()) {
      shown = to;
      return;
    }
    // 数が大きいほど少し長く（1,000 を超える数も目で追える速さに）
    const dur = Math.min(1100, duration + Math.log10(Math.abs(to - start) + 1) * 120);
    const t0 = performance.now() + (first ? delay : 0);
    first = false;
    let raf = 0;
    const step = (t: number) => {
      const u = Math.max(0, Math.min(1, (t - t0) / dur));
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
