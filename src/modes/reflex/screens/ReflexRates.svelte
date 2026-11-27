<script lang="ts">
  import { tapWord, finePointer } from '../../../core/pointer.ts';
  // 反射率: 全体とグループ別の反射率（主な指標）、タイムアタックのベスト、問題ごとの状態
  import Page from '../../../components/Page.svelte';
  import PageHero from '../../../components/PageHero.svelte';
  import Num from '../../../components/Num.svelte';
  import { store } from '../../../core/store.svelte.ts';
  import { router } from '../../../core/router.svelte.ts';
  import { streak, dayKey } from '../../../core/day.ts';
  import RateBars from '../RateBars.svelte';
  import { GROUPS, isReflexive, isWeak, type AttackRecord } from '../engine.ts';
  import { rx, loadReflex } from '../state.svelte.ts';
  import { itemLabel } from '../label.ts';

  loadReflex().catch(() => {});
  const qs = $derived(rx.questions ?? []);
  const reflexN = $derived(qs.filter((q) => isReflexive(store.progress.items[q.id], q.time_limit_sec * 1000)).length);
  const days = $derived(streak(store.progress.days, store.today));
  const todayCount = $derived(store.progress.days[dayKey(store.today)]?.a ?? 0);
  const best = $derived((store.progress.extra?.attackBest ?? null) as AttackRecord | null);
  let group = $state(GROUPS[0]);
  const list = $derived(qs.filter((q) => q.group === group));
  const status = (id: string, lim: number) => {
    const st = store.progress.items[id];
    if (isReflexive(st, lim)) return 'rf';
    if (isWeak(st)) return 'wk';
    return st ? 'tr' : 'no';
  };
</script>

<Page title="反射率">
  <PageHero ja="反射率 · イメージリンク 反射" en="Reflex *rate*" />

  <div class="stats">
    <div class="c"><span class="n en"><Num value={qs.length ? Math.round((reflexN / qs.length) * 100) : 0} /><small>%</small></span><span class="cap">反射率（{reflexN}/{qs.length}）</span></div>
    <div class="c"><span class="n en"><Num value={days} /></span><span class="cap">連続日数</span></div>
    <div class="c"><span class="n en"><Num value={todayCount} /></span><span class="cap">今日の回答</span></div>
  </div>
  <p class="def">反射できる = 直近3回続けて、制限時間の半分以内に正解</p>

  <h2 class="ui-h2">グループ別 <span class="hint">{tapWord()}で集中</span></h2>
  <div class="card"><RateBars /></div>

  <h2 class="ui-h2">タイムアタック</h2>
  <div class="card best">
    {#if best}
      <span><b class="en">{best.correct}/{best.total}</b> 正解（{Math.round((best.correct / best.total) * 100)}%）</span>
      <span>平均 <b class="en">{(best.avgMs / 1000).toFixed(2)}</b> 秒</span>
      <span class="at">{new Date(best.at).toLocaleDateString()}</span>
    {:else}
      <span class="none">まだ記録がありません（設定の出題方法で「タイムアタック」）</span>
    {/if}
  </div>

  <h2 class="ui-h2">問題ごと</h2>
  <div class="tabs">
    {#each GROUPS as g}<button class="tab press" class:on={group === g} onclick={() => (group = g)}>{g}</button>{/each}
  </div>
  <p class="legend"><span class="d rf"></span>反射できる<span class="d tr"></span>練習中<span class="d wk"></span>弱点<span class="d no"></span>未回答</p>
  <ul class="list">
    {#each list as q (q.id)}
      {@const lb = itemLabel(q.id)}
      {@const st = store.progress.items[q.id]}
      <li>
        <button class="row press" onclick={() => router.push({ name: 'reflex/item', params: { key: q.id } })}>
          <span class="d {status(q.id, q.time_limit_sec * 1000)}"></span>
          <span class="main"><span class="w" class:en={lb?.latin}>{lb?.title}</span><span class="m">{lb?.tag} · {lb?.sub}</span></span>
          {#if st?.recent?.length}<span class="ms en">{(st.recent[st.recent.length - 1].ms / 1000).toFixed(1)}s</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
</Page>

<style>
  .stats {
    display: grid;
    grid-template-columns: 1.3fr 1fr 1fr;
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
  .n small {
    font-size: 14px;
  }
  .cap {
    font-size: 11px;
    font-weight: 600;
    color: var(--text2);
  }
  .def {
    font-size: 11px;
    color: var(--text3);
    margin-top: 8px;
  }
  .hint {
    margin-left: auto;
    font-size: 12px;
    color: var(--text3);
    font-weight: 600;
  }
  .card {
    padding: 16px;
    border-radius: var(--radius-lg);
    border: var(--panel-border);
  }
  .best {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    font-size: 14px;
  }
  .best b {
    font-size: 18px;
  }
  .at,
  .none {
    color: var(--text2);
    font-size: 12px;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }
  .tab {
    min-height: 36px;
    padding: 0 12px;
    border-radius: 999px;
    border: 2px solid var(--line-strong);
    font-size: 13px;
    font-weight: 700;
    color: var(--text2);
  }
  .tab.on {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--bg);
  }
  .legend {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--text2);
    margin-bottom: 8px;
  }
  .legend .d:not(:first-child) {
    margin-left: 8px;
  }
  .d {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .d.rf {
    background: var(--accent);
  }
  .d.tr {
    background: var(--text3);
  }
  .d.wk {
    background: var(--bg);
    border: 2.5px solid var(--ink);
  }
  .d.no {
    background: var(--fill-strong);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 12px;
    border: var(--card-border);
    border-radius: 14px;
    text-align: left;
    color: var(--text);
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .w {
    font-weight: 800;
    font-size: 15px;
  }
  .m {
    font-size: 12px;
    color: var(--text2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ms {
    font-size: 12px;
    color: var(--text3);
    font-weight: 700;
  }
</style>
