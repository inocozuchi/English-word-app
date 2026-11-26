<script lang="ts">
  import PageHero from '../components/PageHero.svelte';
  import Page from '../components/Page.svelte';
  import Icon from '../components/Icon.svelte';
  import Num from '../components/Num.svelte';
  import { spring, SPRINGS, reducedMotion } from '../core/spring.ts';
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

  /** 棒が下から順に伸びる */
  function grow(node: HTMLElement) {
    if (reducedMotion()) return;
    const s = spring(SPRINGS.card);
    node.querySelectorAll<HTMLElement>('.b').forEach((el, k) =>
      el.animate([{ transform: 'scaleY(0)' }, { transform: el.style.transform || 'none' }], { duration: s.duration, easing: s.easing, delay: 200 + k * 30, fill: 'backwards' }),
    );
  }
</script>

<Page title="学習記録">
  <PageHero ja="学習記録 · {mode.title}" en="Your *records*" />

  <!-- ホームと同じ、太枠の3つの数字 -->
  <div class="stats">
    <div class="cell">
      <span class="num en"><Num value={days} /><small>日</small></span>
      <span class="cap"><Icon name="flame" size={12} stroke={2.4} />連続日数</span>
    </div>
    <div class="cell">
      <span class="num en">{#if totals.rate === null}–{:else}<Num value={totals.rate} /><small>%</small>{/if}</span>
      <span class="cap">正答率{#if totals.rate7 !== null} · 7日 {totals.rate7}%{/if}</span>
    </div>
    <div class="cell">
      <span class="num en"><Num value={totals.a} /></span>
      <span class="cap">回答数{#if totals.a7} · 7日 {totals.a7}{/if}</span>
    </div>
  </div>

  <button class="review press" onclick={() => router.push({ name: 'review' })}>
    <span class="r-icon"><Icon name="review" size={20} /></span>
    <span class="r-txt">
      <span class="r-title">復習リスト</span>
      <span class="r-sub">まちがえた問題が入り、{store.settings.reviewGoal}回続けて正解すると外れます</span>
    </span>
    <span class="r-num en"><Num value={inReview} /></span>
  </button>

  <h2 class="ui-h2">直近14日</h2>
  <div class="bars" use:grow>
    {#each recent as d}
      <div class="col">
        <span class="b" class:zero={!d.a} class:today={d.n === t} style:transform="scaleY({Math.max(d.h, 0.03)})"></span>
        <span class="d en" class:today={d.n === t}>{dayKey(d.n).slice(8).replace(/^0/, '')}</span>
      </div>
    {/each}
  </div>

  {#if mode.StatsSection}<mode.StatsSection />{/if}
</Page>

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: var(--frame) solid var(--ink);
    border-radius: 20px;
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 12px 10px 14px;
    min-width: 0;
  }
  .cell + .cell {
    border-left: var(--frame) solid var(--ink);
  }
  .num {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
  }
  .num small {
    font-size: 13px;
    margin-left: 2px;
    color: var(--text2);
    font-family: var(--font-ja);
  }
  .cap {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cap :global(svg) {
    color: var(--accent);
  }
  .review {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
    min-height: 64px;
    padding: 10px 18px 10px 16px;
    border: var(--frame) solid var(--ink);
    border-radius: 20px;
    text-align: left;
  }
  .r-icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--bg);
  }
  .r-txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .r-title {
    font-size: 16px;
    font-weight: 800;
  }
  .r-sub {
    font-size: 11px;
    color: var(--text2);
  }
  .r-num {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }
  .bars {
    display: grid;
    grid-template-columns: repeat(14, 1fr);
    gap: 5px;
    height: 110px;
    padding: 14px 12px 8px;
    border-radius: 20px;
    border: var(--panel-border);
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
    background: var(--ink);
    transform-origin: bottom;
  }
  .b.today {
    background: var(--accent);
  }
  .b.zero {
    background: var(--fill-strong);
  }
  .d {
    font-size: 9px;
    color: var(--text3);
  }
  .d.today {
    color: var(--accent);
    font-weight: 800;
  }
</style>
