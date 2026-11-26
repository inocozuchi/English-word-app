<script lang="ts">
  // スライダーの1行（ラベル・値・ヒント）。値が変わると数字が弾み、つまみを離すと軽い触覚
  import Num from './Num.svelte';
  import { haptic } from '../core/haptics.ts';
  let {
    label,
    value,
    range,
    unit = '秒',
    hint = '',
    onchange,
  }: { label: string; value: number; range: readonly [number, number]; unit?: string; hint?: string; onchange: (v: number) => void } = $props();
  const p = $derived((value - range[0]) / (range[1] - range[0]));
</script>

<div class="ui-item col">
  <div class="ui-line"><span>{label}</span><span class="ui-val"><Num {value} duration={160} /><small>{unit}</small></span></div>
  <input
    type="range"
    min={range[0]}
    max={range[1]}
    step="1"
    {value}
    style:--p={p}
    oninput={(e) => onchange(+e.currentTarget.value)}
    onchange={() => haptic('light')}
    aria-label={label}
  />
  {#if hint}<p class="ui-hint">{hint}</p>{/if}
</div>
