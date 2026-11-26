<script lang="ts">
  import PageHero from '../components/PageHero.svelte';
  import Page from '../components/Page.svelte';
  import Toggle from '../components/Toggle.svelte';
  import Segmented from '../components/Segmented.svelte';
  import SliderRow from '../components/SliderRow.svelte';
  import { store, updateSettings, replaceAll, activeMode, modes, switchMode, timingOf, updateTiming, allProgress } from '../core/store.svelte.ts';
  import { LIMITS, exportData, parseImport, DEFAULT_SETTINGS, emptyProgress } from '../core/storage.ts';
  import { haptic } from '../core/haptics.ts';

  const s = $derived(store.settings);
  const mode = $derived(activeMode());
  const timing = $derived(timingOf(mode));

  let message = $state('');
  function flash(m: string) {
    message = m;
    setTimeout(() => (message = ''), 2500);
  }

  async function doExport() {
    const json = exportData($state.snapshot(store.settings), allProgress());
    const name = `eigo-loop-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
    replaceAll($state.snapshot(store.settings), { [mode.id]: emptyProgress() });
    flash(`${mode.title}の学習記録を消去しました`);
  }

  const counts = [5, 10, 15, 20].map((n) => ({ value: n, label: `${n}問` }));
  const goals = [2, 3, 4, 5].map((n) => ({ value: n, label: `${n}回` }));
  const p = (v: number, [lo, hi]: readonly [number, number]) => (v - lo) / (hi - lo);
</script>

<Page title="設定">
  <PageHero ja="設定" en="My *settings*" />

  <h2 class="ui-h2">モード</h2>
  <div class="ui-group" role="radiogroup" aria-label="クイズのモード">
    {#each modes as m}
      <button class="ui-item mode-row" role="radio" aria-checked={m.id === mode.id} onclick={() => { switchMode(m.id); haptic('light'); }}>
        <span class="ui-txt"><span class="mode-name">{m.title}</span><span class="ui-hint">{m.tagline}</span></span>
        <span class="radio" class:on={m.id === mode.id}></span>
      </button>
    {/each}
  </div>

  {#if !mode.hideTiming}
  <h2 class="ui-h2">{mode.title}</h2>
  <div class="ui-group">
    <SliderRow
      label="正解のとき 自動で次へ"
      value={timing.advanceOkSec}
      range={LIMITS.advanceSec}
      onchange={(v) => updateTiming(mode, { advanceOkSec: v })}
    />
    <SliderRow
      label="不正解・時間切れのとき 自動で次へ"
      value={timing.advanceNgSec}
      range={LIMITS.advanceSec}
      hint="答えたあと解説を表示する時間（モードごと）。左へスワイプすればすぐ次へ進めます"
      onchange={(v) => updateTiming(mode, { advanceNgSec: v })}
    />
    <SliderRow
      label="回答の制限時間"
      value={timing.answerSec}
      range={LIMITS.answerSec}
      hint="過ぎると未回答（不正解）として正解を表示します"
      onchange={(v) => updateTiming(mode, { answerSec: v })}
    />
  </div>
  {/if}
  {#if mode.SettingsSection}<mode.SettingsSection />{/if}

  <h2 class="ui-h2">クイズ（共通）</h2>
  <div class="ui-group">
    <div class="ui-item col">
      <div class="ui-line"><span>問題数</span></div>
      <Segmented options={counts} value={s.count} onchange={(v) => updateSettings({ count: v })} />
    </div>
  </div>

  <h2 class="ui-h2">復習リスト</h2>
  <div class="ui-group">
    <div class="ui-item col">
      <div class="ui-line"><span>リストから外れるまでの連続正解</span></div>
      <Segmented options={goals} value={s.reviewGoal} onchange={(v) => updateSettings({ reviewGoal: v })} />
      <p class="ui-hint">まちがえた問題は自動で復習リストに入り、この回数続けて正解すると外れます</p>
    </div>
  </div>


  <h2 class="ui-h2">表示と操作</h2>
  <div class="ui-group">
    <div class="ui-item col">
      <div class="ui-line"><span>テーマ</span></div>
      <Segmented
        options={[{ value: 'system', label: '自動' }, { value: 'light', label: 'ライト' }, { value: 'dark', label: 'ダーク' }]}
        value={s.theme}
        onchange={(v) => updateSettings({ theme: v })}
      />
    </div>
    <div class="ui-item">
      <div class="ui-txt"><span>触覚フィードバック</span><span class="ui-hint">対応端末のみ</span></div>
      <Toggle label="触覚フィードバック" checked={s.haptics} onchange={(v) => { updateSettings({ haptics: v }); haptic('light'); }} />
    </div>
  </div>

  <h2 class="ui-h2">データ</h2>
  <div class="ui-group">
    <button class="ui-item" onclick={doExport}><span>学習記録を書き出す</span><span class="ui-right">JSON</span></button>
    {#if armed === 'import' && pending}
      <button class="ui-item danger" onclick={confirmImport}><span>今の記録を置き換える（タップで確定）</span></button>
    {:else}
      <button class="ui-item" onclick={() => fileInput.click()}><span>学習記録を読み込む</span></button>
    {/if}
    <button class="ui-item danger" class:armed={armed === 'reset'} onclick={reset}>
      <span>{armed === 'reset' ? 'もう一度タップで消去（元に戻せません）' : `${mode.title}の学習記録を消去`}</span>
    </button>
    <button
      class="ui-item"
      onclick={() => updateSettings({ ...DEFAULT_SETTINGS, activeMode: s.activeMode, modes: {} })}
    ><span>設定を初期値に戻す</span></button>
  </div>
  <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={doImport} />
  {#if message}<p class="flash">{message}</p>{/if}

  <p class="foot">
    {mode.title}{#if mode.stat()} · {mode.stat()}{/if}<br />
    学習記録はこの端末にだけ保存されます
  </p>
</Page>

<style>
  .mode-name {
    font-weight: 700;
  }
  .radio {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid var(--line-strong);
    display: grid;
    place-items: center;
    transition: border-color 0.2s;
  }
  .radio::after {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    transform: scale(0);
    transition: transform var(--dur-pop, 300ms) var(--ease-pop, ease-out);
  }
  .radio.on {
    border-color: var(--accent);
  }
  .radio.on::after {
    transform: scale(1);
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
</style>
