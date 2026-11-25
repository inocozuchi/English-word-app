<script lang="ts">
  import Page from '../components/Page.svelte';
  import Icon from '../components/Icon.svelte';
  import { router } from '../lib/router.svelte.ts';
  import { store, loadData, today } from '../lib/store.svelte.ts';
  import { streak, dayKey } from '../lib/day.ts';
  import { wordStatus } from '../lib/summary.ts';
  import type { Word } from '../lib/types.ts';

  if (!store.index) loadData();
  const t = today();
  const p = $derived(store.progress);
  const days = $derived(streak(p.days, t));

  const totals = $derived.by(() => {
    let a = 0, c = 0, a7 = 0, c7 = 0;
    for (const [k, d] of Object.entries(p.days)) {
      a += d.a;
      c += d.c;
      const n = Math.round(Date.parse(k + 'T00:00:00Z') / 86_400_000);
      if (t - n < 7) {
        a7 += d.a;
        c7 += d.c;
      }
    }
    return { a, c, a7, c7, rate: a ? Math.round((c / a) * 100) : null, rate7: a7 ? Math.round((c7 / a7) * 100) : null };
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

  const words = $derived.by(() => {
    const ix = store.index;
    if (!ix) return null;
    let learned = 0, learning = 0;
    for (const w of ix.ds.words) {
      const s = wordStatus(p.items, w);
      if (s === 'learned') learned++;
      else if (s === 'learning') learning++;
    }
    return { learned, learning, total: ix.ds.words.length };
  });

  // 章ごとの正答率（英→日・日→英）
  const chapters = $derived.by(() => {
    const ix = store.index;
    if (!ix) return [];
    return ix.ds.chapters.map((c) => {
      let seen = 0, ok = 0;
      for (const w of ix.wordsByChapter.get(c.no)!)
        for (const f of ['ej:', 'je:']) {
          const s = p.items[f + w.w];
          if (s) {
            seen += s.seen;
            ok += s.correct;
          }
        }
      return { c, seen, rate: seen ? ok / seen : null };
    });
  });

  // 苦手な単語: まちがえた回数が多く、正答率が低い順
  const weak = $derived.by(() => {
    const ix = store.index;
    if (!ix) return [];
    const list: { w: Word; wrong: number; seen: number; score: number }[] = [];
    for (const w of ix.ds.words) {
      let wrong = 0, seen = 0, lastOk = true;
      for (const f of ['ej:', 'je:']) {
        const s = p.items[f + w.w];
        if (s) {
          wrong += s.wrong;
          seen += s.seen;
          if (!s.lastOk) lastOk = false;
        }
      }
      if (!wrong) continue;
      list.push({ w, wrong, seen, score: wrong * 2 - (seen - wrong) + (lastOk ? 0 : 3) });
    }
    return list.sort((a, b) => b.score - a.score).slice(0, 20);
  });
</script>

<Page title="学習記録">
  <h1 class="title">学習記録</h1>

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
    {#if words}
      <div class="card wide">
        <span class="cap">単語</span>
        <div class="prog">
          <span class="seg learned" style:flex={words.learned}></span>
          <span class="seg learning" style:flex={words.learning}></span>
          <span class="seg rest" style:flex={words.total - words.learned - words.learning}></span>
        </div>
        <span class="s"><b class="acc">覚えた {words.learned}</b> · 学習中 {words.learning} · 全 {words.total}語</span>
      </div>
    {/if}
  </div>

  <h2>直近14日</h2>
  <div class="bars">
    {#each recent as d}
      <div class="col">
        <span class="b" class:zero={!d.a} style:transform="scaleY({Math.max(d.h, 0.03)})"></span>
        <span class="d en">{dayKey(d.n).slice(8).replace(/^0/, '')}</span>
      </div>
    {/each}
  </div>

  {#if weak.length}
    <h2>苦手な単語</h2>
    <ul class="group">
      {#each weak as x}
        <li><button class="row press" onclick={() => router.push({ name: 'word', w: x.w.w })}>
          <span class="en ww">{x.w.w}</span>
          <span class="wm">{x.w.defs[0]?.ja}</span>
          <span class="wc">✕{x.wrong}</span>
        </button></li>
      {/each}
    </ul>
  {/if}

  {#if chapters.some((c) => c.seen)}
    <h2>章ごとの正答率</h2>
    <ul class="chs">
      {#each chapters as x}
        <li>
          <span class="cn">{x.c.no}. {x.c.title}</span>
          <span class="track"><span class="fill" style:transform="scaleX({x.rate ?? 0})"></span></span>
          <span class="cr en">{x.rate === null ? '–' : Math.round(x.rate * 100) + '%'}</span>
        </li>
      {/each}
    </ul>
  {/if}
</Page>

<style>
  .title {
    font-size: 32px;
    font-weight: 750;
    margin: 4px 0 10px;
  }
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
    font-weight: 700;
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
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px 16px;
    border-radius: var(--radius-lg);
    background: var(--surface);
  }
  .card.wide {
    grid-column: 1 / -1;
    gap: 8px;
  }
  .cap {
    font-size: 12px;
    color: var(--text2);
  }
  .v {
    font-size: 30px;
    font-weight: 700;
    line-height: 1.15;
  }
  .v small {
    font-size: 15px;
    margin-left: 1px;
    color: var(--text2);
  }
  .s {
    font-size: 12px;
    color: var(--text3);
  }
  .acc {
    color: var(--accent);
    font-weight: 600;
  }
  .prog {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: var(--fill-strong);
    gap: 2px;
  }
  .seg.learned {
    background: var(--accent);
  }
  .seg.learning {
    background: color-mix(in srgb, var(--accent) 40%, transparent);
  }
  .seg.rest {
    background: transparent;
  }
  h2 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
    margin: 26px 4px 10px;
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
  .group {
    list-style: none;
    margin: 0;
    padding: 0;
    border-radius: var(--radius-lg);
    background: var(--surface);
    overflow: hidden;
  }
  .group li + li {
    border-top: 0.5px solid var(--line);
  }
  .row {
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 13px 16px 13px 18px;
    text-align: left;
  }
  .ww {
    font-weight: 650;
    font-size: 17px;
  }
  .wm {
    flex: 1;
    font-size: 13px;
    color: var(--text2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .wc {
    font-size: 12px;
    color: var(--text3);
  }
  .chs {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .chs li {
    display: grid;
    grid-template-columns: 1fr 70px 40px;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }
  .cn {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .track {
    height: 5px;
    border-radius: 3px;
    background: var(--fill-strong);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--accent);
    transform-origin: left;
  }
  .cr {
    text-align: right;
    color: var(--text2);
    font-variant-numeric: tabular-nums;
  }
</style>
