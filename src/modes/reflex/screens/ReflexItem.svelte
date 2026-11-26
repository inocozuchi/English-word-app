<script lang="ts">
  // 問題・カードの詳細（結果画面の「詳しく読む」から）: 問題・正解・図・教科書のページ・反応時間の記録
  import Page from '../../../components/Page.svelte';
  import { store } from '../../../core/store.svelte.ts';
  import { isReflexive, figureUrl } from '../engine.ts';
  import { rx, qById, cardById, loadReflex } from '../state.svelte.ts';
  import { typeTag } from '../label.ts';

  let { key }: { key: string } = $props();
  loadReflex().catch(() => {});
  const q = $derived((void rx.questions, qById.get(key)));
  const c = $derived((void rx.questions, cardById.get(key)));
  const st = $derived(store.progress.items[key]);
  const src = $derived(q ?? c);
</script>

<Page title="詳しく読む">
  {#if src}
    <div class="iv">
      <p class="meta">{src.group}{#if q} · {typeTag(q.type)}{:else} · 暗記カード{/if}</p>
      {#if q}
        <p class="qt">{q.question}</p>
        {#if q.figure}<div class="fig"><img src={figureUrl(q.figure)} alt="問題の図" /></div>{/if}
        {#if q.prompt_en}<p class="big en">{q.prompt_en}</p>{:else if q.prompt_ja && !q.question.includes(q.prompt_ja)}<p class="big">{q.prompt_ja}</p>{/if}
        <div class="box">
          <span class="lbl">正解</span>
          {#if q.answer_figure}<div class="fig"><img src={figureUrl(q.answer_figure)} alt="正解の図" /></div>{:else}<p class="ans">{q.answer}</p>{/if}
        </div>
      {:else if c}
        <p class="big en">{c.word}</p>
        <div class="box"><span class="lbl">コアイメージ</span><p class="ans">{c.image}</p></div>
      {/if}
      <p class="ref">教科書 p.{src.ref_page_a5}（第{src.chapter}章「{src.chapter_title}」）</p>
      <p class="hint">詳しい説明は、モードを「イメージリンク」（完全版）にして「章と達成度」の第{src.chapter}章から。</p>
      {#if st}
        <div class="rec">
          <span>回答 <b class="en">{st.seen}</b></span>
          <span>正解 <b class="en">{st.correct}</b></span>
          <span>箱 <b class="en">{st.box}</b>/5</span>
          {#if q && isReflexive(st, q.time_limit_sec * 1000)}<span class="rf">反射できる</span>{:else if st.conf === 'low'}<span>あやしい</span>{/if}
          {#if st.recent?.length}
            <span class="rts">反応時間 {#each st.recent as r}<b class="en rt" class:ng={!r.ok}>{(r.ms / 1000).toFixed(1)}</b>{/each} 秒{#if q}（制限 {q.time_limit_sec} 秒）{/if}</span>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <p class="loading">読み込み中…</p>
  {/if}
</Page>

<style>
  .iv {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 8px;
  }
  .meta {
    font-size: 12px;
    font-weight: 700;
    color: var(--text3);
  }
  .qt {
    font-size: 15px;
    font-weight: 600;
    color: var(--text2);
  }
  .big {
    font-size: 34px;
    font-weight: 850;
    line-height: 1.2;
  }
  .fig {
    background: #fff;
    border-radius: 16px;
    border: var(--card-border);
    padding: 8px;
  }
  .fig img {
    display: block;
    width: 100%;
    max-height: 34vh;
    object-fit: contain;
  }
  .box {
    border: 2px solid var(--accent);
    border-radius: 16px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lbl {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
  }
  .ans {
    font-size: 20px;
    font-weight: 800;
  }
  .ref {
    font-size: 13px;
    font-weight: 700;
  }
  .hint {
    font-size: 12px;
    color: var(--text2);
    margin-top: -6px;
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
  .rf {
    color: var(--accent);
    font-weight: 800;
  }
  .rts {
    width: 100%;
  }
  .rt {
    margin: 0 3px;
  }
  .rt.ng {
    text-decoration: line-through;
    color: var(--text3);
  }
  .loading {
    color: var(--text2);
    padding: 40px 0;
    text-align: center;
  }
</style>
