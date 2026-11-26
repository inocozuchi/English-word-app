<script lang="ts">
  // 英文。穴埋めの空所（＿＿＿）は線の枠にし、fill があれば正解を入れて強調する
  let { text, fill }: { text: string; fill?: string } = $props();
  const parts = $derived(text.split(/(＿{2,}|_{3,})/));
</script>

{#each parts as p, k}{#if k % 2}<span class="blank" class:filled={!!fill}>{fill ?? '  '}</span>{:else}{p}{/if}{/each}

<style>
  .blank {
    display: inline-block;
    min-width: 2.6em;
    padding: 0 0.25em;
    border-bottom: 3px solid currentColor;
    text-align: center;
  }
  .blank.filled {
    color: var(--accent);
    border-color: var(--accent);
  }
</style>
