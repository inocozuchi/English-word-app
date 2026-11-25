<script lang="ts">
  // 音声変化モードの結果: ルール別の正答率（このセッション）、まちがえた項目（英文・聞こえ方・理由）、
  // 苦手なルールの復習ノートへ
  import type { AnswerRecord } from '../../core/mode.ts';
  import { router } from '../../core/router.svelte.ts';
  import { store } from '../../core/store.svelte.ts';
  import RuleBars from './components/RuleBars.svelte';
  import ItemCard from './components/ItemCard.svelte';
  import RuleBadge from './components/RuleBadge.svelte';
  import { snd } from './state.svelte.ts';
  import { RULE_IDS, type RuleId } from './types.ts';
  import { weakness, type SoundQuestion } from './quiz.ts';
  import { soundMode } from './mode.ts';
  import { rise } from '../../core/transitions.ts';

  let { logs }: { logs: AnswerRecord[] } = $props();

  // svelte-ignore state_referenced_locally
  const session = (() => {
    const t: Partial<Record<RuleId, { seen: number; correct: number }>> = {};
    for (const l of logs)
      for (const r of (l.q.tags ?? []) as RuleId[]) {
        const cur = t[r] ?? { seen: 0, correct: 0 };
        t[r] = { seen: cur.seen + 1, correct: cur.correct + (l.chosen === l.q.answer ? 1 : 0) };
      }
    return t;
  })();
  // svelte-ignore state_referenced_locally
  const missed = logs.filter((l) => l.chosen !== l.q.answer).map((l) => l.q as SoundQuestion);

  /** 苦手なルール: このセッションで正答率が低いもの（同じならこれまでの合計で） */
  const weakest = $derived(
    RULE_IDS.filter((r) => (session[r]?.seen ?? 0) > 0)
      .sort((a, b) => weakness(session as any, b) - weakness(session as any, a) || weakness(store.progress.tags, b) - weakness(store.progress.tags, a))[0],
  );
</script>

<h2 in:rise={{ delay: 60 }}>ルール別の正答率</h2>
<div class="card" in:rise={{ delay: 80 }}>
  <RuleBars stats={session} delay={500} />
  {#if weakest}
    <button class="go press" onclick={() => router.push({ name: 'sound/rule', params: { id: weakest } })}>
      苦手なルールの復習ノートを見る <RuleBadge rule={weakest} />
    </button>
  {/if}
</div>

{#if missed.length}
  <h2 in:rise={{ delay: 100 }}>まちがえた問題 <span class="n">{missed.length}</span></h2>
  <div class="missed" in:rise={{ delay: 120 }}>
    {#each missed as q}
      {@const s = q.data}
      {#if s.kind === 'item' || s.kind === 'cause'}
        <ItemCard item={s.item} onopen={() => router.push({ name: 'sound/item', params: { id: s.item.id } })} />
      {:else}
        {@const lb = soundMode.label(q.key)}
        {#if lb}
          <button class="row press" onclick={() => { const r = soundMode.detailRoute(q.key); if (r) router.push(r); }}>
            <span class="tag">{lb.tag}</span>
            <span class="t" class:en={lb.latin}>{lb.title}</span>
            <span class="s">正解：{q.choices[q.answer].text}</span>
          </button>
        {/if}
      {/if}
    {/each}
  </div>
{/if}

<style>
  h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text2);
    margin: 0 4px 10px;
  }
  .n {
    color: var(--text3);
  }
  .card {
    padding: 6px 16px 14px;
    border-radius: var(--radius-lg);
    background: var(--surface);
    margin-bottom: 22px;
  }
  .go {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
  }
  .missed {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 16px;
    border-radius: var(--radius-lg);
    background: var(--surface);
    text-align: left;
  }
  .tag {
    font-size: 11px;
    font-weight: 700;
    color: var(--text3);
  }
  .t {
    font-size: 16px;
    font-weight: 650;
  }
  .s {
    font-size: 13px;
    color: var(--text2);
  }
</style>
