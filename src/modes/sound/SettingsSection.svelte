<script lang="ts">
  // 音声変化モードの設定: 出題パターン・講（0〜10）・ルール・難易度・補足例
  import Toggle from '../../components/Toggle.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import { modeSettings, updateModeSettings } from '../../core/store.svelte.ts';
  import { soundMode } from './mode.ts';
  import { PATTERNS, ALL_LECTURES, type PatternId } from './quiz.ts';
  import { RULE_IDS, type RuleId } from './types.ts';
  import { snd, ruleColor } from './state.svelte.ts';

  const s = $derived(modeSettings(soundMode));
  /** 一覧の切り替え（最低1つは残す） */
  function toggle<T>(list: T[], x: T, all: T[]): T[] {
    const next = list.includes(x) ? list.filter((y) => y !== x) : [...list, x];
    return next.length ? all.filter((y) => next.includes(y)) : list;
  }
  const levels = [
    { value: 1, label: 'Lv.1' },
    { value: 2, label: '〜Lv.2' },
    { value: 3, label: 'すべて' },
  ];
</script>

<h2 class="ui-h2">出題パターン</h2>
<div class="ui-group">
  {#each PATTERNS as p, k}
    <div class="ui-item">
      <span class="num en">{'①②③④⑤⑥⑦⑧⑨'[k]}</span>
      <div class="ui-txt"><span>{p.label}</span><span class="ui-hint">{p.desc}</span></div>
      <Toggle
        label={p.label}
        checked={s.patterns.includes(p.id)}
        onchange={() => updateModeSettings(soundMode, { patterns: toggle<PatternId>(s.patterns, p.id, PATTERNS.map((x) => x.id)) })}
      />
    </div>
  {/each}
</div>

<h2 class="ui-h2">難易度と例文</h2>
<div class="ui-group">
  <div class="ui-item col">
    <div class="ui-line"><span>難易度</span></div>
    <Segmented options={levels} value={s.level} onchange={(v) => updateModeSettings(soundMode, { level: v })} />
    <p class="ui-hint">「すべて」で上級の「複合変化の順序」も出題します（30問答えてから）</p>
  </div>
  <div class="ui-item">
    <div class="ui-txt"><span>補足例を含める</span><span class="ui-hint">教科書の補足例・追加例も出題します</span></div>
    <Toggle label="補足例を含める" checked={s.supplement} onchange={(v) => updateModeSettings(soundMode, { supplement: v })} />
  </div>
</div>

<h2 class="ui-h2">ルール</h2>
<div class="chips">
  {#each RULE_IDS as r}
    <button
      class="chip press"
      class:on={s.rules.includes(r)}
      style:--c={ruleColor(r)}
      aria-pressed={s.rules.includes(r)}
      onclick={() => updateModeSettings(soundMode, { rules: toggle<RuleId>(s.rules, r, RULE_IDS) })}
    ><i></i>{snd.index?.rule.get(r)?.name ?? r}</button>
  {/each}
</div>

<h2 class="ui-h2">講</h2>
<div class="chips">
  {#each ALL_LECTURES as no}
    <button
      class="chip lec press"
      class:on={s.lectures.includes(no)}
      aria-pressed={s.lectures.includes(no)}
      title={snd.index?.lecture.get(no)?.title}
      onclick={() => updateModeSettings(soundMode, { lectures: toggle<number>(s.lectures, no, ALL_LECTURES) })}
    >第{no}講</button>
  {/each}
</div>
<div class="bulk">
  <button class="link-btn" onclick={() => updateModeSettings(soundMode, { lectures: [...ALL_LECTURES], rules: [...RULE_IDS] })}>講とルールをすべて選ぶ</button>
</div>

<style>
  .num {
    flex: none;
    width: 1.4em;
    font-size: 17px;
    color: var(--text2);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0 2px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 14px;
    border-radius: 999px;
    border: 2px solid var(--line-strong);
    font-size: 14px;
    font-weight: 600;
    color: var(--text2);
    transition: background-color 0.2s, border-color 0.2s, color 0.2s;
  }
  .chip i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--c, var(--text3));
    opacity: 0.4;
    transition: opacity 0.2s;
  }
  .chip.on {
    border-color: var(--c, var(--ink));
    color: var(--text);
    background: color-mix(in srgb, var(--c, var(--ink)) 10%, transparent);
  }
  .chip.on i {
    opacity: 1;
  }
  .chip.lec {
    min-width: 72px;
    justify-content: center;
  }
  .bulk {
    margin: 10px 4px 0;
  }
  .link-btn {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
  }
</style>
