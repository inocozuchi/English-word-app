<script lang="ts">
  import type { Part } from '../types.ts';
  import { spring, SPRINGS, reducedMotion } from '../../../core/spring.ts';
  // 語源の分解: [in 中に] + [volve 回る] → コアイメージ
  // animate のときは、パーツが1つずつ「組み上がる」ように出る（単語の成り立ちが目に入る）
  let { parts, core = null, animate = false }: { parts: Part[]; core?: string | null; animate?: boolean } = $props();

  function build(node: HTMLElement) {
    if (!animate || reducedMotion()) return;
    const pop = spring(SPRINGS.pop);
    [...node.children].forEach((el, k) => {
      const d = 220 + k * 90;
      const isChip = el.classList.contains('chip');
      const isCore = el.classList.contains('core');
      el.animate(
        [
          { transform: isCore ? 'translate3d(-10px,0,0)' : isChip ? 'scale(0.6)' : 'scale(0.4)' },
          { transform: 'none' },
        ],
        { duration: pop.duration, easing: pop.easing, delay: d, fill: 'backwards' },
      );
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: d, fill: 'backwards' });
    });
  }
</script>

{#if parts.length}
  <div class="bd" use:build>
    {#each parts as p, i}
      {#if i > 0}<span class="plus">+</span>{/if}
      <span class="chip"><span class="en part">{p.part}</span><span class="m">{p.meaning}</span></span>
    {/each}
    {#if core}<span class="plus">→</span><span class="core">{core}</span>{/if}
  </div>
{/if}

<style>
  .bd {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 12px 5px;
    border-radius: 12px;
    background: var(--fill);
    line-height: 1.2;
  }
  .part {
    font-weight: 650;
    font-size: 17px;
  }
  .m {
    font-size: 12px;
    color: var(--text2);
    margin-top: 2px;
  }
  .plus {
    color: var(--text3);
    font-size: 15px;
  }
  .core {
    font-size: 15px;
    font-weight: 600;
    color: var(--accent);
  }
</style>
