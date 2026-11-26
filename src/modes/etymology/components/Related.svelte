<script lang="ts">
  // 同じ語根を持つ関連語。綴りを接頭辞・語根・接尾辞の色で分ける（写真の import / export / transport のように）
  import Icon from '../../../components/Icon.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { ety } from '../state.svelte.ts';
  import ColorWord from './ColorWord.svelte';
  import type { Word } from '../types.ts';

  let { word, limit = 8, tappable = true, compact = false }: { word: Word; limit?: number; tappable?: boolean; compact?: boolean } = $props();
  const ix = ety.index!;
  const root = $derived(ix.root.get(word.roots[0]));
  const list = $derived(
    (root?.words ?? [])
      .filter((id) => id !== word.id && !root!.refs.includes(id))
      .map((id) => ix.ds.words[id])
      .slice(0, limit),
  );
</script>

{#if list.length && root}
  {#if compact}
    <p class="compact">
      <span class="h">同じ語根 <b class="en">{root.root}</b></span>
      {#each list as w, i}{#if i > 0}<span class="dot">·</span>{/if}<span class="cw en"><ColorWord word={w.w} parts={w.breakdown} rootColor={false} /></span>{/each}
    </p>
  {:else}
    <ul class="rel">
      {#each list as w}
        <li>
          <button class="row" class:press={tappable} disabled={!tappable} onclick={() => router.push({ name: 'ety/word', params: { w: w.w } })}>
            <span class="w en"><ColorWord word={w.w} parts={w.breakdown} rootColor={false} /></span>
            <span class="m">{w.defs[0]?.ja ?? ''}</span>
            {#if tappable}<span class="chev"><Icon name="chevron" size={16} /></span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .rel {
    list-style: none;
    margin: 0;
    padding: 0;
    border: var(--card-border);
    border-radius: 16px;
  }
  .rel li + li {
    border-top: 1.5px solid var(--line);
  }
  .row {
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 11px 14px;
    text-align: left;
    color: var(--text);
  }
  .row:disabled {
    cursor: default;
  }
  .w {
    flex: none;
    font-size: 18px;
    font-weight: 700;
  }
  .m {
    flex: 1;
    min-width: 0;
    text-align: right;
    font-size: 14px;
    color: var(--text2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chev {
    align-self: center;
    color: var(--text3);
  }
  .compact {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 7px;
    font-size: 15px;
  }
  .h {
    font-size: 11px;
    font-weight: 700;
    color: var(--text3);
    margin-right: 2px;
  }
  .h b {
    color: var(--text2);
  }
  .cw {
    font-weight: 700;
  }
  .dot {
    color: var(--text3);
  }
</style>
