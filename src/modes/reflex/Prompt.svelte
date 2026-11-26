<script lang="ts">
  // QuizMode.Prompt（反射版は専用のクイズ画面を使うので、共通の画面からは使わない）
  import type { Question } from '../../core/mode.ts';
  import type { Built } from './engine.ts';
  import RPrompt from './RPrompt.svelte';
  let { q }: { q: Question<Built>; phase: 'ask' | 'reveal' } = $props();
</script>

<RPrompt q={q.data.q} />
