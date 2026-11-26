<script lang="ts">
  // 教材の詳細（項目・図解・文法・会話・読解・問題）。辞典・復習リスト・弱点から開く
  import Page from '../../../components/Page.svelte';
  import { store } from '../../../core/store.svelte.ts';
  import { comp, loadComp, extra, isFav, toggleFav } from '../state.svelte.ts';
  import { masteryOf, MASTERY_LABEL, STAGE_LABEL } from '../course.ts';
  import ItemInfo from '../components/ItemInfo.svelte';
  import Visual from '../components/Visual.svelte';
  import Passage from '../components/Passage.svelte';
  import Speak from '../components/Speak.svelte';

  let { id }: { id: string } = $props();
  loadComp().catch(() => {});
  const ix = $derived(comp.index);
  const item = $derived(ix?.item.get(id));
  const visual = $derived(ix?.d.visuals.find((v) => v.id === id));
  const grammar = $derived(ix?.grammar.get(id));
  const scene = $derived(ix?.scenario.get(id));
  const doc = $derived(ix?.reading.get(id));
  const q = $derived(ix?.q.get(id));
  const st = $derived(store.progress.items[id]);
  const mastery = $derived(item || q ? masteryOf(st, extra().ev?.[id]) : null);
  const visuals = $derived(item ? (ix?.itemVisual.get(item.id) ?? []) : q ? (ix?.qVisual.get(q.id) ?? []) : []);
  const gVisual = $derived(grammar ? ix?.d.visuals.find((v) => v.id === 'visual-' + grammar.id) : undefined);
</script>

<Page title="詳細">
  {#if !ix}
    <p class="loading">読み込み中…</p>
  {:else}
    <div class="en-wrap">
      {#if item}
        <ItemInfo {item} large />
        <p class="meta">{STAGE_LABEL[item.kind]} · Day {item.day} · 習熟度：<b>{mastery ? MASTERY_LABEL[mastery] : ''}</b>{#if st} · 回答 {st.seen} 回（正解 {st.correct}）{/if}</p>
        {#each visuals as v (v.id)}<Visual {v} />{/each}
      {:else if visual}
        <button class="fav press" class:on={isFav(visual.id)} onclick={() => toggleFav(visual.id)}>{isFav(visual.id) ? '★ お気に入り' : '☆ お気に入りに追加'}</button>
        <Visual v={visual} />
      {:else if grammar}
        <h2 class="h">{grammar.title}<span class="day">Day {grammar.day}</span></h2>
        <button class="fav press" class:on={isFav(grammar.id)} onclick={() => toggleFav(grammar.id)}>{isFav(grammar.id) ? '★ お気に入り' : '☆ お気に入りに追加'}</button>
        <p class="rule">{grammar.rule}</p>
        {#if gVisual}<Visual v={gVisual} />{:else}
          {#each grammar.examples as e}<p class="ex en">◯ {e.english}<Speak text={e.english} size={30} />{#if e.incorrect}<br /><s>× {e.incorrect}</s>{/if}</p>{/each}
        {/if}
      {:else if scene}
        <h2 class="h">{scene.title}<span class="day">Day {scene.day}</span></h2>
        <p class="rule">目的：{scene.goal}</p>
        {#each scene.nodes.filter((n) => !n.terminal) as n}
          <div class="node">
            <p class="sp en">{#if n.slow}<span class="slow">ゆっくり言い直す</span>{/if}{n.speaker}<Speak text={n.speaker ?? ''} size={30} rate={n.slow ? 0.75 : undefined} /></p>
            <ul>{#each n.choices ?? [] as c}<li class="en">{c.text}{#if c.feedback}<span class="fb">{c.feedback}</span>{/if}</li>{/each}</ul>
          </div>
        {/each}
      {:else if doc}
        <Passage title={doc.title} text={doc.text} />
        <p class="meta">Day {doc.day} の読解。問題は学習の中で出ます（答えはそのときに確認できます）。</p>
      {:else if q}
        <p class="meta">Day {q.day} · {STAGE_LABEL.review}{#if mastery} · 習熟度：<b>{MASTERY_LABEL[mastery]}</b>{/if}</p>
        <p class="rule">{q.prompt}</p>
        <div class="ans"><span class="lbl">答え</span>{#each q.acceptedAnswers as a}<p class="en">{a}</p>{/each}</div>
        {#if q.audioText}<p class="ex en">{q.audioText}<Speak text={q.audioText} size={30} /></p>{/if}
        <p class="meta">{q.explanation}</p>
        {#each visuals as v (v.id)}<Visual {v} />{/each}
      {:else}
        <p class="loading">見つかりませんでした</p>
      {/if}
    </div>
  {/if}
</Page>

<style>
  .en-wrap {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 6px;
  }
  .meta {
    font-size: 13px;
    color: var(--text2);
  }
  .h {
    font-size: 24px;
    font-weight: 850;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .day {
    font-size: 12px;
    color: var(--text3);
  }
  .rule {
    font-size: 16px;
    line-height: 1.6;
    white-space: pre-line;
  }
  .ex {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 16px;
  }
  s {
    color: var(--text2);
  }
  .fav {
    align-self: flex-start;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 999px;
    border: 2px solid var(--line-strong);
    font-weight: 700;
    font-size: 13px;
  }
  .fav.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  .node {
    border-left: 3px solid var(--line-strong);
    padding-left: 12px;
  }
  .sp {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-weight: 700;
  }
  .slow {
    font-size: 11px;
    color: var(--text3);
  }
  .node ul {
    margin: 4px 0 0;
    padding-left: 1.1em;
    font-size: 14px;
  }
  .fb {
    display: block;
    font-size: 11px;
    color: var(--text3);
    font-family: var(--font-ja);
  }
  .ans {
    border: 2px solid var(--accent);
    border-radius: 14px;
    padding: 8px 12px;
  }
  .lbl {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
  }
  .loading {
    color: var(--text2);
    padding: 40px 0;
    text-align: center;
  }
</style>
