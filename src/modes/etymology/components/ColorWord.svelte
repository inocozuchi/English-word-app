<script lang="ts">
  // 単語の綴りを接頭辞・語根・接尾辞の色で分けて表示（分けられないときはそのまま）
  import type { Part } from '../types.ts';
  import { segments, type MorphPart } from '../morph.ts';
  let { word, parts, rootColor = true }: { word: string; parts: Part[]; rootColor?: boolean } = $props();
  const segs = $derived(segments(word, parts.map((p) => ({ ...p, kind: p.kind ?? 'root' }) as MorphPart)));
</script>

{#if segs}{#each segs as s}<span class="seg {s.kind}" class:plain={!rootColor && s.kind === 'root'}>{s.text}</span>{/each}{:else}{word}{/if}

<style>
  .seg.pre {
    color: var(--m-pre);
  }
  .seg.root {
    color: var(--m-root);
  }
  .seg.root.plain {
    color: inherit;
  }
  .seg.suf {
    color: var(--m-suf);
  }
  .seg.link {
    color: var(--text3);
  }
</style>
