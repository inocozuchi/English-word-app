<script lang="ts">
  // 部ごとの進み具合: 習得（箱4以上）/ 全問題。薄い部分は一度でも答えた問題
  import Num from '../../components/Num.svelte';
  import { store } from '../../core/store.svelte.ts';
  import { chapterStats } from './quiz.ts';
  import { partColor } from './partColor.ts';
  import { il, loadIndex } from './state.svelte.ts';
  import { stagger } from '../../core/transitions.ts';

  loadIndex().catch(() => {});
  const rows = $derived.by(() => {
    const ix = il.index;
    if (!ix) return [];
    const st = chapterStats(store.progress.items);
    return ix.parts.map((p) => {
      let total = 0, learned = 0, tried = 0;
      for (const c of ix.chapters) {
        if (c.part !== p.part) continue;
        total += c.question_count;
        const x = st.get(c.no);
        if (x) {
          learned += x.learned;
          tried += x.tried;
        }
      }
      return { part: p.part, name: p.name, total, learned, tried };
    });
  });
  function grow(node: HTMLElement) {
    stagger([...node.querySelectorAll('.fill')], { step: 60, distance: 0, delay: 120 });
  }
</script>

<div class="pb" use:grow>
  {#each rows as r}
    <div class="r" style:--part={partColor(r.part)}>
      <div class="hd">
        <span class="nm"><b class="en">{r.part}</b>{r.name}</span>
        <span class="v en"><Num value={r.learned} /><small> / {r.total.toLocaleString()}</small></span>
      </div>
      <div class="track" aria-label="第{r.part}部 習得 {r.learned} / {r.total}">
        <span class="fill tried" style:transform="scaleX({r.total ? r.tried / r.total : 0})"></span>
        <span class="fill" style:transform="scaleX({r.total ? r.learned / r.total : 0})"></span>
      </div>
    </div>
  {/each}
  <p class="lg"><span class="sw"></span>習得（3回続けて正解）<span class="sw t"></span>答えた</p>
</div>

<style>
  .pb {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .hd {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 5px;
  }
  .nm {
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: baseline;
    gap: 7px;
  }
  .nm b {
    font-size: 17px;
    font-weight: 850;
    color: color-mix(in srgb, var(--part) var(--part-mix), #fff);
  }
  .v {
    font-size: 15px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .v small {
    font-size: 12px;
    color: var(--text3);
    font-weight: 600;
  }
  .track {
    position: relative;
    height: 12px;
    border-radius: 6px;
    background: var(--fill);
    overflow: hidden;
  }
  .fill {
    position: absolute;
    inset: 0;
    transform-origin: left center;
    background: color-mix(in srgb, var(--part) var(--part-mix), #fff);
    border-radius: 6px;
    transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .fill.tried {
    opacity: 0.28;
  }
  .lg {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text3);
  }
  .sw {
    width: 14px;
    height: 8px;
    border-radius: 3px;
    background: var(--text2);
  }
  .sw.t {
    opacity: 0.35;
    margin-left: 8px;
  }
</style>
