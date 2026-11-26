<script lang="ts">
  import { ety } from '../state.svelte.ts';
  import Page from '../../../components/Page.svelte';
  import Icon from '../../../components/Icon.svelte';
  import { modeSettings, updateModeSettings } from '../../../core/store.svelte.ts';
  import { etymologyMode } from '../mode.ts';

  const ix = ety.index!;
  const ex = $derived(new Set(modeSettings(etymologyMode).excludedRoots));
  let open = $state<Record<number, boolean>>({});

  function setRoots(ids: string[], include: boolean) {
    const next = new Set(modeSettings(etymologyMode).excludedRoots);
    for (const id of ids) include ? next.delete(id) : next.add(id);
    updateModeSettings(etymologyMode, { excludedRoots: [...next] });
  }
  function chState(roots: string[]) {
    const n = roots.filter((r) => !ex.has(r)).length;
    return n === 0 ? 'none' : n === roots.length ? 'all' : 'some';
  }
  const total = $derived(ix.ds.roots.length - ex.size);
</script>

<Page title="出題範囲">
  <p class="eyebrow-en">Scope</p>
  <h1 class="title">出題範囲</h1>
  <p class="lead">{total} / {ix.ds.roots.length} 語源を出題します</p>
  <div class="bulk">
    <button class="pill press" onclick={() => updateModeSettings(etymologyMode, { excludedRoots: [] })}>すべて選択</button>
    <button class="pill press" onclick={() => setRoots(ix.ds.roots.map((r) => r.id), false)}>すべて解除</button>
  </div>

  <div class="list">
    {#each ix.ds.chapters as c}
      {@const st = chState(c.roots)}
      <div class="chapter">
        <div class="ch-row">
          <button class="check {st}" onclick={() => setRoots(c.roots, st !== 'all')} aria-label="{c.title}を切り替え">
            {#if st === 'all'}<Icon name="check" size={16} stroke={3} />{:else if st === 'some'}<span class="dash"></span>{/if}
          </button>
          <button class="ch-title" onclick={() => (open[c.no] = !open[c.no])}>
            <span class="no en">{c.no}</span>
            <span class="t">{c.title}</span>
            <span class="chev" class:open={open[c.no]}><Icon name="chevron" size={18} /></span>
          </button>
        </div>
        {#if open[c.no]}
          <div class="roots">
            {#each c.roots as id}
              {@const r = ix.root.get(id)!}
              <button class="root-row" onclick={() => setRoots([id], ex.has(id))}>
                <span class="check small {ex.has(id) ? 'none' : 'all'}">{#if !ex.has(id)}<Icon name="check" size={13} stroke={3} />{/if}</span>
                <span class="en rr">{r.root}</span>
                <span class="rm">{r.meaning}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</Page>

<style>
  .title {
    font-size: 32px;
    font-weight: 750;
    margin: 4px 0 4px;
  }
  .lead {
    color: var(--text2);
    font-size: 14px;
  }
  .bulk {
    display: flex;
    gap: 8px;
    margin: 14px 0 18px;
  }
  .pill {
    padding: 7px 14px;
    border-radius: 999px;
    background: var(--fill);
    font-size: 14px;
  }
  .list {
    border-radius: var(--radius-lg);
    background: var(--panel-bg);
    border: var(--panel-border);
    overflow: hidden;
  }
  .chapter + .chapter {
    border-top: 0.5px solid var(--line);
  }
  .ch-row {
    display: flex;
    align-items: center;
    padding-left: 14px;
  }
  .check {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    border: 1.5px solid var(--text3);
    color: var(--on-accent);
    transition: background-color 0.15s, border-color 0.15s;
  }
  .check.all,
  .check.some {
    background: var(--accent);
    border-color: var(--accent);
  }
  .check.small {
    width: 22px;
    height: 22px;
    border-radius: 7px;
  }
  .dash {
    width: 10px;
    height: 2.5px;
    border-radius: 2px;
    background: var(--on-accent);
  }
  .ch-title {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 56px;
    padding: 8px 14px 8px 12px;
    text-align: left;
  }
  .no {
    color: var(--text3);
    font-weight: 600;
    width: 1.4em;
    text-align: right;
  }
  .t {
    flex: 1;
    font-size: 15px;
    font-weight: 500;
  }
  .chev {
    color: var(--text3);
    display: grid;
    transition: transform 0.25s;
  }
  .chev.open {
    transform: rotate(90deg);
  }
  .roots {
    padding: 0 0 8px 54px;
  }
  .root-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding-right: 16px;
    text-align: left;
  }
  .rr {
    font-weight: 600;
    font-size: 15px;
  }
  .rm {
    flex: 1;
    font-size: 13px;
    color: var(--text2);
  }
</style>
