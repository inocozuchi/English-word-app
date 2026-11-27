<script lang="ts">
  // 設定 → 複数の端末で使う（同期）
  import { sync, startNew, join, stop, syncNow, formatCode, normalizeCode, isValidCode, parseConfig, setConfig } from './sync.svelte.ts';
  import { FIREBASE_CONFIG } from './config.ts';
  import { haptic } from '../core/haptics.ts';
  import Num from '../components/Num.svelte';

  let mode = $state<'idle' | 'join' | 'config'>('idle');
  let input = $state('');
  let cfgText = $state('');
  let showCode = $state(false);
  let armed = $state(false);
  let msg = $state('');
  const code = $derived(sync.code);
  const ready = $derived(!!sync.config);
  const codeOk = $derived(isValidCode(normalizeCode(input)));
  const cfg = $derived(parseConfig(cfgText));

  function flash(m: string) {
    msg = m;
    setTimeout(() => (msg = ''), 3000);
  }
  async function begin() {
    haptic('light');
    await startNew();
    showCode = true;
  }
  async function doJoin() {
    if (!(await join(input))) return flash('コードの形が違います（20文字）');
    haptic('success');
    input = '';
    mode = 'idle';
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(formatCode(code!));
      flash('コードをコピーしました');
    } catch {
      showCode = true;
    }
  }
  function quit() {
    if (!armed) {
      armed = true;
      setTimeout(() => (armed = false), 4000);
      return;
    }
    armed = false;
    stop();
    flash('この端末の同期をやめました（記録はこの端末に残っています）');
  }
  function saveConfig() {
    if (!cfg) return;
    setConfig(cfg);
    cfgText = '';
    mode = 'idle';
    haptic('success');
  }
  const time = (t?: number) => (t ? new Date(t).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  const STATUS = { off: '同期していません', idle: '同期済み', syncing: '同期しています…', error: '同期できませんでした', offline: 'オフライン（つながったら同期します）' } as const;
</script>

<div class="ui-group">
  {#if !ready || mode === 'config'}
    <div class="ui-item col">
      <span class="ui-txt"><span>同期の置き場（Firebase）</span><span class="ui-hint">
        Google の無料サービス Firebase に置き場を作り、Firebase コンソールの「firebaseConfig」をここに貼り付けます（手順は docs/firebase-sync.md）。
      </span></span>
      <textarea bind:value={cfgText} rows="4" placeholder={'const firebaseConfig = {\n  apiKey: "…",\n  projectId: "…", …\n};'} spellcheck="false" autocapitalize="off"></textarea>
      <div class="row">
        {#if FIREBASE_CONFIG === null && sync.saved.config && mode === 'config'}<button class="sec press" onclick={() => { setConfig(null); mode = 'idle'; }}>貼り付けた設定を消す</button>{/if}
        <button class="pri press" disabled={!cfg} onclick={saveConfig}>{cfg ? `${cfg.projectId} を使う` : '貼り付けてください'}</button>
      </div>
    </div>
  {:else if !code}
    <div class="ui-item col">
      <span class="ui-txt"><span>iPhone・iPad・パソコンで同じ記録を使う</span><span class="ui-hint">1台目で「同期を始める」を押し、出てきたコードをほかの端末で入れます。それぞれの端末の記録はまとめられ、消えません。</span></span>
      {#if mode === 'join'}
        <input bind:value={input} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" autocapitalize="characters" autocomplete="off" spellcheck="false" class="code-in en" onkeydown={(e) => e.key === 'Enter' && codeOk && doJoin()} />
        <div class="row">
          <button class="sec press" onclick={() => (mode = 'idle')}>やめる</button>
          <button class="pri press" disabled={!codeOk} onclick={doJoin}>このコードで同期</button>
        </div>
      {:else}
        <div class="row">
          <button class="sec press" onclick={() => (mode = 'join')}>コードを入れる</button>
          <button class="pri press" onclick={begin}>同期を始める</button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="ui-item col">
      <div class="state">
        <span class="dot {sync.status}" aria-hidden="true"></span>
        <span class="st">{STATUS[sync.status]}</span>
        {#if sync.last && sync.status === 'idle'}<span class="io">↓<Num value={sync.last.pulled} /> ↑<Num value={sync.last.pushed} /></span>{/if}
      </div>
      <span class="ui-hint">最後の同期 {time(sync.saved.lastAt)}{#if sync.error} · {sync.error}{/if}</span>
      <div class="code" class:hidden={!showCode}>
        <button class="code-v en press" onclick={() => (showCode = !showCode)} aria-label="同期コードを表示">{showCode ? formatCode(code) : '•••••-•••••-•••••-•••••'}</button>
        <button class="sec press sm" onclick={copy}>コピー</button>
      </div>
      <span class="ui-hint">このコードを知っている端末は記録を読み書きできます。人に見せないでください。</span>
      <div class="row">
        <button class="sec press" class:armed onclick={quit}>{armed ? 'もう一度押すとやめる' : 'この端末の同期をやめる'}</button>
        <button class="pri press" disabled={sync.status === 'syncing'} onclick={() => syncNow()}>今すぐ同期</button>
      </div>
    </div>
  {/if}
  {#if ready && mode !== 'config' && FIREBASE_CONFIG === null}
    <button class="ui-item link" onclick={() => (mode = 'config')}><span>置き場の設定を変える</span><span class="ui-right en">{sync.config?.projectId}</span></button>
  {/if}
</div>
{#if msg}<p class="msg" aria-live="polite">{msg}</p>{/if}

<style>
  .row {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .pri,
  .sec {
    min-height: 44px;
    padding: 0 16px;
    border-radius: 14px;
    font-weight: 800;
    border: var(--frame) solid var(--ink);
  }
  .pri {
    background: var(--accent);
    color: var(--on-accent);
  }
  .pri:disabled {
    opacity: 0.35;
  }
  .sec.armed {
    background: var(--ink);
    color: var(--bg);
  }
  .sm {
    min-height: 36px;
    padding: 0 12px;
    font-size: 13px;
  }
  textarea,
  .code-in {
    width: 100%;
    font: 13px/1.5 ui-monospace, Menlo, monospace;
    padding: 10px 12px;
    border-radius: 12px;
    border: 2px solid var(--line-strong);
    background: var(--bg);
    color: var(--text);
  }
  .code-in {
    font-size: 17px;
    letter-spacing: 0.06em;
    text-align: center;
  }
  textarea:focus,
  .code-in:focus {
    border-color: var(--ink);
    outline: none;
  }
  .state {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 800;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--line-strong);
  }
  .dot.idle {
    background: var(--accent);
  }
  .dot.syncing {
    background: var(--accent);
    animation: breathe 1.2s ease-in-out infinite;
  }
  .dot.error {
    background: var(--ink);
  }
  @keyframes breathe {
    50% {
      transform: scale(0.6);
      opacity: 0.5;
    }
  }
  .io {
    margin-left: auto;
    font-size: 12px;
    font-weight: 700;
    color: var(--text2);
    display: flex;
    gap: 6px;
  }
  .code {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .code-v {
    flex: 1;
    min-height: 44px;
    border-radius: 12px;
    border: 2px dashed var(--line-strong);
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--text);
  }
  .msg {
    margin: 8px 4px 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
  }
  @media (prefers-reduced-motion: reduce) {
    .dot.syncing {
      animation: none;
    }
  }
</style>
