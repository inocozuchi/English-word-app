<script lang="ts">
  // 60日ロードマップ: 各日の内容と進み具合（必須の教材をどれだけ学んだか）。日程は「この日から学習する」で変えられる
  import Page from '../../../components/Page.svelte';
  import PageHero from '../../../components/PageHero.svelte';
  import { store } from '../../../core/store.svelte.ts';
  import { haptic } from '../../../core/haptics.ts';
  import { comp, loadComp, extra, patchExtra, nowDay } from '../state.svelte.ts';
  import { todayCourseDay } from '../mode.ts';
  import { INITIAL_DAY } from '../course.ts';

  loadComp().catch(() => {});
  const cur = $derived(todayCourseDay());
  let openDay = $state<number | null>(null);
  const KIND: Record<string, string> = { lesson: '', review: '総合復習', assessment: 'テスト' };
  const rows = $derived.by(() => {
    const ix = comp.index;
    if (!ix) return [];
    const ex = extra();
    const items = store.progress.items;
    return ix.d.days.map((d) => {
      const coreItems = d.itemIds.filter((id) => ix.item.get(id)!.priority === 'core');
      const coreQs = d.questionIds.filter((id) => ix.q.get(id)!.priority === 'core');
      const doneItems = coreItems.filter((id) => items[id] || ex.ev?.[id]?.r).length;
      const doneQs = coreQs.filter((id) => ex.qs?.[id]).length;
      const total = coreItems.length + coreQs.length;
      return { ...d, total, done: doneItems + doneQs, allQs: d.questionIds.length, allItems: d.itemIds.length };
    });
  });
  function startFrom(day: number) {
    patchExtra((x) => ({ ...x, cd: { ...(x.cd ?? INITIAL_DAY), day, last: nowDay(), progressed: false } }));
    haptic('success');
    openDay = null;
  }
</script>

<Page title="ロードマップ">
  <PageHero ja="60日ロードマップ · 総合英語" en="60-day *map*" />
  <p class="lead">学習した日ごとに1日ずつ進みます。休んでも、まとめて進んだり大量の問題が出たりはしません。学びきれなかった必須の教材は次の日に繰り越します。</p>
  <ul class="days">
    {#each rows as d (d.day)}
      <li class:cur={d.day === cur} class:past={d.day < cur}>
        <button class="row press" onclick={() => (openDay = openDay === d.day ? null : d.day)} aria-expanded={openDay === d.day}>
          <span class="no en">{d.day}</span>
          <span class="main">
            <span class="t">{d.topic}{#if KIND[d.kind]}<span class="kd">{KIND[d.kind]}</span>{/if}</span>
            {#if d.total}<span class="bar"><span style:transform="scaleX({d.done / d.total})"></span></span>{/if}
          </span>
          <span class="st">{d.day === cur ? '今日' : d.total ? `${Math.round((d.done / d.total) * 100)}%` : ''}</span>
        </button>
        {#if openDay === d.day}
          <div class="det">
            {#if d.grammar}<p>{d.grammar}</p>{/if}
            <p class="sm">項目 {d.allItems} · 問題 {d.allQs}（必須のうち学んだもの {d.done} / {d.total}）</p>
            {#if d.day !== cur}<button class="go press" onclick={() => startFrom(d.day)}>次の学習をこの日から始める</button>{/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</Page>

<style>
  .lead {
    font-size: 13px;
    color: var(--text2);
    line-height: 1.6;
    margin-bottom: 12px;
  }
  .days {
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
    padding: 10px 12px;
    border: var(--card-border);
    border-radius: 14px;
    text-align: left;
    color: var(--text);
  }
  .cur .row {
    border: var(--panel-border);
  }
  .no {
    flex: none;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: var(--fill);
    font-weight: 850;
  }
  .cur .no {
    background: var(--accent);
    color: var(--on-accent);
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .t {
    font-size: 14px;
    font-weight: 700;
  }
  .kd {
    margin-left: 6px;
    font-size: 11px;
    padding: 0 6px;
    border-radius: 6px;
    border: 1.5px solid var(--line-strong);
    color: var(--text2);
  }
  .bar {
    height: 4px;
    border-radius: 2px;
    background: var(--fill);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    transform-origin: left center;
  }
  .st {
    flex: none;
    font-size: 12px;
    font-weight: 700;
    color: var(--text2);
  }
  .det {
    padding: 8px 12px 4px 58px;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .sm {
    color: var(--text2);
    font-size: 12px;
  }
  .go {
    align-self: flex-start;
    min-height: 42px;
    padding: 0 14px;
    border-radius: 999px;
    border: 2px solid var(--ink);
    font-weight: 700;
  }
</style>
