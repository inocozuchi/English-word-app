<script lang="ts">
  // 4択・図を選ぶ問題の問題文。英文には 🔊、図は画面幅いっぱい
  import type { IlQuestion } from './quiz.ts';
  import ChapterTag from './ChapterTag.svelte';
  import SpeakButton from './SpeakButton.svelte';
  import Figure from './Figure.svelte';
  import Sentence from './Sentence.svelte';

  let { q }: { q: IlQuestion; phase: 'ask' | 'reveal' } = $props();
  const r = $derived(q.data.raw);
  /** 表の問題は question に行の名前まで入っているので、prompt_ja は繰り返さない */
  const ja = $derived(r.type === 'table' ? null : r.prompt_ja);
</script>

<div class="p scroll">
  <ChapterTag part={r.part} chapter={r.chapter} title={r.chapter_title} />
  <p class="qt">{r.question}</p>
  {#if q.data.figure}<Figure src={q.data.figure} />{/if}
  {#if r.prompt_en}
    <div class="en-row">
      <p class="pe en"><Sentence text={r.prompt_en} /></p>
      {#if r.type !== 'cloze'}<SpeakButton text={r.speak ?? r.prompt_en} />{/if}
    </div>
  {/if}
  {#if ja}<p class="pj" class:big={!r.prompt_en}>{ja}</p>{/if}
  {#if r.confidence === 'medium' && r.note}<p class="note">{r.note}</p>{/if}
</div>

<style>
  .p {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px 2px 14px;
  }
  .qt {
    font-size: 14px;
    font-weight: 600;
    color: var(--text2);
    line-height: 1.5;
  }
  .en-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .pe {
    flex: 1;
    font-size: clamp(22px, 6.6vw, 28px);
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }
  .pj {
    font-size: 17px;
    font-weight: 600;
    line-height: 1.5;
  }
  .pj.big {
    font-size: clamp(20px, 6vw, 24px);
    font-weight: 800;
  }
  .note {
    font-size: 11px;
    color: var(--text3);
    line-height: 1.5;
  }
</style>
