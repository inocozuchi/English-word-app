<script lang="ts">
  // 反射版の結果: 正解数・平均反応時間・最高の連続正解。タイムアタックはベスト記録と比べる。
  // まちがえた・遅かった問題の「詳しく読む」はここにまとめる（1問ごとの画面には出さない）
  import { onMount } from 'svelte';
  import Icon from '../../../components/Icon.svelte';
  import Num from '../../../components/Num.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { store, updateExtra } from '../../../core/store.svelte.ts';
  import { rise, burst } from '../../../core/transitions.ts';
  import { summarize, type ReflexLog } from '../log.ts';
  import { better, METHODS, type AttackRecord, type Method } from '../engine.ts';
  import { qById, cardById } from '../state.svelte.ts';
  import { itemLabel } from '../label.ts';

  let {
    logs,
    method,
    kind = 'normal',
    bestStreak = 0,
    total = 0,
  }: { logs: ReflexLog[]; method: Method | null; kind?: 'normal' | 'review'; bestStreak?: number; total?: number } = $props();

  // svelte-ignore state_referenced_locally
  const sum = summarize(logs);
  const rate = sum.firstTotal ? Math.round((sum.firstCorrect / sum.firstTotal) * 100) : 0;
  // svelte-ignore state_referenced_locally
  const isAttack = method === 'attack';
  // タイムアタック: 全問を答え終えたときだけ記録（途中でやめた回は記録しない）
  // svelte-ignore state_referenced_locally
  const complete = isAttack && sum.firstTotal === total && total > 0;
  const prevBest = (store.progress.extra?.attackBest ?? null) as AttackRecord | null;
  const rec: AttackRecord = { correct: sum.firstCorrect, total: sum.firstTotal, avgMs: sum.avgMs, at: Date.now() };
  const newBest = complete && better(rec, prevBest);
  if (newBest) updateExtra({ attackBest: rec });

  let score = $state(0);
  let scoreEl: HTMLElement;
  onMount(() => {
    const t = setTimeout(() => {
      score = sum.firstCorrect;
      if (newBest || rate === 100) burst(scoreEl, 18);
    }, 200);
    return () => clearTimeout(t);
  });
  const sec = (ms: number) => (ms / 1000).toFixed(2);
  // svelte-ignore state_referenced_locally
  const title = kind === 'review' ? '復習' : METHODS.find((m) => m.id === method)?.label ?? '';
  const rows = [...sum.missed.map((k) => ({ k, why: '×' })), ...sum.slow.map((k) => ({ k, why: '遅め' }))];
</script>

<div class="rr">
  <div class="scroll body">
    <div class="hero" in:rise>
      <p class="eyebrow-en">Reflex · {title}</p>
      <p class="score en" bind:this={scoreEl}><Num value={score} duration={500} /><span class="sl">/</span><span class="tt">{sum.firstTotal}</span></p>
      <div class="kpi">
        <div><span class="v en">{rate}<small>%</small></span><span class="c">正答率</span></div>
        <div><span class="v en">{sum.avgMs ? sec(sum.avgMs) : '—'}<small>秒</small></span><span class="c">平均反応時間</span></div>
        <div><span class="v en">{bestStreak}</span><span class="c">最高の連続正解</span></div>
      </div>
      {#if isAttack}
        <p class="best">
          {#if newBest}<b class="nb">ベスト更新！</b>{:else if !complete}途中でやめたため記録しません{/if}
          {#if prevBest && !newBest}ベスト {prevBest.correct}/{prevBest.total}・{sec(prevBest.avgMs)}秒{/if}
        </p>
      {/if}
    </div>

    {#if rows.length}
      <h2 class="ui-h2">詳しく読む <span class="n">{rows.length}</span></h2>
      <ul class="list" in:rise={{ delay: 60 }}>
        {#each rows as r}
          {@const lb = itemLabel(r.k)}
          {@const src = qById.get(r.k) ?? cardById.get(r.k)}
          <li>
            <button class="row press" onclick={() => router.push({ name: 'reflex/item', params: { key: r.k } })}>
              <span class="why" class:slow={r.why !== '×'}>{r.why}</span>
              <span class="main">
                <span class="w" class:en={lb?.latin}>{lb?.title ?? r.k}</span>
                <span class="m">{lb?.sub}</span>
                {#if src}<span class="ref">教科書 p.{src.ref_page_a5}（第{src.chapter}章「{src.chapter_title}」）</span>{/if}
              </span>
              <Icon name="chevron" size={18} />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  <div class="actions">
    <button class="primary press" onclick={() => router.replace({ name: 'reflex/quiz', params: { seed: Date.now(), kind, ...(method ? { method } : {}) } })}>もう一度</button>
    <button class="secondary press" onclick={() => router.pop()}>ホーム</button>
  </div>
</div>

<style>
  .rr {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  .body {
    flex: 1;
    padding: calc(var(--pad-top) + 20px) var(--pad-x-r) 28px var(--pad-x);
  }
  .hero {
    text-align: center;
    padding: 20px 0 18px;
  }
  .score {
    font-size: 80px;
    font-weight: 850;
    letter-spacing: -0.04em;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
  }
  .sl,
  .tt {
    color: var(--text3);
    font-size: 0.5em;
  }
  .kpi {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: var(--panel-border);
    border-radius: 20px;
    margin-top: 14px;
    text-align: left;
  }
  .kpi > div {
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
  }
  .kpi > div + div {
    border-left: var(--panel-border);
  }
  .v {
    font-size: 24px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .v small {
    font-size: 12px;
    color: var(--text2);
    margin-left: 1px;
  }
  .c {
    font-size: 11px;
    font-weight: 600;
    color: var(--text2);
  }
  .best {
    margin-top: 12px;
    font-size: 13px;
    color: var(--text2);
    display: flex;
    justify-content: center;
    gap: 10px;
  }
  .nb {
    color: var(--accent);
  }
  .n {
    margin-left: 6px;
    color: var(--text3);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: var(--card-border);
    border-radius: 16px;
    text-align: left;
    color: var(--text);
  }
  .why {
    flex: none;
    min-width: 36px;
    text-align: center;
    padding: 2px 6px;
    border-radius: 8px;
    background: var(--ink);
    color: var(--bg);
    font-size: 12px;
    font-weight: 800;
  }
  .why.slow {
    background: var(--fill-strong);
    color: var(--text);
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .w {
    font-weight: 800;
    font-size: 16px;
  }
  .m {
    font-size: 13px;
    color: var(--text2);
  }
  .ref {
    font-size: 11px;
    color: var(--text3);
  }
  .actions {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 10px;
    padding: 12px var(--pad-x-r) var(--pad-bottom) var(--pad-x);
  }
  .actions button {
    height: 58px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 17px;
  }
  .primary {
    background: var(--accent);
    color: var(--on-accent);
    border: var(--frame) solid var(--ink);
  }
  .secondary {
    border: var(--frame) solid var(--ink);
  }
</style>
