<script lang="ts">
  // 優先度ごとの進み具合（A の習得済み 120／300 のような細いバー）。まだ解放されていない段階は鍵の印
  import { store, modeSettings } from '../../../core/store.svelte.ts';
  import { chk } from '../state.svelte.ts';
  import { masteredCount, unlockedPriorities, UNLOCK_RATE } from '../quiz.ts';
  import { PRIORITIES } from '../types.ts';
  import { chunksMode } from '../mode.ts';
  import { spring, SPRINGS, reducedMotion } from '../../../core/spring.ts';

  let { delay = 0 }: { delay?: number } = $props();
  const ix = $derived(chk.index);
  const unlocked = $derived(ix ? unlockedPriorities(ix, store.progress.items, modeSettings(chunksMode)) : []);
  const rows = $derived(ix ? PRIORITIES.map((p) => ({ p, ...masteredCount(ix, store.progress.items, p), name: ix.d.priorities[p] })) : []);

  function grow(node: HTMLElement) {
    if (reducedMotion()) return;
    const s = spring(SPRINGS.card);
    node.querySelectorAll<HTMLElement>('.fill').forEach((el, k) =>
      el.animate([{ transform: 'scaleX(0)' }, { transform: el.style.transform || 'scaleX(0)' }], { duration: s.duration, easing: s.easing, delay: delay + k * 70, fill: 'backwards' }),
    );
  }
</script>

<ul class="pb" use:grow>
  {#each rows as r}
    {@const open = unlocked.includes(r.p)}
    <li class:locked={!open}>
      <span class="p en">{r.p}</span>
      <span class="body">
        <span class="line">
          <span class="name">{r.name}</span>
          <span class="cnt en">{#if open}{r.done}<small>／{r.total}</small>{:else}<small>{r.p === 'B' ? 'A' : 'B'} の{Math.round(UNLOCK_RATE * 100)}%で解放</small>{/if}</span>
        </span>
        <span class="track"><span class="fill" style:transform="scaleX({r.total ? r.done / r.total : 0})"></span><span class="mark" style:left="{UNLOCK_RATE * 100}%"></span></span>
      </span>
    </li>
  {/each}
</ul>

<style>
  .pb {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .p {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 14px;
    border: 2px solid var(--ink);
  }
  .locked .p {
    border-color: var(--line-strong);
    color: var(--text3);
  }
  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .line {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 13px;
  }
  .name {
    font-weight: 600;
  }
  .locked .name {
    color: var(--text3);
  }
  .cnt {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .cnt small {
    font-weight: 500;
    color: var(--text3);
    font-size: 11px;
  }
  .track {
    position: relative;
    height: 6px;
    border-radius: 3px;
    background: var(--fill-strong);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--accent);
    transform-origin: left;
    border-radius: 3px;
  }
  .mark {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--bg);
  }
</style>
