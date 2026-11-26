<script lang="ts">
  import PageHero from '../../../components/PageHero.svelte';
  // 復習ノート（音声変化モードの単語帳に当たる画面）: 講ごと・ルールごとに見る
  import Page from '../../../components/Page.svelte';
  import Icon from '../../../components/Icon.svelte';
  import Segmented from '../../../components/Segmented.svelte';
  import RuleBadge from '../components/RuleBadge.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { snd, loadSound, ruleColor } from '../state.svelte.ts';

  loadSound();
  let tab = $state<'lecture' | 'rule'>('lecture');
  const ix = $derived(snd.index);
  const countBy = (pred: (it: NonNullable<typeof ix>['d']['items'][number]) => boolean) => ix?.d.items.filter(pred).length ?? 0;
</script>

<Page title="復習ノート">
  <PageHero ja="復習ノート" en="Sound *notes*" />
  <div class="seg">
    <Segmented options={[{ value: 'lecture', label: '講ごと' }, { value: 'rule', label: 'ルールごと' }]} value={tab} onchange={(v) => (tab = v)} />
  </div>

  {#if !ix}
    <p class="loading">読み込み中…</p>
  {:else if tab === 'lecture'}
    <ul class="ui-group list">
      {#each ix.d.lectures as l}
        <li><button class="row press" onclick={() => router.push({ name: 'sound/lecture', params: { no: l.no } })}>
          <span class="no en">{l.no}</span>
          <span class="main">
            <span class="t">{l.title}</span>
            <span class="meta">
              {#each l.rules as r}<RuleBadge rule={r} />{/each}
              <span class="cnt">{countBy((it) => it.lecture === l.no)}フレーズ</span>
            </span>
          </span>
          <span class="chev"><Icon name="chevron" size={18} /></span>
        </button></li>
      {/each}
    </ul>
  {:else}
    <ul class="ui-group list">
      {#each ix.d.rules as r}
        <li><button class="row press" onclick={() => router.push({ name: 'sound/rule', params: { id: r.id } })}>
          <span class="dot" style:--c={ruleColor(r.id)}></span>
          <span class="main">
            <span class="t">{r.name}<span class="en sub">{r.nameEn}</span></span>
            <span class="sum">{r.summary}</span>
            <span class="cnt">{countBy((it) => it.rules.includes(r.id))}フレーズ</span>
          </span>
          <span class="chev"><Icon name="chevron" size={18} /></span>
        </button></li>
      {/each}
    </ul>
  {/if}
</Page>

<style>
  .seg {
    margin: 10px 0 18px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list li + li {
    border-top: 0.5px solid var(--line);
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 12px 12px 16px;
    text-align: left;
  }
  .no {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 15px;
    background: var(--fill-strong);
    display: grid;
    place-items: center;
    font-size: 14px;
    font-weight: 700;
    color: var(--text2);
  }
  .dot {
    flex: none;
    width: 14px;
    height: 14px;
    margin: 0 8px;
    border-radius: 50%;
    background: var(--c);
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .t {
    font-size: 15px;
    font-weight: 650;
  }
  .sub {
    margin-left: 8px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text3);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }
  .sum {
    font-size: 12px;
    color: var(--text2);
    line-height: 1.5;
  }
  .cnt {
    font-size: 11px;
    color: var(--text3);
  }
  .chev {
    flex: none;
    color: var(--text3);
    display: grid;
  }
  .loading {
    color: var(--text3);
    text-align: center;
    padding: 40px 0;
  }
</style>
