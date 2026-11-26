<script lang="ts">
  // 語の成り立ちの図: 単語を色分けし（接頭辞＝青・語根＝黄・接尾辞＝緑）、パーツを箱で並べ、
  // 意味をつないでコアイメージへ（中に ＋ 回る → 巻き込む）。kind はビルド時に morph.ts で付けたもの。
  // animate（クイズの解説）では、箱が左から1つずつ組み上がり、最後にコアイメージが出る。
  import type { Part } from '../types.ts';
  import { KIND_LABEL, segments, type MorphPart } from '../morph.ts';
  import { spring, SPRINGS, reducedMotion } from '../../../core/spring.ts';

  let {
    word,
    parts,
    core = null,
    animate = false,
    showWord = true,
  }: { word: string; parts: Part[]; core?: string | null; animate?: boolean; showWord?: boolean } = $props();

  const mp = $derived(parts.map((p) => ({ ...p, kind: p.kind ?? 'root' }) as MorphPart));
  const boxes = $derived(mp.filter((p) => p.kind !== 'link'));
  const segs = $derived(showWord ? segments(word, mp) : null);
  /** 意味をつないだ式（空の意味は飛ばす） */
  // 補った接尾辞の働き（名詞化など）は箱にだけ出し、式には入れない
  const flow = $derived(boxes.filter((p) => !p.added).map((p) => p.meaning.replace(/^=\s*\S+\s*/, '')).filter(Boolean));

  function build(node: HTMLElement) {
    if (!animate || reducedMotion()) return;
    const pop = spring(SPRINGS.pop);
    const items = [...node.querySelectorAll<HTMLElement>('[data-step]')];
    items.forEach((el, k) => {
      const d = 180 + k * 110;
      const isBox = el.classList.contains('box');
      el.animate([{ transform: isBox ? 'translateY(10px) scale(0.85)' : 'translateX(-8px)' }, { transform: 'none' }], {
        duration: pop.duration,
        easing: pop.easing,
        delay: d,
        fill: 'backwards',
      });
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: d, fill: 'backwards' });
    });
  }
</script>

{#if boxes.length}
  <div class="morph" use:build>
    {#if segs}
      <p class="word en" aria-label={word}>{#each segs as s}<span class="seg {s.kind}">{s.text}</span>{/each}</p>
    {/if}
    <div class="boxes" style:--n={Math.min(boxes.length, 3)}>
      {#each boxes as p}
        <div class="box {p.kind}" data-step>
          <span class="lbl">{KIND_LABEL[p.kind]}</span>
          <span class="pt en">{p.part}</span>
          <span class="mn" class:added={p.added}>{p.meaning || '—'}</span>
        </div>
      {/each}
    </div>
    {#if flow.length > 1 || core}
      <p class="flow" data-step>
        {#each flow as f, i}{#if i > 0}<span class="op">＋</span>{/if}<span>{f}</span>{/each}
        {#if core}<span class="op">→</span><b class="core">{core}</b>{/if}
      </p>
    {/if}
  </div>
{/if}

<style>
  .morph {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .word {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  .seg.pre {
    color: var(--m-pre);
  }
  .seg.root {
    color: var(--m-root);
  }
  .seg.suf {
    color: var(--m-suf);
  }
  .seg.link {
    color: var(--text3);
  }
  .boxes {
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: 8px;
  }
  .box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 9px 6px 10px;
    border-radius: 16px;
    text-align: center;
    min-width: 0;
  }
  .box.pre {
    background: var(--m-pre-bg);
    color: var(--m-pre);
  }
  .box.root {
    background: var(--m-root-bg);
    color: var(--m-root);
  }
  .box.suf {
    background: var(--m-suf-bg);
    color: var(--m-suf);
  }
  .lbl {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    opacity: 0.85;
  }
  .pt {
    font-size: 22px;
    font-weight: 800;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }
  .mn {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.35;
  }
  .mn.added {
    opacity: 0.8;
  }
  .flow {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 6px;
    font-size: 14px;
    color: var(--text2);
  }
  .op {
    color: var(--text3);
  }
  .core {
    font-size: 16px;
    color: var(--accent);
  }
</style>
