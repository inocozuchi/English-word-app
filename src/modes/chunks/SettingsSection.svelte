<script lang="ts">
  // 会話チャンクモードの設定: 出題パターン・優先度（自動解放 / 手動）・NZ・英の表現・章
  import Toggle from '../../components/Toggle.svelte';
  import { store, modeSettings, updateModeSettings } from '../../core/store.svelte.ts';
  import { chunksMode } from './mode.ts';
  import { PATTERNS, ALL_SECTIONS, unlockedPriorities, type PatternId } from './quiz.ts';
  import { PRIORITIES, type Priority } from './types.ts';
  import { chk } from './state.svelte.ts';

  const s = $derived(modeSettings(chunksMode));
  const unlocked = $derived(chk.index ? unlockedPriorities(chk.index, store.progress.items, { ...s, autoUnlock: true }) : ['A']);
  /** 一覧の切り替え（最低1つは残す） */
  function toggle<T>(list: T[], x: T, all: T[]): T[] {
    const next = list.includes(x) ? list.filter((y) => y !== x) : [...list, x];
    return next.length ? all.filter((y) => next.includes(y)) : list;
  }
</script>

<h2 class="ui-h2">出題パターン</h2>
<div class="ui-group">
  {#each PATTERNS as p, k}
    <div class="ui-item">
      <span class="num en">{'①②③④'[k]}</span>
      <div class="ui-txt"><span>{p.label}</span><span class="ui-hint">{p.desc}</span></div>
      <Toggle
        label={p.label}
        checked={s.patterns.includes(p.id)}
        onchange={() => updateModeSettings(chunksMode, { patterns: toggle<PatternId>(s.patterns, p.id, PATTERNS.map((x) => x.id)) })}
      />
    </div>
  {/each}
</div>

<h2 class="ui-h2">優先度</h2>
<div class="ui-group">
  <div class="ui-item">
    <div class="ui-txt">
      <span>自動で解放する</span>
      <span class="ui-hint">最初は A（最優先）だけ。7割を習得すると B、B の7割で C を出します（今: {unlocked.join('・')}）</span>
    </div>
    <Toggle label="自動で解放する" checked={s.autoUnlock} onchange={(v) => updateModeSettings(chunksMode, { autoUnlock: v })} />
  </div>
  {#if !s.autoUnlock}
    <div class="ui-item col">
      <div class="ui-line"><span>出す優先度</span></div>
      <div class="chips">
        {#each PRIORITIES as p}
          <button
            class="chip press"
            class:on={s.priorities.includes(p)}
            aria-pressed={s.priorities.includes(p)}
            onclick={() => updateModeSettings(chunksMode, { priorities: toggle<Priority>(s.priorities, p, PRIORITIES) })}
          ><b class="en">{p}</b>{chk.index?.d.priorities[p] ?? ''}</button>
        {/each}
      </div>
    </div>
  {/if}
  <div class="ui-item">
    <div class="ui-txt"><span>NZ・英の表現を含める</span><span class="ui-hint">ニュージーランド・イギリス寄りの表現（印は目安）</span></div>
    <Toggle label="NZ・英の表現を含める" checked={s.regional} onchange={(v) => updateModeSettings(chunksMode, { regional: v })} />
  </div>
</div>

<h2 class="ui-h2">章</h2>
<div class="ui-group">
  {#each ALL_SECTIONS as no}
    {@const on = s.sections.includes(no)}
    <button class="ui-item sec" aria-pressed={on} onclick={() => updateModeSettings(chunksMode, { sections: toggle<number>(s.sections, no, ALL_SECTIONS) })}>
      <span class="check" class:on>{#if on}✓{/if}</span>
      <span class="ui-txt"><span class="st">{no}. {chk.index?.section.get(no)?.title ?? ''}</span></span>
    </button>
  {/each}
</div>
<div class="bulk"><button class="link-btn" onclick={() => updateModeSettings(chunksMode, { sections: [...ALL_SECTIONS] })}>すべての章を選ぶ</button></div>

<style>
  .num {
    flex: none;
    width: 1.4em;
    font-size: 17px;
    color: var(--text2);
  }
  .chips {
    display: flex;
    gap: 8px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 12px;
    border-radius: 999px;
    border: 2px solid var(--line-strong);
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
  }
  .chip.on {
    border-color: var(--ink);
    color: var(--text);
  }
  .sec {
    min-height: 46px;
    padding-top: 8px;
    padding-bottom: 8px;
    justify-content: flex-start !important;
  }
  .st {
    font-size: 14px;
  }
  .check {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 7px;
    border: 1.5px solid var(--text3);
    display: grid;
    place-items: center;
    font-size: 13px;
    font-weight: 800;
    color: var(--on-accent);
  }
  .check.on {
    background: var(--accent);
    border-color: var(--accent);
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
