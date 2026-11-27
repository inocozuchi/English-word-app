<script lang="ts">
  // ほかのモードの単語を「自由英単語」に追加するボタン（追加済みなら ✓）
  import { addWords, findWord } from './words.ts';
  import { haptic } from '../../core/haptics.ts';

  let { en, ja, ex }: { en: string; ja: string; ex?: string } = $props();
  const has = $derived(!!findWord(en));
  let pop = $state(false);
  function add() {
    if (has) return;
    addWords([{ en, ja, ex }]);
    haptic('success');
    pop = true;
  }
</script>

<button class="mine press" class:on={has} class:pop onclick={add} aria-pressed={has} onanimationend={() => (pop = false)}>
  {has ? '✓ 自由英単語に追加済み' : '＋ 自由英単語に追加'}
</button>

<style>
  .mine {
    align-self: flex-start;
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    border: 2px solid var(--ink);
    font-size: 12px;
    font-weight: 800;
    color: var(--text);
    white-space: nowrap;
  }
  .mine.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  .pop {
    animation: mpop 0.4s var(--ease-pop, ease-out);
  }
  @keyframes mpop {
    40% { transform: scale(1.1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .pop { animation: none; }
  }
</style>
