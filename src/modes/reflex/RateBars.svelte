<script lang="ts">
  // グループ別の反射率（反射できる / 問題数）。薄い部分は一度でも答えた問題。タップでそのグループを集中
  import Num from '../../components/Num.svelte';
  import { store } from '../../core/store.svelte.ts';
  import { stagger } from '../../core/transitions.ts';
  import { router } from '../../core/router.svelte.ts';
  import { GROUPS, reflexRates } from './engine.ts';
  import { rx } from './state.svelte.ts';

  let { tappable = true }: { tappable?: boolean } = $props();
  const rows = $derived.by(() => {
    const m = reflexRates(rx.questions ?? [], store.progress.items);
    return GROUPS.filter((g) => m.has(g)).map((g) => ({ g, ...m.get(g)! }));
  });
  function grow(node: HTMLElement) {
    stagger([...node.querySelectorAll('.f')], { step: 40, distance: 0, delay: 100 });
  }
  function go(g: string) {
    if (tappable) router.push({ name: 'reflex/quiz', params: { seed: Date.now(), kind: 'normal', method: 'group', group: g } }, 'modal');
  }
</script>

<div class="rb" use:grow>
  {#each rows as r}
    <button class="r" class:tap={tappable} onclick={() => go(r.g)} disabled={!tappable} aria-label="{r.g} 反射率 {Math.round((r.reflex / r.total) * 100)}%">
      <span class="hd">
        <span class="nm">{r.g}</span>
        <span class="v en"><Num value={Math.round((r.reflex / r.total) * 100)} /><small>%</small><span class="n">{r.reflex}/{r.total}</span></span>
      </span>
      <span class="track">
        <span class="f tried" style:transform="scaleX({r.tried / r.total})"></span>
        <span class="f" style:transform="scaleX({r.reflex / r.total})"></span>
      </span>
    </button>
  {/each}
</div>

<style>
  .rb {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .r {
    display: flex;
    flex-direction: column;
    gap: 5px;
    text-align: left;
    color: var(--text);
  }
  .r:disabled {
    cursor: default;
  }
  .hd {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .nm {
    font-size: 14px;
    font-weight: 700;
  }
  .v {
    font-size: 16px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .v small {
    font-size: 11px;
  }
  .n {
    margin-left: 8px;
    font-size: 11px;
    color: var(--text3);
    font-weight: 600;
  }
  .track {
    position: relative;
    height: 10px;
    border-radius: 5px;
    background: var(--fill);
    overflow: hidden;
  }
  .f {
    position: absolute;
    inset: 0;
    transform-origin: left center;
    background: var(--accent);
    border-radius: 5px;
    transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .f.tried {
    background: var(--text3);
    opacity: 0.35;
  }
</style>
