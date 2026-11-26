<script lang="ts">
  // ルール別の正答率（6本の細い横バー）。答えていないルールは「–」
  import type { RuleId } from '../types.ts';
  import { RULE_IDS } from '../types.ts';
  import { snd, ruleColor } from '../state.svelte.ts';
  import { spring, SPRINGS, reducedMotion } from '../../../core/spring.ts';
  import { router } from '../../../core/router.svelte.ts';
  let { stats, delay = 0 }: { stats: Partial<Record<RuleId, { seen: number; correct: number }>>; delay?: number } = $props();

  /** バーが 0 から順に伸びる（バー自身の scaleX を上書きしないよう、終わりの値はその要素の値） */
  function grow(node: HTMLElement) {
    if (reducedMotion()) return;
    const s = spring(SPRINGS.card);
    node.querySelectorAll<HTMLElement>('.fill').forEach((el, k) => {
      el.animate([{ transform: 'scaleX(0)' }, { transform: el.style.transform || 'scaleX(0)' }], {
        duration: s.duration,
        easing: s.easing,
        delay: delay + k * 60,
        fill: 'backwards',
      });
    });
  }
</script>

<ul class="bars" use:grow>
  {#each RULE_IDS as r}
    {@const t = stats[r]}
    {@const rate = t && t.seen ? t.correct / t.seen : null}
    <li>
      <button class="row" onclick={() => router.push({ name: 'sound/rule', params: { id: r } })}>
        <span class="name" style:--c={ruleColor(r)}><i></i>{snd.index?.rule.get(r)?.name ?? r}</span>
        <span class="track"><span class="fill" style:--c={ruleColor(r)} style:transform="scaleX({rate ?? 0})"></span></span>
        <span class="pct en">{rate === null ? '–' : Math.round(rate * 100) + '%'}</span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .bars {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row {
    width: 100%;
    display: grid;
    grid-template-columns: 5.6em 1fr 3em;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    text-align: left;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
  }
  .name i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--c);
  }
  .track {
    height: 6px;
    border-radius: 3px;
    background: var(--fill-strong);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--c);
    transform-origin: left;
    border-radius: 3px;
  }
  .pct {
    text-align: right;
    font-size: 13px;
    font-weight: 650;
    color: var(--text2);
    font-variant-numeric: tabular-nums;
  }
</style>
