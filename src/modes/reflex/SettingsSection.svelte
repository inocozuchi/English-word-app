<script lang="ts">
  // 反射版の設定: 出題方法（7種）・グループ（グループ集中）・報告した問題
  import ReportsGroup from '../../components/ReportsGroup.svelte';
  import { modeSettings, updateModeSettings } from '../../core/store.svelte.ts';
  import { haptic } from '../../core/haptics.ts';
  import { reflexMode } from './mode.ts';
  import { METHODS, GROUPS, MODE_ID } from './engine.ts';
  import { qById, cardById } from './state.svelte.ts';

  const s = $derived(modeSettings(reflexMode));
  function describe(key: string) {
    const q = qById.get(key);
    if (q) return { type: q.type, group: q.group, chapter: q.chapter, question: q.question, prompt: q.prompt_en ?? q.prompt_ja ?? q.figure, answer: q.answer ?? q.answer_figure };
    const c = cardById.get(key);
    return c ? { type: 'card', word: c.word, image: c.image, chapter: c.chapter } : null;
  }
</script>

<h2 class="ui-h2">出題方法</h2>
<div class="ui-group" role="radiogroup" aria-label="出題方法">
  {#each METHODS as m}
    <button class="ui-item row" role="radio" aria-checked={s.method === m.id} onclick={() => { updateModeSettings(reflexMode, { method: m.id }); haptic('light'); }}>
      <span class="ui-txt"><span class="mn">{m.label}</span><span class="ui-hint">{m.desc}</span></span>
      <span class="radio" class:on={s.method === m.id}></span>
    </button>
  {/each}
</div>
{#if s.method === 'group'}
  <div class="ui-group sub">
    <div class="ui-item col">
      <div class="ui-line"><span>グループ</span></div>
      <div class="chips">
        {#each GROUPS as g}
          <button class="chip press" class:on={s.group === g} aria-pressed={s.group === g} onclick={() => updateModeSettings(reflexMode, { group: g })}>{g}</button>
        {/each}
      </div>
    </div>
  </div>
{/if}
<p class="note">制限時間は問題ごとに3〜5秒。正解は0.4秒、不正解は1.5秒（タップで早送り）で次へ進みます。</p>

<ReportsGroup modeId={MODE_ID} fileName="imagelink-reflex-reports" {describe} />

<style>
  .row {
    text-align: left;
  }
  .mn {
    font-weight: 700;
  }
  .radio {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--text3);
  }
  .radio.on {
    border: 7px solid var(--accent);
  }
  .sub {
    margin-top: 10px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }
  .chip {
    min-height: 38px;
    padding: 0 13px;
    border-radius: 999px;
    border: 2px solid var(--line-strong);
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
  }
  .chip.on {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--bg);
  }
  .note {
    font-size: 12px;
    color: var(--text3);
    margin: 10px 4px 0;
  }
</style>
