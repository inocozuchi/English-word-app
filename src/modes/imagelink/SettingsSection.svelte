<script lang="ts">
  // イメージリンクの設定: 出題方法（7種）・絞り込み（部・章・type・難易度・タグ）・読み上げ・報告した問題
  import Toggle from '../../components/Toggle.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import Icon from '../../components/Icon.svelte';
  import Chips from './Chips.svelte';
  import { modeSettings, updateModeSettings } from '../../core/store.svelte.ts';
  import { router } from '../../core/router.svelte.ts';
  import { haptic } from '../../core/haptics.ts';
  import { loadReports, saveReports, exportReports } from '../../core/reports.ts';
  import { imagelinkMode } from './mode.ts';
  import { METHODS, TOTAL_COUNTS, TYPE_LABELS, ALL_TYPES, DIFFS, TAGS, PARTS, PART_COLORS, MODE_ID, allowedTypes, parseKey, type IlSettings } from './quiz.ts';
  import { il, questionById, loadIndex } from './state.svelte.ts';

  loadIndex().catch(() => {});
  const s = $derived(modeSettings(imagelinkMode));
  const set = (patch: Partial<IlSettings>) => {
    updateModeSettings(imagelinkMode, patch);
    imagelinkMode.load({ ...s, ...patch });
  };
  const method = $derived(METHODS.find((m) => m.id === s.method)!);
  const partName = (n: number) => il.index?.parts.find((p) => p.part === n)?.name ?? '';
  /** 絞り込みに合う問題の数（読み込んだ部だけで数える。読み込み中は —） */
  const count = $derived(imagelinkMode.ready() ? imagelinkMode.candidates(s).length : null);
  const typeItems = $derived.by(() => {
    // 出題方法で type が決まっているものはその中だけ
    const allowed = method.types ?? ALL_TYPES;
    return allowed.map((t) => ({ id: t, label: TYPE_LABELS[t] }));
  });
  const noTypes = $derived(allowedTypes(s).size === 0);

  // ---- 報告 ----
  let reports = $state(loadReports(MODE_ID));
  let armed = $state(false);
  async function exportR() {
    const json = exportReports(MODE_ID, reports, (key) => {
      const r = questionById(parseKey(key)?.id ?? '');
      return r ? { id: r.id, type: r.type, chapter: r.chapter, question: r.question, prompt: r.prompt_en ?? r.prompt_ja, answer: r.answer ?? r.answer_figure } : { id: parseKey(key)?.id };
    });
    const name = `imagelink-reports-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) return void (await navigator.share({ files: [file] }));
    } catch {
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function clearR() {
    if (!armed) {
      armed = true;
      haptic('light');
      setTimeout(() => (armed = false), 4000);
      return;
    }
    saveReports(MODE_ID, []);
    reports = [];
    armed = false;
  }
</script>

<h2 class="ui-h2">出題方法</h2>
<div class="ui-group" role="radiogroup" aria-label="出題方法">
  {#each METHODS as m}
    <button class="ui-item row" role="radio" aria-checked={s.method === m.id} onclick={() => { set({ method: m.id }); haptic('light'); }}>
      <span class="ui-txt"><span class="mn">{m.label}</span><span class="ui-hint">{m.desc}</span></span>
      <span class="radio" class:on={s.method === m.id}></span>
    </button>
  {/each}
</div>

{#if s.method === 'chapter'}
  <div class="ui-group sub">
    <label class="ui-item col">
      <span class="ui-line"><span>章</span><span class="ui-hint">「章と達成度」から章をタップしても始められます</span></span>
      <select value={s.chapter} onchange={(e) => set({ chapter: +(e.currentTarget as HTMLSelectElement).value })}>
        {#each il.index?.chapters ?? [{ no: s.chapter, title: '', part: 1 }] as c}
          <option value={c.no}>第{c.no}章 {c.title}</option>
        {/each}
      </select>
    </label>
  </div>
{:else if s.method === 'total'}
  <div class="ui-group sub">
    <div class="ui-item col">
      <div class="ui-line"><span>問題数</span></div>
      <Segmented options={TOTAL_COUNTS.map((n) => ({ value: n, label: `${n}問` }))} value={s.totalCount} onchange={(v: number) => set({ totalCount: v })} />
    </div>
  </div>
{/if}

<h2 class="ui-h2">絞り込み <span class="cnt">{#if noTypes}この出題方法に合う形式がありません{:else if count !== null}該当 <b class="en">{count.toLocaleString()}</b> 問{:else}読み込み中…{/if}</span></h2>
<div class="ui-group">
  {#if s.method !== 'chapter'}
    <div class="ui-item col">
      <div class="ui-line"><span>部</span></div>
      <Chips items={PARTS.map((n) => ({ id: n, label: `${n} ${partName(n)}`, color: PART_COLORS[n] }))} selected={s.parts} onchange={(v) => set({ parts: v })} />
    </div>
    <button class="ui-item link" onclick={() => router.push({ name: 'imagelink/chapter-filter' })}>
      <span class="ui-txt"><span>章</span><span class="ui-hint">{s.chapters.length ? `${s.chapters.length}章を選択中` : 'すべての章'}</span></span>
      <Icon name="chevron" size={18} />
    </button>
  {/if}
  <div class="ui-item col">
    <div class="ui-line"><span>問題の形式</span></div>
    <Chips items={typeItems} selected={s.types.filter((t) => typeItems.some((x) => x.id === t))} onchange={(v) => set({ types: v })} />
    {#if !s.types.length && !method.types}<span class="ui-hint">「すべて」ではカードは出しません（フラッシュカードで出ます）</span>{/if}
  </div>
  <div class="ui-item col">
    <div class="ui-line"><span>難易度</span><span class="ui-hint">例文の語数の目安</span></div>
    <Chips items={DIFFS.map((d) => ({ id: d.id, label: d.label }))} selected={s.diffs} onchange={(v) => set({ diffs: v })} />
  </div>
  <div class="ui-item col">
    <div class="ui-line"><span>タグ</span></div>
    <Chips items={TAGS.map((t) => ({ id: t, label: t }))} selected={s.tags} onchange={(v) => set({ tags: v })} />
  </div>
</div>
{#if s.parts.length || s.chapters.length || s.types.length || s.diffs.length || s.tags.length}
  <div class="bulk"><button class="link-btn" onclick={() => set({ parts: [], chapters: [], types: [], diffs: [], tags: [] })}>絞り込みをすべて外す</button></div>
{/if}

<h2 class="ui-h2">読み上げ</h2>
<div class="ui-group">
  <div class="ui-item">
    <div class="ui-txt"><span>答え合わせのあとに英文を読む</span><span class="ui-hint">🔊 ボタンはいつでも使えます（端末の英語音声）</span></div>
    <Toggle label="答え合わせのあとに英文を読む" checked={s.autoSpeak} onchange={(v) => set({ autoSpeak: v })} />
  </div>
</div>

<h2 class="ui-h2">報告した問題</h2>
<div class="ui-group">
  <div class="ui-item">
    <div class="ui-txt"><span>{reports.length} 件</span><span class="ui-hint">クイズ中の 🚩 から報告した問題（この端末に保存）</span></div>
  </div>
  {#if reports.length}
    <button class="ui-item link" onclick={exportR}><span>JSON で書き出す</span><Icon name="chevron" size={18} /></button>
    <button class="ui-item link danger" onclick={clearR}><span>{armed ? 'もう一度タップで消去' : '報告をすべて消す'}</span></button>
  {/if}
</div>

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
    transition: border 0.2s;
  }
  .radio.on {
    border: 7px solid var(--accent);
  }
  .sub {
    margin-top: 10px;
  }
  select {
    font: inherit;
    font-size: 15px;
    width: 100%;
    min-height: 46px;
    padding: 0 12px;
    border-radius: 12px;
    border: 2px solid var(--ink);
    background: var(--bg);
    color: var(--text);
  }
  .cnt {
    margin-left: auto;
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
  }
  .cnt b {
    color: var(--text);
  }
  .link {
    text-align: left;
    color: var(--text);
  }
  .danger {
    color: var(--text2);
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
