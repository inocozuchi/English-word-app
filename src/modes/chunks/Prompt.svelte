<script lang="ts">
  // 会話チャンクモードの問題文。回答後もこのまま表示し、解説を下にフェードインで出す（inlineExplain）。
  import EntryDetail from './components/EntryDetail.svelte';
  import type { ChunkQuestion } from './quiz.ts';
  import { stagger, bump } from '../../core/transitions.ts';
  import { reducedMotion } from '../../core/spring.ts';

  let { q, phase }: { q: ChunkQuestion; phase: 'ask' | 'reveal' } = $props();
  const s = $derived(q.data);
  const rv = $derived(phase === 'reveal');

  /** 解説: 上から順にフェードイン */
  function reveal(node: HTMLElement) {
    if (reducedMotion()) return;
    stagger([...node.children], { step: 60, distance: 8, delay: 140 });
  }
  /** 穴埋め: 正解が空所に「ポン」と入る */
  function popIn(node: HTMLElement) {
    bump(node, 1.25);
  }
  const parts = $derived(s.kind === 'entry' && s.pattern === 'c3' && s.entry.blank ? s.entry.blank.text.split('＿＿＿＿') : []);
</script>

<div class="p">
  {#if s.kind === 'entry' && s.pattern === 'c1'}
    <p class="ask">意味は？</p>
    <p class="big en">{s.entry.bare}</p>
  {:else if s.kind === 'entry' && s.pattern === 'c2'}
    <p class="ask">英語のかたまりは？</p>
    <p class="big ja">{s.entry.meaning}</p>
  {:else if s.kind === 'entry'}
    <p class="ask">入るのは？</p>
    <p class="sentence en">
      {parts[0]}{#if rv}<span class="filled" use:popIn>{s.fill}</span>{:else}<span class="blank" aria-label="空所"></span>{/if}{parts[1]}
    </p>
    <p class="exja">{s.entry.exJa}</p>
  {:else}
    <p class="ask">どっち？</p>
    <p class="big ja">{s.pair[s.side].ja}</p>
  {/if}

  {#if rv}
    <div class="rv" use:reveal>
      {#if s.kind === 'entry'}
        <EntryDetail entry={s.entry} showChunk={s.pattern !== 'c1'} showMeaning={s.pattern !== 'c2'} showExample={s.pattern !== 'c3'} />
      {:else}
        <div class="pairs">
          {#each ['a', 'b'] as const as side}
            <div class="side" class:me={side === s.side}>
              <p class="en pen">{s.pair[side].en}</p>
              <p class="pja">{s.pair[side].ja}</p>
            </div>
          {/each}
        </div>
        {#if s.pair.note}<p class="note">{s.pair.note}</p>{/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .p {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ask {
    font-size: 13px;
    font-weight: 600;
    color: var(--text3);
    letter-spacing: 0.04em;
  }
  .big {
    font-size: 30px;
    font-weight: 750;
    line-height: 1.3;
    letter-spacing: -0.015em;
  }
  .big.ja {
    font-size: 24px;
    letter-spacing: 0;
  }
  .sentence {
    font-size: 22px;
    font-weight: 600;
    line-height: 1.6;
  }
  .blank {
    display: inline-block;
    width: 4.2em;
    height: 1.05em;
    margin: 0 0.15em;
    vertical-align: -0.12em;
    border-bottom: 3px solid var(--ink);
  }
  .filled {
    display: inline-block;
    color: var(--accent);
    font-weight: 750;
    border-bottom: 3px solid var(--accent);
    margin: 0 0.1em;
  }
  .exja {
    font-size: 13px;
    color: var(--text2);
  }
  .rv {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }
  .pairs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .side {
    padding: 10px 12px;
    border-radius: var(--radius);
    border: 2px solid var(--line-strong);
  }
  .side.me {
    border-color: var(--accent);
  }
  .pen {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.35;
  }
  .pja {
    font-size: 12px;
    color: var(--text2);
    margin-top: 2px;
  }
  .note {
    font-size: 13px;
    color: var(--text2);
    line-height: 1.6;
  }
</style>
