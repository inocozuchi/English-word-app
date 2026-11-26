<script lang="ts">
  // 講ごとの復習ノート: 講のまとめ、扱うルール、フレーズ（マーキング付き）、その講の表（短縮形・同化・t の行方・知識）
  import Page from '../../../components/Page.svelte';
  import RuleBadge from '../components/RuleBadge.svelte';
  import ItemCard from '../components/ItemCard.svelte';
  import Marked from '../components/Marked.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { snd } from '../state.svelte.ts';

  let { no }: { no: number } = $props();
  const ix = $derived(snd.index!);
  const l = $derived(ix.lecture.get(no)!);
  const items = $derived(ix.d.items.filter((it) => it.lecture === no));
  const contractions = $derived(ix.d.contractions.filter((x) => x.lecture === no));
  const assims = $derived(ix.d.assimilations.filter((x) => x.lecture === no));
  const tfates = $derived(ix.d.tFate.filter((x) => x.lecture === no));
  const concepts = $derived(ix.d.concepts.filter((x) => x.lecture === no));
  const FATE_LINE = { flap: 'flap', elide: 'elide', absorb: 'assim', clear: null } as const;
</script>

<Page title="第{no}講">
  <p class="eyebrow-en">Lecture {String(no).padStart(2, '0')}</p>
  <h1 class="title">{l.title}</h1>
  {#if l.rules.length}<p class="rules">{#each l.rules as r}<RuleBadge rule={r} size="md" />{/each}</p>{/if}
  <p class="summary">{l.summary}</p>

  {#if items.length}
    <h2 class="ui-h2">フレーズ</h2>
    <div class="cards">
      {#each items as it}<ItemCard item={it} />{/each}
    </div>
  {/if}

  {#if contractions.length}
    <h2 class="ui-h2">短縮形</h2>
    <ul class="ui-group tbl">
      {#each contractions as c}
        <li><span class="en k">{c.form}</span><span class="en">{c.original.join(' / ')}</span><span class="kana">{c.kana}</span></li>
      {/each}
    </ul>
  {/if}

  {#if assims.length}
    <h2 class="ui-h2">同化の対応</h2>
    <ul class="ui-group tbl">
      {#each assims as a}
        <li><span class="en k">{a.combo} → {a.result}</span><span class="kana">{a.kana}</span><span class="en ex">{a.example}</span></li>
      {/each}
    </ul>
  {/if}

  {#if tfates.length}
    <h2 class="ui-h2">t の行方</h2>
    <ul class="ui-group tbl">
      {#each tfates as t}
        <li>
          <span class="k"><Marked words={t.words} target={t.target} targetLine={FATE_LINE[t.fate]} size="sm" /></span>
          <span class="fate">{ix.d.fateLabels[t.fate]}</span>
          <span class="ex">{t.why}</span>
        </li>
      {/each}
    </ul>
  {/if}

  {#if concepts.length}
    <h2 class="ui-h2">知識</h2>
    <ul class="ui-group tbl qa">
      {#each concepts as c}
        <li><span class="q">{c.q}</span><span class="a">{c.answer}</span><span class="ex">{c.why}</span></li>
      {/each}
    </ul>
  {/if}

  {#if l.rules.length}
    <h2 class="ui-h2">ルールのまとめ</h2>
    <div class="links">
      {#each l.rules as r}
        <button class="link press" onclick={() => router.push({ name: 'sound/rule', params: { id: r } })}><RuleBadge rule={r} /> のノートへ</button>
      {/each}
    </div>
  {/if}
</Page>

<style>
  .title {
    font-size: 24px;
    font-weight: 750;
    line-height: 1.35;
    margin: 4px 0 8px;
  }
  .rules {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .summary {
    font-size: 15px;
    line-height: 1.75;
    padding: 12px 14px;
    border: var(--frame) solid var(--ink);
    border-radius: var(--radius);
  }
  .cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tbl {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .tbl li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 11px 16px;
  }
  .tbl li + li {
    border-top: 0.5px solid var(--line);
  }
  .k {
    font-size: 17px;
    font-weight: 700;
  }
  .kana {
    font-weight: 700;
    color: var(--accent);
    font-size: 14px;
  }
  .ex {
    font-size: 13px;
    color: var(--text2);
  }
  .fate {
    font-size: 14px;
    font-weight: 650;
  }
  .qa .q {
    font-size: 14px;
    font-weight: 650;
  }
  .qa .a {
    font-size: 14px;
    color: var(--accent);
    font-weight: 650;
  }
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    border-radius: 999px;
    background: var(--panel-bg);
    border: var(--panel-border);
    font-size: 13px;
    font-weight: 600;
  }
</style>
