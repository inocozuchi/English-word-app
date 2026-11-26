<script lang="ts">
  // 反射版の学習記録: グループ別の反射率とタイムアタックのベスト
  import Icon from '../../components/Icon.svelte';
  import { router } from '../../core/router.svelte.ts';
  import { store } from '../../core/store.svelte.ts';
  import RateBars from './RateBars.svelte';
  import { loadReflex } from './state.svelte.ts';
  import type { AttackRecord } from './engine.ts';

  loadReflex().catch(() => {});
  const best = $derived((store.progress.extra?.attackBest ?? null) as AttackRecord | null);
</script>

<h2 class="ui-h2">反射率（グループ別）</h2>
<div class="card"><RateBars tappable={false} /></div>
{#if best}<p class="best">タイムアタックのベスト: <b class="en">{best.correct}/{best.total}</b>・平均 <b class="en">{(best.avgMs / 1000).toFixed(2)}</b> 秒</p>{/if}
<button class="all press" onclick={() => router.push({ name: 'reflex/rates' })}>問題ごとの反射率を見る<Icon name="chevron" size={18} /></button>

<style>
  .card {
    padding: 16px;
    border-radius: var(--radius-lg);
    border: var(--panel-border);
  }
  .best {
    margin-top: 10px;
    font-size: 13px;
    color: var(--text2);
  }
  .best b {
    color: var(--text);
  }
  .all {
    margin-top: 10px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    padding: 0 16px;
    border-radius: 16px;
    border: var(--panel-border);
    font-weight: 700;
  }
</style>
