<script lang="ts">
  // QuizMode.Prompt（総合英語は専用の学習画面を使うので、共通のクイズ画面からは使わない）
  import type { Question } from '../../../core/mode.ts';
  let { q }: { q: Question; phase: 'ask' | 'reveal' } = $props();
</script>

<p>{q.key}</p>
