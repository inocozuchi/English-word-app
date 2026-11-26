<script lang="ts">
  // 弱点: まちがえた・自信のない（ヒント・あやしい）・何度もまちがえた項目。まとめて復習できる
  import Page from '../../../components/Page.svelte';
  import PageHero from '../../../components/PageHero.svelte';
  import Icon from '../../../components/Icon.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { store } from '../../../core/store.svelte.ts';
  import { comp, loadComp, extra } from '../state.svelte.ts';
  import { masteryOf, MASTERY_LABEL, STAGE_LABEL, stageOf, type Stage } from '../course.ts';

  loadComp().catch(() => {});
  const list = $derived.by(() => {
    const ix = comp.index;
    if (!ix) return [];
    const ev = extra().ev ?? {};
    return Object.entries(store.progress.items)
      .filter(([k, st]) => !st.lastOk || st.conf === 'low' || (ev[k]?.w ?? 0) >= 2)
      .sort(([, a], [, b]) => b.last - a.last)
      .map(([k, st]) => {
        const it = ix.item.get(k), q = ix.q.get(k);
        return { k, title: it?.english ?? q?.prompt.split('\n').at(-1) ?? k, sub: it?.japanese ?? q?.acceptedAnswers[0] ?? '', m: masteryOf(st, ev[k]), why: !st.lastOk ? 'まちがえた' : st.conf === 'low' ? '自信なし' : '何度もまちがえた' };
      });
  });
  const stages = $derived.by(() => {
    const out: { st: Stage; rate: number; seen: number }[] = [];
    for (const [tag, v] of Object.entries(store.progress.tags)) if (tag.startsWith('st:') && v.seen >= 5) out.push({ st: tag.slice(3) as Stage, rate: v.correct / v.seen, seen: v.seen });
    return out.sort((a, b) => a.rate - b.rate);
  });
  void stageOf;
</script>

<Page title="弱点">
  <PageHero ja="弱点 · 総合英語" en="Weak *spots*" />
  {#if stages.length}
    <h2 class="ui-h2">段階ごとの正答率（低い順）</h2>
    <ul class="sts">
      {#each stages as x}<li><span>{STAGE_LABEL[x.st]}</span><span class="track"><span style:transform="scaleX({x.rate})"></span></span><b class="en">{Math.round(x.rate * 100)}%</b></li>{/each}
    </ul>
    <p class="hint">正答率の低い段階と、診断で低かった分野は、毎日の復習で先に出ます。</p>
  {/if}
  <h2 class="ui-h2">弱点の項目 <span class="n">{list.length}</span></h2>
  {#if list.length}
    <button class="pri press" onclick={() => router.push({ name: 'comp/session', params: { kind: 'review', seed: Date.now(), keys: list.map((x) => x.k) } }, 'modal')}>弱点をまとめて復習（最大20問）</button>
  {/if}
  <ul class="list">
    {#each list.slice(0, 150) as x (x.k)}
      <li>
        <button class="row press" onclick={() => router.push({ name: 'comp/entry', params: { id: x.k } })}>
          <span class="main"><span class="t en">{x.title}</span><span class="s">{x.sub}</span></span>
          <span class="tg">{x.why}<br />{MASTERY_LABEL[x.m]}</span>
          <Icon name="chevron" size={16} />
        </button>
      </li>
    {:else}
      <li class="empty">まだありません。まちがえた・自信のない項目がここに入ります。</li>
    {/each}
  </ul>
</Page>

<style>
  .sts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .sts li {
    display: grid;
    grid-template-columns: 8em 1fr 3em;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }
  .track {
    height: 6px;
    border-radius: 3px;
    background: var(--fill);
    overflow: hidden;
  }
  .track span {
    display: block;
    height: 100%;
    background: var(--accent);
    transform-origin: left center;
  }
  .sts b {
    text-align: right;
  }
  .hint {
    font-size: 11px;
    color: var(--text3);
    margin-top: 6px;
  }
  .n {
    margin-left: 6px;
    color: var(--text3);
  }
  .pri {
    width: 100%;
    min-height: 54px;
    border-radius: 18px;
    font-weight: 800;
    background: var(--accent);
    color: var(--on-accent);
    border: var(--frame) solid var(--ink);
    margin-bottom: 10px;
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
    gap: 10px;
    padding: 10px 12px;
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
  .t {
    font-weight: 800;
  }
  .s {
    font-size: 13px;
    color: var(--text2);
  }
  .tg {
    flex: none;
    font-size: 11px;
    color: var(--text3);
    text-align: right;
  }
  .empty {
    padding: 20px 0;
    text-align: center;
    color: var(--text2);
    font-size: 13px;
  }
</style>
