<script lang="ts">
  // 英文に視覚マーキングを重ねて表示する。
  //   連結 link  : 語末から次の語頭へ、語のすき間の下に弧（つながる語は折り返さない1つのまとまりにする）
  //   脱落 elide : 取り消し線     同化 assim : 下線     Flap T flap : 二重線
  // show で表示、animate なら左から順に浮かび上がる（線は transform で伸び、弧は描かれていく）。
  import type { Mark } from '../types.ts';
  import { segments, chains, type LineType } from '../marks.ts';
  import { reducedMotion } from '../../../core/spring.ts';

  let {
    words,
    marks = [],
    show = true,
    animate = false,
    target = null,
    targetLine = null,
    size = 'md',
  }: {
    words: string[];
    marks?: Mark[];
    show?: boolean;
    animate?: boolean;
    /** t の行方: 黄色マーカーを付ける文字範囲 */
    target?: { word: number; from: number; to: number } | null;
    /** 回答後に target に重ねる線 */
    targetLine?: LineType | null;
    size?: 'lg' | 'md' | 'sm';
  } = $props();

  const groups = $derived(chains(words.length, marks));
  const segs = $derived(
    words.map((w, i) => {
      const lines = marks
        .filter((m): m is Mark & { type: LineType } => m.type !== 'link' && m.word === i)
        .map((m) => ({ type: m.type, from: m.from ?? 0, to: m.to ?? w.length }));
      const t = target && target.word === i ? { from: target.from, to: target.to } : null;
      if (t && targetLine) lines.push({ type: targetLine, from: t.from, to: t.to });
      return segments(w, lines, t);
    }),
  );

  let root: HTMLElement;
  /** 線と弧を、左から順に浮かび上がらせる */
  $effect(() => {
    if (!show || !animate || !root || reducedMotion()) return;
    const els = [...root.querySelectorAll<HTMLElement | SVGPathElement>('.ln, .arc path')];
    els.forEach((el, k) => {
      const delay = 120 + k * 120;
      if (el instanceof SVGPathElement) {
        el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 360, delay, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
      } else {
        el.animate([{ transform: 'scaleX(0)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 1 }], { duration: 300, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      }
    });
    // 脱落する文字は、線が引かれるのと同じころに文字色が薄くなる（中の線まで薄くしないよう opacity は使わない）
    const order = [...root.querySelectorAll('.ln, .arc path')];
    root.querySelectorAll<HTMLElement>('.sg.elide').forEach((el) => {
      const k = order.indexOf(el.querySelector('.ln.elide')!);
      el.style.transitionDelay = `${120 + Math.max(0, k) * 120}ms`;
    });
  });

  /** 浮かび上がりが終わるまでの時間（解説のフェードインをこの後にする） */
  export function duration() {
    return 120 + (root?.querySelectorAll('.ln, .arc path').length ?? 0) * 120 + 240;
  }
</script>

<span class="marked en {size}" class:show bind:this={root}>
  {#each groups as g, gi}
    {#if gi > 0}{' '}{/if}<span class="chain">
      {#each g as wi, k}
        <span class="w">{#each segs[wi] as sg}<span class="sg" class:tgt={sg.target} class:elide={show && sg.lines.includes('elide')}>{sg.text}{#each sg.lines as l}<span class="ln {l}"></span>{/each}</span>{/each}</span>{#if k < g.length - 1}<span class="gap"><svg class="arc" viewBox="0 0 40 12" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M1 1.5 Q20 15 39 1.5" /></svg></span>{/if}
      {/each}
    </span>
  {/each}
</span>

<style>
  .marked {
    display: inline;
    line-height: 1.9;
    font-weight: 650;
    letter-spacing: -0.01em;
    color: var(--text);
  }
  .lg {
    font-size: 28px;
  }
  .md {
    font-size: 22px;
  }
  .sm {
    font-size: 17px;
    font-weight: 600;
  }
  .chain {
    white-space: nowrap;
  }
  .w,
  .sg {
    position: relative;
  }
  .sg {
    transition: color 0.3s ease-out;
  }
  .sg.elide {
    color: var(--text3);
  }
  .sg.tgt {
    background: linear-gradient(transparent 52%, var(--marker) 52%, var(--marker) 92%, transparent 92%);
    border-radius: 2px;
  }
  /* 線（取り消し線・下線・二重線）: 文字の上に重ねる。表示前は隠す */
  .ln {
    position: absolute;
    left: -1px;
    right: -1px;
    transform-origin: left center;
    pointer-events: none;
  }
  .ln.elide {
    top: 50%;
    height: 2.5px;
    margin-top: -1px;
    background: var(--rule-elide);
    border-radius: 2px;
  }
  .ln.assim {
    bottom: 0.12em;
    height: 3px;
    background: var(--rule-assim);
    border-radius: 2px;
  }
  .ln.flap {
    bottom: 0.04em;
    height: 0.24em;
    border-top: 2.5px solid var(--rule-flap);
    border-bottom: 2.5px solid var(--rule-flap);
  }
  /* 連結の弧: 語のすき間（幅は固定）の下に、前の語末から次の語頭まで */
  .gap {
    position: relative;
    display: inline-block;
    width: 0.3em;
    height: 1em;
  }
  .arc {
    position: absolute;
    left: -0.5em;
    right: -0.5em;
    top: 1.02em;
    width: calc(100% + 1em);
    height: 0.36em;
    overflow: visible;
    pointer-events: none;
  }
  .arc path {
    fill: none;
    stroke: var(--rule-link);
    stroke-width: 2.4;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    stroke-dasharray: 1;
    stroke-dashoffset: 0;
  }
  .marked:not(.show) .ln,
  .marked:not(.show) .arc {
    visibility: hidden;
  }
</style>
