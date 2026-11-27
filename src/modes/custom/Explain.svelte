<script lang="ts">
  // 自由英単語の解説（回答後）
  import type { CQuestion } from './quiz.ts';
  import WordCard from './WordCard.svelte';
  let { q }: { q: CQuestion } = $props();
</script>

<WordCard w={q.data.word} />
