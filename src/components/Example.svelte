<script lang="ts">
  import type { Example } from '../lib/types.ts';
  // 例文。見出し語を太字にする
  let { ex, word = '' }: { ex: Example; word?: string } = $props();
  const segs = $derived.by(() => {
    if (!word) return [{ t: ex.en, hit: false }];
    const stem = word.replace(/e$/, '');
    const re = new RegExp(`(\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-z]*)`, 'gi');
    return ex.en.split(re).map((t, i) => ({ t, hit: i % 2 === 1 }));
  });
</script>

<div class="ex">
  <p class="en">{#each segs as s}{#if s.hit}<b>{s.t}</b>{:else}{s.t}{/if}{/each}</p>
  <p class="ja">{ex.ja}</p>
</div>

<style>
  .ex {
    padding-left: 12px;
    border-left: 2px solid var(--line);
  }
  .en {
    font-size: 16px;
    line-height: 1.5;
  }
  b {
    font-weight: 650;
    color: var(--accent);
  }
  .ja {
    margin-top: 2px;
    font-size: 14px;
    color: var(--text2);
  }
</style>
