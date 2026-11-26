<script lang="ts">
  // 例文（英語と和訳）。デッキに依存しない共通部品
  type Example = { en: string; ja: string };
  import { splitHighlight } from '../core/highlight.ts';
  // 例文。見出し語（活用形を含む）を強調する
  let { ex, word = '' }: { ex: Example; word?: string } = $props();
  const segs = $derived(splitHighlight(ex.en, word));
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
