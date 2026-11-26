<script lang="ts">
  // 総合英語の学習記録: 習熟度の分布・段階ごとの正答率・記録の内訳（自動・自己採点・ヒント・音声なし）
  import Icon from '../../components/Icon.svelte';
  import { router } from '../../core/router.svelte.ts';
  import { store } from '../../core/store.svelte.ts';
  import { comp, loadComp, extra } from './state.svelte.ts';
  import { masteryOf, MASTERIES, MASTERY_LABEL, STAGES, STAGE_LABEL } from './course.ts';

  loadComp().catch(() => {});
  const dist = $derived.by(() => {
    const ix = comp.index;
    const c = Object.fromEntries(MASTERIES.map((m) => [m, 0])) as Record<string, number>;
    if (!ix) return c;
    for (const it of ix.d.items) c[masteryOf(store.progress.items[it.id], extra().ev?.[it.id])]++;
    return c;
  });
  const total = $derived(Object.values(dist).reduce((a, b) => a + b, 0) || 1);
  const stages = $derived(STAGES.map((s) => ({ s, v: store.progress.tags['st:' + s] })).filter((x) => x.v?.seen));
  const t = $derived(store.progress.tags);
</script>

<h2 class="ui-h2">習熟度</h2>
<div class="dist" aria-label="習熟度の分布">
  {#each MASTERIES as m}{#if dist[m]}<span class="seg {m}" style:flex-grow={dist[m]} title="{MASTERY_LABEL[m]} {dist[m]}"></span>{/if}{/each}
</div>
<ul class="legend">
  {#each MASTERIES as m}<li><span class="sw {m}"></span>{MASTERY_LABEL[m]} <b class="en">{dist[m]}</b><small>（{Math.round((dist[m] / total) * 100)}%）</small></li>{/each}
</ul>

{#if stages.length}
  <h2 class="ui-h2">段階ごとの正答率</h2>
  <ul class="sts">
    {#each stages as x}<li><span>{STAGE_LABEL[x.s]}</span><span class="track"><span style:transform="scaleX({x.v.correct / x.v.seen})"></span></span><b class="en">{Math.round((x.v.correct / x.v.seen) * 100)}%</b></li>{/each}
  </ul>
  <p class="hint">自己採点 {t.self?.seen ?? 0} · ヒントあり {t.hint?.seen ?? 0} · 音声なし {extra().audioNA ?? 0}（音声なしは正答率に入れません）</p>
{/if}
<button class="all press" onclick={() => router.push({ name: 'comp/hub' })}>教材と記録（辞典・弱点・ロードマップ・診断）<Icon name="chevron" size={18} /></button>

<style>
  .dist {
    display: flex;
    height: 14px;
    border-radius: 7px;
    overflow: hidden;
    background: var(--fill);
    gap: 2px;
  }
  .seg,
  .sw {
    background: var(--fill-strong);
  }
  .recognition {
    background: var(--text3);
  }
  .recall {
    background: color-mix(in srgb, var(--accent) 45%, var(--bg));
  }
  .use {
    background: color-mix(in srgb, var(--accent) 75%, var(--bg));
  }
  .retention {
    background: var(--accent);
  }
  .legend {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    font-size: 12px;
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .sw {
    width: 10px;
    height: 10px;
    border-radius: 3px;
  }
  .legend small {
    color: var(--text3);
  }
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
    grid-template-columns: 9em 1fr 3em;
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
    margin-top: 8px;
  }
  .all {
    margin-top: 12px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    padding: 0 16px;
    border-radius: 16px;
    border: var(--panel-border);
    font-weight: 700;
    text-align: left;
  }
</style>
