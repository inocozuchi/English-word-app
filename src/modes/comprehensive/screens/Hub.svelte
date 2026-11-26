<script lang="ts">
  // 教材と記録（副導線）: 日程の進み具合・辞典・お気に入り・弱点・ロードマップ・診断・学習レポート
  import Page from '../../../components/Page.svelte';
  import PageHero from '../../../components/PageHero.svelte';
  import Icon from '../../../components/Icon.svelte';
  import Num from '../../../components/Num.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { store } from '../../../core/store.svelte.ts';
  import { comp, loadComp, extra } from '../state.svelte.ts';
  import { todayCourseDay } from '../mode.ts';
  import { masteryOf, MASTERIES, MASTERY_LABEL, AFTER_COURSE } from '../course.ts';

  loadComp().catch(() => {});
  const day = $derived(todayCourseDay());
  const info = $derived(comp.index?.day.get(Math.min(day, 60)));
  const counts = $derived.by(() => {
    const ix = comp.index;
    const c: Record<string, number> = { unlearned: 0, recognition: 0, recall: 0, use: 0, retention: 0 };
    if (!ix) return c;
    const ev = extra().ev ?? {};
    for (const it of ix.d.items) c[masteryOf(store.progress.items[it.id], ev[it.id])]++;
    return c;
  });
  const diag = $derived(extra().diag);
  const links = [
    { name: 'comp/dict', label: '教材辞典', sub: '単語・熟語・チャンク・図解・文法・会話・読解を検索', icon: 'search' },
    { name: 'comp/dict', label: 'お気に入り', sub: '★を付けた項目', icon: 'book', params: { fav: true } },
    { name: 'comp/weak', label: '弱点', sub: 'まちがえた・自信のない項目をまとめて復習', icon: 'review' },
    { name: 'comp/roadmap', label: '60日ロードマップ', sub: '日程と、各日の進み具合', icon: 'chart' },
  ];
</script>

<Page title="教材と記録">
  <PageHero ja="教材と記録 · 総合英語" en="Study *hub*" />

  <div class="day">
    <p class="dn en">{day >= AFTER_COURSE ? 'Done' : `Day ${day}`}<small>/ 60</small></p>
    <p class="dt">{day >= AFTER_COURSE ? '60日を修了しました。復習と辞典として使えます。' : info?.topic ?? ''}</p>
    <div class="bar" aria-label="日程 {Math.min(day, 60)} / 60"><span style:transform="scaleX({Math.min(day - 1, 60) / 60})"></span></div>
  </div>

  <h2 class="ui-h2">習熟度（1,064項目）</h2>
  <div class="mast">
    {#each MASTERIES as m}<div class="mc {m}"><b class="en"><Num value={counts[m]} /></b><span>{MASTERY_LABEL[m]}</span></div>{/each}
  </div>
  <p class="hint">認識＝見た・想起＝思い出せた・活用＝文で使えた・定着＝7日以上あけても正解。1回の正解では定着にしません。</p>

  <h2 class="ui-h2">教材・記録</h2>
  <div class="ui-group">
    {#each links as l}
      <button class="ui-item link" onclick={() => router.push({ name: l.name, params: l.params })}>
        <span class="ic"><Icon name={l.icon} size={20} /></span>
        <span class="ui-txt"><span>{l.label}</span><span class="ui-hint">{l.sub}</span></span>
        <Icon name="chevron" size={18} />
      </button>
    {/each}
  </div>

  <h2 class="ui-h2">診断</h2>
  <div class="ui-group">
    <button class="ui-item link" onclick={() => router.push({ name: 'comp/diag', params: { form: 'baseline' } })}>
      <span class="ui-txt"><span>Day0 診断（学習前）</span><span class="ui-hint">{diag?.baseline?.finishedAt ? '受験済み・結果を見る' : diag?.baseline ? '途中から再開' : '30問・約15分・任意'}</span></span>
      <Icon name="chevron" size={18} />
    </button>
    <button class="ui-item link" onclick={() => router.push({ name: 'comp/diag', params: { form: 'final' } })}>
      <span class="ui-txt"><span>Day60 診断（学習後）</span><span class="ui-hint">{diag?.final?.finishedAt ? '受験済み・結果を見る' : diag?.final ? '途中から再開' : 'Day0 と同じ分野で比べます'}</span></span>
      <Icon name="chevron" size={18} />
    </button>
  </div>

  <h2 class="ui-h2">学習レポート</h2>
  <div class="ui-group">
    <button class="ui-item link" onclick={() => router.push({ name: 'comp/report' })}>
      <span class="ui-txt"><span>学習レポートをコピー</span><span class="ui-hint">ChatGPT に貼り付けて、自由会話・自由作文の練習に使えます</span></span>
      <Icon name="chevron" size={18} />
    </button>
  </div>
  <p class="hint">教材の英文は全件の人手校閲がまだ終わっていません。気になる問題は学習中の 🚩 から報告できます（設定から書き出し）。</p>
</Page>

<style>
  .day {
    border: var(--panel-border);
    border-radius: 20px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .dn {
    font-size: 34px;
    font-weight: 850;
    letter-spacing: -0.02em;
  }
  .dn small {
    font-size: 14px;
    color: var(--text3);
    margin-left: 6px;
  }
  .dt {
    font-size: 15px;
    font-weight: 700;
  }
  .bar {
    height: 8px;
    border-radius: 4px;
    background: var(--fill);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    transform-origin: left center;
  }
  .mast {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }
  .mc {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 2px;
    border-radius: 14px;
    border: var(--card-border);
  }
  .mc b {
    font-size: 19px;
    font-weight: 850;
  }
  .mc span {
    font-size: 11px;
    font-weight: 700;
    color: var(--text2);
  }
  .mc.retention {
    border-color: var(--accent);
  }
  .mc.retention b {
    color: var(--accent);
  }
  .hint {
    font-size: 11px;
    color: var(--text3);
    margin-top: 8px;
  }
  .link {
    text-align: left;
    color: var(--text);
  }
  .ic {
    flex: none;
    color: var(--text2);
  }
</style>
