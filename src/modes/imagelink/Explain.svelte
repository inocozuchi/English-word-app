<script lang="ts">
  // 4択・図を選ぶ問題の解説（回答後、問題のエリアに入れ替わる）。設定で答え合わせのあとに英文を読み上げる
  import { onMount } from 'svelte';
  import type { IlQuestion } from './quiz.ts';
  import { speakText } from './quiz.ts';
  import { speak } from '../../core/speech.ts';
  import { autoSpeakOn } from './autoSpeak.ts';
  import AnswerBlock from './AnswerBlock.svelte';

  let { q }: { q: IlQuestion } = $props();
  onMount(() => {
    const t = speakText(q.data.raw);
    if (t && autoSpeakOn()) speak(t);
  });
</script>

<AnswerBlock r={q.data.raw} showAnswer={q.data.kind !== 'figchoice'} showFigure={q.data.raw.type === 'fig_caption' || q.data.raw.type === 'prep_icon'} />
