<script lang="ts">
  // 問題の詳細（復習リスト・結果から）: 問題文・選択肢の正解・解説・教科書のページ
  import Page from '../../../components/Page.svelte';
  import ChapterTag from '../ChapterTag.svelte';
  import AnswerBlock from '../AnswerBlock.svelte';
  import Figure from '../Figure.svelte';
  import { store } from '../../../core/store.svelte.ts';
  import { parseKey, figureUrl, TYPE_LABELS, IL_LEARNED_BOX } from '../quiz.ts';
  import { il, questionById, loadPart, loadIndex, partOfChapter } from '../state.svelte.ts';
  import { startChapter } from '../start.ts';

  let { key }: { key: string } = $props();
  const k = $derived(parseKey(key));
  $effect(() => {
    const ch = k?.chapter;
    if (ch) loadIndex().then(() => { const p = partOfChapter(ch); if (p) loadPart(p); }).catch(() => {});
  });
  const r = $derived.by(() => {
    void il.parts;
    return k ? questionById(k.id) : undefined;
  });
  const st = $derived(store.progress.items[key]);
</script>

<Page title="問題">
  {#if r}
    <div class="qv">
      <ChapterTag part={r.part} chapter={r.chapter} title={r.chapter_title} />
      <p class="ty">{TYPE_LABELS[r.type]}</p>
      <p class="qt">{r.question}</p>
      {#if r.answer_figure}
        <p class="lbl">正解の図</p>
        <Figure src={figureUrl(r.answer_figure)} />
      {/if}
      {#if r.type === 'order' && r.tokens}<p class="tokens en">{r.tokens.join(' / ')}</p>{/if}
      <AnswerBlock {r} showFigure={!!r.figure} />
      {#if st}
        <div class="rec">
          <span>回答 <b class="en">{st.seen}</b> 回</span>
          <span>正解 <b class="en">{st.correct}</b> 回</span>
          <span>箱 <b class="en">{st.box}</b>/5{st.box >= IL_LEARNED_BOX ? '（習得）' : ''}</span>
          {#if st.conf === 'low'}<span>自信なし</span>{/if}
        </div>
      {/if}
      <button class="go press" onclick={() => startChapter(r.chapter)}>第{r.chapter}章のミニテストへ</button>
    </div>
  {:else}
    <p class="loading">読み込み中…</p>
  {/if}
</Page>

<style>
  .qv {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 8px;
  }
  .ty {
    font-size: 12px;
    font-weight: 700;
    color: var(--text3);
    margin-bottom: -6px;
  }
  .qt {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.5;
  }
  .lbl {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
    margin-bottom: -6px;
  }
  .tokens {
    font-size: 14px;
    color: var(--text2);
  }
  .rec {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    font-size: 12px;
    color: var(--text2);
    padding: 10px 12px;
    border: var(--card-border);
    border-radius: 14px;
  }
  .rec b {
    color: var(--text);
  }
  .go {
    min-height: 54px;
    border-radius: 18px;
    border: var(--panel-border);
    font-weight: 800;
  }
  .loading {
    color: var(--text2);
    padding: 40px 0;
    text-align: center;
  }
</style>
