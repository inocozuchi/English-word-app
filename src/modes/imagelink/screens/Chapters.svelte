<script lang="ts">
  // 章と達成度: 連続日数・今日の回答・習得、部ごとの進み具合、章ごとの正答率と習得数。章をタップでミニテスト
  import Page from '../../../components/Page.svelte';
  import PageHero from '../../../components/PageHero.svelte';
  import Num from '../../../components/Num.svelte';
  import Icon from '../../../components/Icon.svelte';
  import { store } from '../../../core/store.svelte.ts';
  import { streak, dayKey } from '../../../core/day.ts';
  import PartBars from '../PartBars.svelte';
  import { chapterStats } from '../quiz.ts';
  import { partColor } from '../partColor.ts';
  import { il, loadIndex } from '../state.svelte.ts';
  import { startChapter } from '../start.ts';

  loadIndex().catch(() => {});
  const days = $derived(streak(store.progress.days, store.today));
  const todayCount = $derived(store.progress.days[dayKey(store.today)]?.a ?? 0);
  const stats = $derived(chapterStats(store.progress.items));
  const learned = $derived([...stats.values()].reduce((n, x) => n + x.learned, 0));
  /** 部ごとに章を並べる */
  const groups = $derived(
    (il.index?.parts ?? []).map((p) => ({ ...p, chapters: il.index!.chapters.filter((c) => c.part === p.part) })),
  );
  let tab = $state(0);
  const shown = $derived(groups[tab]);
</script>

<Page title="章と達成度">
  <PageHero ja="章と達成度 · イメージリンク" en="Chapter *map*" />

  <div class="stats">
    <div class="c"><span class="n en"><Num value={days} /></span><span class="cap">連続日数</span></div>
    <div class="c"><span class="n en"><Num value={todayCount} /></span><span class="cap">今日の回答</span></div>
    <div class="c"><span class="n en"><Num value={learned} /></span><span class="cap">習得した問題</span></div>
  </div>

  <h2 class="ui-h2">部ごとの進み具合</h2>
  <div class="card"><PartBars /></div>

  <h2 class="ui-h2">章 <span class="hint">タップでその章から10問</span></h2>
  {#if il.error && !il.index}<p class="err">{il.error}</p>{/if}
  <div class="tabs" role="tablist">
    {#each groups as g, k}
      <button class="tab press" role="tab" aria-selected={tab === k} class:on={tab === k} style:--part={partColor(g.part)} onclick={() => (tab = k)}>
        <b class="en">{g.part}</b><span>{g.name}</span>
      </button>
    {/each}
  </div>
  {#if shown}
    <ul class="list" style:--part={partColor(shown.part)}>
      {#each shown.chapters as c (c.no)}
        {@const x = stats.get(c.no)}
        {@const rate = x && x.seen ? Math.round((x.correct / x.seen) * 100) : null}
        <li>
          <button class="row press" onclick={() => startChapter(c.no)} aria-label="第{c.no}章 {c.title} のミニテストを始める">
            <span class="no en">{c.no}</span>
            <span class="main">
              <span class="t">{c.title}</span>
              <span class="bar"><span class="f" style:transform="scaleX({x ? x.learned / c.question_count : 0})"></span></span>
              <span class="meta">
                <span>習得 <b class="en">{x?.learned ?? 0}</b> / {c.question_count}</span>
                <span>正答率 <b class="en">{rate === null ? '—' : `${rate}%`}</b></span>
                <span>p.{c.page_a5}</span>
              </span>
            </span>
            <span class="go"><Icon name="chevron" size={18} /></span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</Page>

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: var(--panel-border);
    border-radius: 20px;
  }
  .c {
    display: flex;
    flex-direction: column;
    padding: 10px 14px 9px;
  }
  .c + .c {
    border-left: var(--panel-border);
  }
  .n {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    line-height: 1.05;
  }
  .cap {
    font-size: 11px;
    font-weight: 600;
    color: var(--text2);
  }
  .card {
    padding: 16px;
    border-radius: var(--radius-lg);
    border: var(--panel-border);
  }
  .hint {
    margin-left: auto;
    font-size: 12px;
    font-weight: 600;
    color: var(--text3);
  }
  .err {
    color: var(--text2);
    font-size: 13px;
  }
  .tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 12px;
  }
  .tab {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    padding: 7px 9px 8px;
    min-height: 58px;
    border-radius: 14px;
    border: 2px solid var(--line-strong);
    text-align: left;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text2);
    line-height: 1.25;
  }
  .tab b {
    font-size: 18px;
    font-weight: 850;
    color: color-mix(in srgb, var(--part) var(--part-mix), #fff);
  }
  .tab.on {
    border-color: color-mix(in srgb, var(--part) var(--part-mix), #fff);
    background: color-mix(in srgb, var(--part) var(--part-mix), #fff);
    color: #fff;
  }
  .tab.on b {
    color: #fff;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 12px 11px 12px;
    border: var(--card-border);
    border-radius: 16px;
    text-align: left;
  }
  .no {
    flex: none;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: color-mix(in srgb, var(--part) var(--part-mix), #fff);
    color: #fff;
    font-weight: 850;
    font-size: 15px;
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .t {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
  }
  .bar {
    height: 5px;
    border-radius: 3px;
    background: var(--fill);
    overflow: hidden;
  }
  .f {
    display: block;
    height: 100%;
    background: color-mix(in srgb, var(--part) var(--part-mix), #fff);
    transform-origin: left center;
  }
  .meta {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: var(--text2);
  }
  .meta b {
    color: var(--text);
  }
  .go {
    flex: none;
    color: var(--text3);
  }
</style>
