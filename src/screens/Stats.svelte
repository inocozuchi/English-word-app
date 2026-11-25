<script lang="ts">
  import Page from '../components/Page.svelte';
  import Icon from '../components/Icon.svelte';
  import { router } from '../core/router.svelte.ts';
  import { store, activeMode, loadData } from '../core/store.svelte.ts';
  import { streak, dayKey, keyToDay } from '../core/day.ts';
  import { reviewCount } from '../core/review.ts';

  loadData();
  const mode = $derived(activeMode());
  const t = $derived(store.today);
  const p = $derived(store.progress);
  const days = $derived(streak(p.days, t));
  const inReview = $derived(reviewCount(p.review));

  const totals = $derived.by(() => {
    let a = 0, c = 0, a7 = 0, c7 = 0;
    for (const [k, d] of Object.entries(p.days)) {
      a += d.a;
      c += d.c;
      if (t - keyToDay(k) < 7) {
        a7 += d.a;
        c7 += d.c;
      }
    }
    return { a, rate: a ? Math.round((c / a) * 100) : null, a7, rate7: a7 ? Math.round((c7 / a7) * 100) : null };
  });

  // 直近14日の回答数
  const recent = $derived.by(() => {
    const arr = Array.from({ length: 14 }, (_, i) => {
      const n = t - 13 + i;
      return { n, a: p.days[dayKey(n)]?.a ?? 0 };
    });
    const max = Math.max(10, ...arr.map((x) => x.a));
    return arr.map((x) => ({ ...x, h: x.a / max }));
  });
</script>

<Page title="学習記録">
  <p class="eyebrow-en">Records</p>
  <h1 class="ui-title">学習記録</h1>

  <div class="hero">
    <span class="flame"><Icon name="flame" size={28} /></span>
    <span class="big en">{days}</span>
    <span class="unit">日連続</span>
  </div>

  <div class="cards">
    <div class="card">
      <span class="cap">正答率</span>
      <span class="v en">{totals.rate ?? '–'}<small>%</small></span>
      <span class="s">直近7日 {totals.rate7 ?? '–'}%</span>
    </div>
    <div class="card">
      <span class="cap">回答数</span>
      <span class="v en">{totals.a}</span>
      <span class="s">直近7日 {totals.a7}</span>
    </div>
    <button class="card wide press" onclick={() => router.push({ name: 'review' })}>
      <span class="cap">復習リスト</span>
      <span class="v en">{inReview}<small>件</small></span>
      <span class="s">まちがえた問題が入り、{store.settings.reviewGoal}回続けて正解すると外れます</span>
      <span class="chev"><Icon name="chevron" size={18} /></span>
    </button>
  </div>

  <h2 class="ui-h2">直近14日</h2>
  <div class="bars">
    {#each recent as d}
      <div class="col">
        <span class="b" class:zero={!d.a} style:transform="scaleY({Math.max(d.h, 0.03)})"></span>
        <span class="d en">{dayKey(d.n).slice(8).replace(/^0/, '')}</span>
      </div>
    {/each}
  </div>

  {#if mode.StatsSection}<mode.StatsSection />{/if}
</Page>

<style>
  .hero {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 12px 2px 18px;
  }
  .flame {
    color: var(--accent);
    align-self: center;
    display: grid;
  }
  .big {
    font-size: 56px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1;
  }
  .unit {
    font-size: 17px;
    font-weight: 600;
    color: var(--text2);
  }
  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px 16px;
    border-radius: var(--radius-lg);
    background: var(--surface);
    text-align: left;
  }
  .card.wide {
    grid-column: 1 / -1;
  }
  .cap {
    font-size: 12px;
    color: var(--text2);
  }
  .v {
    font-size: 30px;
    font-weight: 750;
    line-height: 1.15;
  }
  .v small {
    font-size: 15px;
    margin-left: 2px;
    color: var(--text2);
    font-family: var(--font-ja);
  }
  .s {
    font-size: 12px;
    color: var(--text3);
  }
  .chev {
    position: absolute;
    right: 14px;
    top: 50%;
    translate: 0 -50%;
    color: var(--text3);
    display: grid;
  }
  .bars {
    display: grid;
    grid-template-columns: repeat(14, 1fr);
    gap: 5px;
    height: 96px;
    padding: 12px 12px 8px;
    border-radius: var(--radius-lg);
    background: var(--surface);
  }
  .col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-height: 0;
  }
  .b {
    flex: 1;
    width: 100%;
    border-radius: 3px;
    background: var(--accent);
    transform-origin: bottom;
  }
  .b.zero {
    background: var(--fill-strong);
  }
  .d {
    font-size: 9px;
    color: var(--text3);
  }
</style>
