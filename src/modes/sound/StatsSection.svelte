<script lang="ts">
  // 音声変化モードの学習記録: ルール別の正答率（これまでの合計）
  import { store } from '../../core/store.svelte.ts';
  import RuleBars from './components/RuleBars.svelte';
  import { router } from '../../core/router.svelte.ts';
  import { snd } from './state.svelte.ts';
  import { RULE_IDS } from './types.ts';
  import { weakness } from './quiz.ts';

  const tags = $derived(store.progress.tags);
  const weakest = $derived(
    RULE_IDS.filter((r) => (tags[r]?.seen ?? 0) > 0).sort((a, b) => weakness(tags, b) - weakness(tags, a))[0],
  );
</script>

<h2 class="ui-h2">ルール別の正答率</h2>
<div class="card">
  <RuleBars stats={tags} />
  {#if weakest}
    <button class="go press" onclick={() => router.push({ name: 'sound/rule', params: { id: weakest } })}>
      いちばん苦手な「{snd.index?.rule.get(weakest)?.name}」の復習ノートを見る
    </button>
  {/if}
</div>

<style>
  .card {
    padding: 8px 16px 14px;
    border-radius: var(--radius-lg);
    background: var(--surface);
  }
  .go {
    margin-top: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
  }
</style>
