<script lang="ts">
  // 答え合わせの中身（4択の解説・入力問題の答え・問題の詳細で共通）:
  // 英文（🔊）・正解・あなたの答え・解説・注意・教科書のページ
  import type { IlRaw } from './types.ts';
  import { speakText } from './quiz.ts';
  import { figureUrl } from './quiz.ts';
  import SpeakButton from './SpeakButton.svelte';
  import Sentence from './Sentence.svelte';
  import Figure from './Figure.svelte';

  let {
    r,
    given,
    ok,
    showAnswer = true,
    showFigure = false,
  }: {
    r: IlRaw;
    /** 自分の答え（入力・並べ替え） */
    given?: string;
    ok?: boolean;
    showAnswer?: boolean;
    showFigure?: boolean;
  } = $props();

  const en = $derived(speakText(r));
  /** 英文と正解が同じなら（日→英・並べ替え・英作文）、正解の行は英文にまとめる */
  const answerIsEn = $derived(!!r.answer && !!en && r.answer.trim() === en.trim());
  const fig = $derived(r.figure ?? r.answer_figure);
</script>

<div class="ab">
  {#if showFigure && fig}<Figure src={figureUrl(fig)} compact />{/if}
  {#if en}
    <div class="en-row">
      <p class="sen en">
        {#if r.type === 'cloze' && r.prompt_en && r.answer}<Sentence text={r.prompt_en} fill={r.answer} />{:else}{en}{/if}
      </p>
      <SpeakButton text={en} size={36} />
    </div>
    {#if r.prompt_ja && r.type !== 'table'}<p class="ja">{r.prompt_ja}</p>{/if}
  {/if}
  {#if showAnswer && r.answer && !answerIsEn && r.type !== 'cloze'}
    <div class="box ans">
      <span class="lbl">{r.type === 'flashcard' ? '裏面' : r.type === 'translate' || r.type === 'exercise' ? '模範解答' : '正解'}</span>
      <p class="at" class:en={/^[\x00-\x7F’‘“”–—…]+$/.test(r.answer)}>{r.answer}</p>
    </div>
  {/if}
  {#if given !== undefined}
    <div class="box mine" class:ng={ok === false}>
      <span class="lbl">あなたの答え</span>
      <p class="at" class:en={/^[\x00-\x7F’‘“”–—…]*$/.test(given)}>{given || '（空欄）'}</p>
    </div>
  {/if}
  {#if r.explanation}
    <div class="box exp"><span class="lbl">ポイント</span><p>{r.explanation}</p></div>
  {/if}
  {#if r.confidence === 'medium' && r.note}<p class="note">{r.note}</p>{/if}
  <p class="ref">教科書 p.{r.ref_page_a5}（第{r.chapter}章「{r.chapter_title}」）</p>
</div>

<style>
  .ab {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .en-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .sen {
    flex: 1;
    font-size: 21px;
    font-weight: 700;
    line-height: 1.32;
  }
  .ja {
    font-size: 14px;
    color: var(--text2);
    margin-top: -4px;
  }
  .box {
    border: var(--card-border);
    border-radius: 14px;
    padding: 9px 12px 10px;
  }
  .lbl {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: var(--text3);
    margin-bottom: 2px;
  }
  .ans {
    border-color: var(--accent);
  }
  .ans .lbl {
    color: var(--accent);
  }
  .at {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.5;
    white-space: pre-line;
  }
  .at.en {
    font-size: 18px;
  }
  .mine.ng {
    border-style: dashed;
    border-color: var(--ink);
  }
  .mine.ng .at {
    text-decoration: line-through;
    text-decoration-thickness: 1.5px;
    color: var(--text2);
  }
  .exp p {
    font-size: 14px;
    line-height: 1.6;
  }
  .note {
    font-size: 11px;
    color: var(--text3);
  }
  .ref {
    font-size: 12px;
    color: var(--text2);
    font-weight: 600;
  }
</style>
