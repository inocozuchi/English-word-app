<script lang="ts">
  // 絞り込み: 章を選ぶ（複数）。部ごとにまとめてオン・オフできる
  import Page from '../../../components/Page.svelte';
  import PageHero from '../../../components/PageHero.svelte';
  import SearchField from '../../../components/SearchField.svelte';
  import { modeSettings, updateModeSettings } from '../../../core/store.svelte.ts';
  import { imagelinkMode } from '../mode.ts';
  import { partColor } from '../partColor.ts';
  import { il, loadIndex } from '../state.svelte.ts';

  loadIndex().catch(() => {});
  const s = $derived(modeSettings(imagelinkMode));
  const sel = $derived(new Set(s.chapters));
  let query = $state('');
  const groups = $derived(
    (il.index?.parts ?? []).map((p) => ({
      ...p,
      chapters: il.index!.chapters.filter((c) => c.part === p.part && (!query || `${c.no} ${c.title} ${c.subtitle ?? ''}`.includes(query.trim()))),
    })),
  );
  function save(next: Set<number>) {
    const chapters = [...next].sort((a, b) => a - b);
    updateModeSettings(imagelinkMode, { chapters: chapters.length === il.index?.chapters.length ? [] : chapters });
    imagelinkMode.load({ ...s, chapters });
  }
  function toggle(no: number) {
    const next = new Set(sel);
    if (next.has(no)) next.delete(no);
    else next.add(no);
    save(next);
  }
  function togglePart(nos: number[]) {
    const next = new Set(sel);
    const all = nos.every((n) => next.has(n));
    for (const n of nos) all ? next.delete(n) : next.add(n);
    save(next);
  }
</script>

<Page title="章を選ぶ">
  <PageHero ja="絞り込み · 章" en="Pick *chapters*" />
  <p class="lead">{sel.size ? `${sel.size}章を選択中` : '選んでいないときは、すべての章から出します'}{#if sel.size}<button class="clear" onclick={() => save(new Set())}>選択を外す</button>{/if}</p>
  <SearchField bind:value={query} placeholder="章の名前・番号で探す" />
  {#each groups as g (g.part)}
    {#if g.chapters.length}
      {@const nos = g.chapters.map((c) => c.no)}
      <h2 class="ui-h2 ph" style:--part={partColor(g.part)}>
        <span class="pn en">{g.part}</span>{g.name}
        <button class="pall" onclick={() => togglePart(nos)}>{nos.every((n) => sel.has(n)) ? 'まとめて外す' : 'まとめて選ぶ'}</button>
      </h2>
      <div class="ui-group">
        {#each g.chapters as c (c.no)}
          {@const on = sel.has(c.no)}
          <button class="ui-item ch" aria-pressed={on} onclick={() => toggle(c.no)}>
            <span class="check" class:on>{#if on}✓{/if}</span>
            <span class="ui-txt"><span class="ct"><b class="en">{c.no}</b> {c.title}</span></span>
          </button>
        {/each}
      </div>
    {/if}
  {/each}
</Page>

<style>
  .lead {
    font-size: 13px;
    color: var(--text2);
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .clear {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
  }
  .ph {
    align-items: center;
  }
  .pn {
    color: color-mix(in srgb, var(--part) var(--part-mix), #fff);
    font-weight: 850;
    margin-right: 6px;
  }
  .pall {
    margin-left: auto;
    font-size: 12px;
    font-weight: 700;
    color: var(--accent);
  }
  .ch {
    min-height: 48px;
    justify-content: flex-start !important;
    text-align: left;
  }
  .ct {
    font-size: 14px;
  }
  .ct b {
    display: inline-block;
    min-width: 2em;
    color: var(--text2);
  }
  .check {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 7px;
    border: 1.5px solid var(--text3);
    display: grid;
    place-items: center;
    font-size: 13px;
    font-weight: 800;
    color: var(--on-accent);
  }
  .check.on {
    background: var(--accent);
    border-color: var(--accent);
  }
</style>
