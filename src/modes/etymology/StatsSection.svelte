<script lang="ts">
  // 語源デッキの学習記録（単語の習得状況・苦手な単語・章ごとの正答率）
  import { router } from '../../core/router.svelte.ts';
  import { store } from '../../core/store.svelte.ts';
  import { ety } from './state.svelte.ts';
  import { wordStatus } from './summary.ts';
  import type { Word } from './types.ts';

  const p = $derived(store.progress);

  const words = $derived.by(() => {
    const ix = ety.index;
    if (!ix) return null;
    let learned = 0, learning = 0;
    for (const w of ix.ds.words) {
      const s = wordStatus(p.items, w);
      if (s === 'learned') learned++;
      else if (s === 'learning') learning++;
    }
    return { learned, learning, total: ix.ds.words.length };
  });

  const chapters = $derived.by(() => {
    const ix = ety.index;
    if (!ix) return [];
    return ix.ds.chapters.map((c) => {
      let seen = 0, ok = 0;
      for (const w of ix.wordsByChapter.get(c.no)!)
        for (const f of ['ej:', 'je:']) {
          const s = p.items[f + w.w];
          if (s) {
            seen += s.seen;
            ok += s.correct;
          }
        }
      return { c, seen, rate: seen ? ok / seen : null };
    });
  });

  // 苦手な単語: まちがえた回数が多く、正答率が低い順
  const weak = $derived.by(() => {
    const ix = ety.index;
    if (!ix) return [];
    const list: { w: Word; wrong: number; score: number }[] = [];
    for (const w of ix.ds.words) {
      let wrong = 0, seen = 0, lastOk = true;
      for (const f of ['ej:', 'je:']) {
        const s = p.items[f + w.w];
        if (s) {
          wrong += s.wrong;
          seen += s.seen;
          if (!s.lastOk) lastOk = false;
        }
      }
      if (!wrong) continue;
      list.push({ w, wrong, score: wrong * 2 - (seen - wrong) + (lastOk ? 0 : 3) });
    }
    return list.sort((a, b) => b.score - a.score).slice(0, 20);
  });
</script>

{#if words}
  <h2 class="ui-h2">単語</h2>
  <div class="card">
    <div class="prog">
      <span class="seg learned" style:flex={words.learned}></span>
      <span class="seg learning" style:flex={words.learning}></span>
      <span class="seg rest" style:flex={words.total - words.learned - words.learning}></span>
    </div>
    <span class="s"><b class="acc">覚えた {words.learned}</b> · 学習中 {words.learning} · 全 {words.total}語</span>
  </div>
{/if}

{#if weak.length}
  <h2 class="ui-h2">苦手な単語</h2>
  <ul class="ui-group list">
    {#each weak as x}
      <li><button class="row press" onclick={() => router.push({ name: 'ety/word', params: { w: x.w.w } })}>
        <span class="en ww">{x.w.w}</span>
        <span class="wm">{x.w.defs[0]?.ja}</span>
        <span class="wc">✕{x.wrong}</span>
      </button></li>
    {/each}
  </ul>
{/if}

{#if chapters.some((c) => c.seen)}
  <h2 class="ui-h2">章ごとの正答率</h2>
  <ul class="chs">
    {#each chapters as x}
      <li>
        <span class="cn">{x.c.no}. {x.c.title}</span>
        <span class="track"><span class="fill" style:transform="scaleX({x.rate ?? 0})"></span></span>
        <span class="cr en">{x.rate === null ? '–' : Math.round(x.rate * 100) + '%'}</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    border-radius: var(--radius-lg);
    background: var(--panel-bg);
    border: var(--panel-border);
  }
  .s {
    font-size: 12px;
    color: var(--text3);
  }
  .acc {
    color: var(--accent);
    font-weight: 600;
  }
  .prog {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: var(--fill-strong);
    gap: 2px;
  }
  .seg.learned {
    background: var(--accent);
  }
  .seg.learning {
    background: color-mix(in srgb, var(--accent) 40%, transparent);
  }
  .seg.rest {
    background: transparent;
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
    align-items: baseline;
    gap: 10px;
    padding: 13px 16px 13px 18px;
    text-align: left;
  }
  .ww {
    font-weight: 650;
    font-size: 17px;
  }
  .wm {
    flex: 1;
    font-size: 13px;
    color: var(--text2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .wc {
    font-size: 12px;
    color: var(--text3);
  }
  .chs {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .chs li {
    display: grid;
    grid-template-columns: 1fr 70px 40px;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }
  .cn {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .track {
    height: 5px;
    border-radius: 3px;
    background: var(--fill-strong);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--accent);
    transform-origin: left;
  }
  .cr {
    text-align: right;
    color: var(--text2);
    font-variant-numeric: tabular-nums;
  }
</style>
