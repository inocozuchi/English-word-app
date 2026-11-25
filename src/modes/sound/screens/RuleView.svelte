<script lang="ts">
  // ルールごとの復習ノート（早見表）: ルールのまとめ、症状、そのルールのフレーズ一覧
  import Page from '../../../components/Page.svelte';
  import ItemCard from '../components/ItemCard.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { store } from '../../../core/store.svelte.ts';
  import { snd, ruleColor } from '../state.svelte.ts';
  import type { RuleId } from '../types.ts';

  let { id }: { id: RuleId } = $props();
  const ix = $derived(snd.index!);
  const r = $derived(ix.rule.get(id)!);
  const items = $derived(ix.d.items.filter((it) => it.rules.includes(id)));
  const symptoms = $derived(ix.d.symptoms.filter((x) => x.rule === id));
  const stat = $derived(store.progress.tags[id]);
</script>

<Page title={r.name}>
  <p class="eyebrow-en">Rule · {r.nameEn}</p>
  <h1 class="title" style:--c={ruleColor(id)}><i></i>{r.name}</h1>
  <p class="summary" style:--c={ruleColor(id)}>{r.summary}</p>
  <p class="meta">
    {#if stat?.seen}正答率 {Math.round((stat.correct / stat.seen) * 100)}%（{stat.seen}問）{:else}まだ出題されていません{/if}
    · 第{r.lectures.join('・')}講
  </p>

  {#if symptoms.length}
    <h2 class="ui-h2">こんな聞こえ方なら、まず疑う</h2>
    <ul class="ui-group sym">
      {#each symptoms as s}<li>{s.symptom}</li>{/each}
    </ul>
  {/if}

  <h2 class="ui-h2">フレーズ <span class="n">{items.length}</span></h2>
  <div class="cards">
    {#each items as it}<ItemCard item={it} />{/each}
  </div>

  <div class="links">
    {#each r.lectures as no}
      <button class="link press" onclick={() => router.push({ name: 'sound/lecture', params: { no } })}>第{no}講のノートへ</button>
    {/each}
  </div>
</Page>

<style>
  .title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 30px;
    font-weight: 800;
    margin: 4px 0 10px;
  }
  .title i {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--c);
  }
  .summary {
    font-size: 15px;
    line-height: 1.75;
    padding: 12px 14px;
    border-radius: var(--radius);
    border: var(--frame) solid var(--c);
    background: color-mix(in srgb, var(--c) 7%, transparent);
  }
  .meta {
    margin-top: 8px;
    font-size: 12px;
    color: var(--text3);
  }
  .sym {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .sym li {
    padding: 11px 16px;
    font-size: 14px;
    line-height: 1.6;
  }
  .sym li + li {
    border-top: 0.5px solid var(--line);
  }
  .n {
    color: var(--text3);
  }
  .cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }
  .link {
    padding: 8px 12px;
    border-radius: 999px;
    background: var(--surface);
    font-size: 13px;
    font-weight: 600;
  }
</style>
