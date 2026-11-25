<script lang="ts">
  import Page from '../components/Page.svelte';
  import Toggle from '../components/Toggle.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Icon from '../components/Icon.svelte';
  import { router } from '../lib/router.svelte.ts';
  import { store, updateSettings, replaceAll } from '../lib/store.svelte.ts';
  import { LIMITS, exportData, parseImport, DEFAULT_SETTINGS } from '../lib/storage.ts';
  import type { Format } from '../lib/types.ts';
  import { FORMAT_LABEL } from '../lib/quiz.ts';
  import { scopeLabel } from '../lib/summary.ts';
  import { haptic } from '../lib/haptics.ts';

  const s = $derived(store.settings);
  const FORMATS: { f: Format; desc: string }[] = [
    { f: 'ej', desc: '英単語を見て意味を選ぶ' },
    { f: 'je', desc: '意味を見て英単語を選ぶ（英→日で学んだ語から）' },
    { f: 'rm', desc: '語源（語根・接頭辞）の意味を選ぶ' },
    { f: 'ph', desc: '熟語の意味を選ぶ' },
  ];

  function toggleFormat(f: Format, on: boolean) {
    const next = on ? [...s.formats, f] : s.formats.filter((x) => x !== f);
    if (!next.length) return; // 最低1つは残す
    updateSettings({ formats: (['ej', 'je', 'rm', 'ph'] as Format[]).filter((x) => next.includes(x)) });
  }

  let message = $state('');
  function flash(m: string) {
    message = m;
    setTimeout(() => (message = ''), 2500);
  }

  async function doExport() {
    const json = exportData($state.snapshot(store.settings), store.progress);
    const name = `etymology-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch {
      return; // 共有をキャンセル
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // 確認は confirm() ではなく画面内で行う（「もう一度タップで確定」。confirm が使えない環境でも動く）
  let armed = $state<'reset' | 'import' | null>(null);
  let armTimer = 0;
  function arm(kind: 'reset' | 'import') {
    armed = kind;
    clearTimeout(armTimer);
    armTimer = window.setTimeout(() => (armed = null), 4000);
    haptic('light');
  }

  let fileInput: HTMLInputElement;
  let pending = $state<ReturnType<typeof parseImport>>(null);
  async function doImport(e: Event) {
    // await の後では e.currentTarget が null になるので、先に取っておく
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    const data = parseImport(await f.text());
    input.value = '';
    if (!data) return flash('読み込めませんでした（形式が違います）');
    pending = data;
    arm('import');
  }
  function confirmImport() {
    if (!pending) return;
    replaceAll(pending.settings, pending.progress);
    pending = null;
    armed = null;
    flash('読み込みました');
  }

  function reset() {
    if (armed !== 'reset') return arm('reset');
    armed = null;
    replaceAll($state.snapshot(store.settings), { items: {}, days: {}, lastBase: null });
    flash('学習記録を消去しました');
  }

  const counts = [5, 10, 15, 20].map((n) => ({ value: n, label: `${n}問` }));
</script>

<Page title="設定">
  <p class="eyebrow-en">Settings</p>
  <h1 class="title">設定</h1>

  <h2>クイズ</h2>
  <div class="group">
    <div class="item col">
      <div class="line"><span>自動で次へ</span><span class="val en">{s.advanceSec}<small>秒</small></span></div>
      <input
        type="range"
        min={LIMITS.advanceSec[0]}
        max={LIMITS.advanceSec[1]}
        step="1"
        value={s.advanceSec}
        style:--p={(s.advanceSec - LIMITS.advanceSec[0]) / (LIMITS.advanceSec[1] - LIMITS.advanceSec[0])}
        oninput={(e) => updateSettings({ advanceSec: +e.currentTarget.value })}
        onchange={() => haptic('light')}
        aria-label="自動で次へ進むまでの秒数"
      />
      <p class="hint">答えたあと解説を表示する時間</p>
    </div>
    <div class="item col">
      <div class="line"><span>回答の制限時間</span><span class="val en">{s.answerSec}<small>秒</small></span></div>
      <input
        type="range"
        min={LIMITS.answerSec[0]}
        max={LIMITS.answerSec[1]}
        step="1"
        value={s.answerSec}
        style:--p={(s.answerSec - LIMITS.answerSec[0]) / (LIMITS.answerSec[1] - LIMITS.answerSec[0])}
        oninput={(e) => updateSettings({ answerSec: +e.currentTarget.value })}
        onchange={() => haptic('light')}
        aria-label="回答の制限時間"
      />
      <p class="hint">過ぎると未回答（不正解）として正解を表示します</p>
    </div>
    <div class="item col">
      <div class="line"><span>問題数</span></div>
      <Segmented options={counts} value={s.count} onchange={(v) => updateSettings({ count: v })} />
    </div>
  </div>

  <h2>出題形式</h2>
  <div class="group">
    {#each FORMATS as { f, desc }}
      <div class="item">
        <div class="txt"><span>{FORMAT_LABEL[f]}</span><span class="hint">{desc}</span></div>
        <Toggle label={FORMAT_LABEL[f]} checked={s.formats.includes(f)} onchange={(v) => toggleFormat(f, v)} />
      </div>
    {/each}
  </div>

  <h2>出題範囲</h2>
  <div class="group">
    <button class="item press-row" onclick={() => router.push({ name: 'scope' })}>
      <span>章・語源を選ぶ</span>
      <span class="right">{scopeLabel(store.index, s)}<Icon name="chevron" size={18} /></span>
    </button>
  </div>

  <h2>表示と操作</h2>
  <div class="group">
    <div class="item col">
      <div class="line"><span>テーマ</span></div>
      <Segmented
        options={[{ value: 'system', label: '自動' }, { value: 'light', label: 'ライト' }, { value: 'dark', label: 'ダーク' }]}
        value={s.theme}
        onchange={(v) => updateSettings({ theme: v })}
      />
    </div>
    <div class="item">
      <div class="txt"><span>触覚フィードバック</span><span class="hint">対応端末のみ</span></div>
      <Toggle label="触覚フィードバック" checked={s.haptics} onchange={(v) => { updateSettings({ haptics: v }); haptic('light'); }} />
    </div>
  </div>

  <h2>データ</h2>
  <div class="group">
    <button class="item press-row" onclick={doExport}><span>学習記録を書き出す</span><span class="right">JSON</span></button>
    {#if armed === 'import' && pending}
      <button class="item press-row danger" onclick={confirmImport}><span>今の記録を置き換える（タップで確定）</span></button>
    {:else}
      <button class="item press-row" onclick={() => fileInput.click()}><span>学習記録を読み込む</span></button>
    {/if}
    <button class="item press-row danger" class:armed={armed === 'reset'} onclick={reset}>
      <span>{armed === 'reset' ? 'もう一度タップで消去（元に戻せません）' : '学習記録を消去'}</span>
    </button>
    <button class="item press-row" onclick={() => updateSettings({ ...DEFAULT_SETTINGS, excludedRoots: [...DEFAULT_SETTINGS.excludedRoots], formats: [...DEFAULT_SETTINGS.formats] })}><span>設定を初期値に戻す</span></button>
  </div>
  <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={doImport} />
  {#if message}<p class="flash">{message}</p>{/if}

  <p class="foot">
    {#if store.index}{store.index.ds.roots.length}語源 · {store.index.ds.words.length}語 · {store.index.ds.phrases.length}熟語<br />{/if}
    学習記録はこの端末にだけ保存されます
  </p>
</Page>

<style>
  .title {
    font-size: 32px;
    font-weight: 750;
    margin: 4px 0 6px;
  }
  h2 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
    margin: 24px 6px 8px;
  }
  .group {
    border-radius: var(--radius-lg);
    background: var(--surface);
    overflow: hidden;
  }
  .item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 54px;
    padding: 12px 16px 12px 18px;
    text-align: left;
    font-size: 16px;
  }
  .item + .item {
    border-top: 0.5px solid var(--line);
  }
  .item.col {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding-top: 14px;
    padding-bottom: 14px;
  }
  .line {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .val {
    font-size: 20px;
    font-weight: 650;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }
  .val small {
    font-size: 13px;
    margin-left: 2px;
    font-family: var(--font-ja);
  }
  .txt {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .hint {
    font-size: 12px;
    color: var(--text3);
    line-height: 1.4;
  }
  .press-row {
    justify-content: space-between;
    transition: background-color 0.15s;
  }
  .press-row:active {
    background: var(--fill);
  }
  .right {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text3);
    font-size: 15px;
  }
  .danger {
    color: #d93a3a;
  }
  .armed {
    background: color-mix(in srgb, #d93a3a 10%, transparent);
    font-weight: 700;
  }
  .flash {
    text-align: center;
    margin-top: 14px;
    font-size: 14px;
    color: var(--accent);
  }
  .foot {
    text-align: center;
    margin: 28px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--text3);
  }

  /* スライダー */
  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 28px;
    background: transparent;
    margin: 0;
    touch-action: none;
  }
  input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right, var(--accent) calc(var(--p) * 100%), var(--fill-strong) 0);
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 28px;
    height: 28px;
    margin-top: -12px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0.5px 4px rgba(0, 0, 0, 0.12), 0 3px 8px rgba(0, 0, 0, 0.15);
  }
  input[type='range']::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right, var(--accent) calc(var(--p) * 100%), var(--fill-strong) 0);
  }
  input[type='range']::-moz-range-thumb {
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
  }
</style>
