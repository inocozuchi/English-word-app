<script lang="ts">
  // Day0 / Day60 診断（30問ずつ）。通常の学習とは別に保存し、間隔反復には入れない。
  // 終わるまで答えを見せない・ヒントなし・途中で閉じても続きから。
  // 採点は 自動で一致 / 自己採点（終わったあとに模範解答と比べる）/ 未回答 / 音声不可 を分けて数える。
  // 分野ごとに Day0 と Day60 を比べる（両方で答えた分野だけ）。TOEIC への換算や進級の判定はしない。
  import Page from '../../../components/Page.svelte';
  import PageHero from '../../../components/PageHero.svelte';
  import { haptic } from '../../../core/haptics.ts';
  import { canSpeak, speak, stopSpeaking } from '../../../core/speech.ts';
  import { modeSettings } from '../../../core/store.svelte.ts';
  import { compMode } from '../mode.ts';
  import { VOICE_LANGS } from '../settings.ts';
  import { comp, loadComp, extra, patchExtra } from '../state.svelte.ts';
  import { diagAnswer, scoreDiag, compareDiag, DOMAIN_LABEL, type DiagState, type DiagAnswer } from '../diag.ts';
  import { onMount } from 'svelte';

  let { form = 'baseline' }: { form?: 'baseline' | 'final' } = $props();
  loadComp().catch(() => {});
  const f = $derived(comp.index?.d.diagnostics.find((x) => x.id === form));
  const st = $derived(extra().diag?.[form]);
  const other = $derived(form === 'final' ? 'baseline' : 'final');
  const s = $derived(modeSettings(compMode));
  let text = $state('');
  let shownAt = performance.now();
  let plays = $state(0);
  const q = $derived(f && st && !st.finishedAt ? f.questions[st.cursor] : undefined);
  const answering = $derived(!!q);
  const rating = $derived(!!f && !!st && !st.finishedAt && st.cursor >= f.questions.length);
  const toRate = $derived(f && st ? f.questions.filter((x) => st.answers[x.id]?.v === 'mismatch' || st.answers[x.id]?.v === 'self') : []);

  function save(next: DiagState) {
    patchExtra((x) => ({ ...x, diag: { ...(x.diag ?? {}), [form]: next } }));
  }
  function start() {
    save({ form, startedAt: Date.now(), cursor: 0, answers: {} });
    shownAt = performance.now();
  }
  function answer(a: DiagAnswer) {
    if (!st || !q) return;
    stopSpeaking();
    save({ ...st, cursor: st.cursor + 1, answers: { ...st.answers, [q.id]: a } });
    text = '';
    plays = 0;
    shownAt = performance.now();
    haptic('light');
  }
  const submit = () => q && text.trim() && answer(diagAnswer(q, text, Math.round(performance.now() - shownAt)));
  const skip = () => q && answer({ v: 'skipped', ms: Math.round(performance.now() - shownAt) });
  const noAudio = () => q && answer({ v: 'audio-unavailable', ms: 0 });
  function play() {
    if (!q?.audioText) return;
    if (!plays) shownAt = performance.now();
    plays++;
    speak(q.audioText, undefined, { rate: s.rate, langs: VOICE_LANGS });
  }
  function rate(id: string, ok: boolean) {
    if (!st) return;
    save({ ...st, answers: { ...st.answers, [id]: { ...st.answers[id], selfOk: ok } } });
  }
  function finish() {
    if (!st) return;
    save({ ...st, finishedAt: Date.now() });
    haptic('success');
  }
  function retake() {
    start();
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      submit();
    }
  }
  onMount(() => () => stopSpeaking());
  const scores = $derived(f && st?.finishedAt ? scoreDiag(f, st) : []);
  const otherForm = $derived(comp.index?.d.diagnostics.find((x) => x.id === other));
  const otherSt = $derived(extra().diag?.[other]);
  const cmp = $derived(otherForm && otherSt?.finishedAt && scores.length ? (form === 'final' ? compareDiag(scoreDiag(otherForm, otherSt), scores) : compareDiag(scores, scoreDiag(otherForm, otherSt))) : []);
  const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
</script>

<Page title={form === 'baseline' ? 'Day0 診断' : 'Day60 診断'}>
  <PageHero ja={form === 'baseline' ? 'Day0 診断 · 学習前' : 'Day60 診断 · 学習後'} en="Check *point*" />
  {#if !f}
    <p class="muted">読み込み中…</p>
  {:else if !st}
    <div class="intro">
      <p>英単語・英文法・チャンク・リスニング・言い換え・読解・アカデミック英語の {f.questions.length} 問です（約15分）。</p>
      <ul>
        <li>終わるまで答えは表示しません。ヒントもありません。</li>
        <li>途中で閉じても、続きから再開できます。</li>
        <li>わからない問題はスキップ、音声が使えない問題は「音声が使えない」を選べます（別に数えます）。</li>
        <li>通常の学習・復習の記録には入りません。</li>
        <li>結果は分野ごとの目安です。TOEIC への換算や、進級の判定はしません。</li>
      </ul>
      <button class="pri press" onclick={start}>診断を始める</button>
    </div>
  {:else if answering && q}
    <p class="prog en">{st.cursor + 1} / {f.questions.length}<span class="dm">{DOMAIN_LABEL[q.domain]}</span></p>
    {#if q.audioText}
      <div class="audio">
        {#if canSpeak()}<button class="play press" onclick={play}>▶ {plays ? 'もう一度聞く' : '聞く'}</button>{/if}
        <button class="link" onclick={noAudio}>音声が使えない</button>
      </div>
    {/if}
    <p class="prompt">{q.prompt}</p>
    <textarea bind:value={text} rows="2" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" placeholder="答えを入力" onkeydown={key} aria-label="答え"></textarea>
    <div class="acts">
      <button class="sec press" onclick={skip}>スキップ</button>
      <button class="pri press" onclick={submit} disabled={!text.trim()}>次へ</button>
    </div>
  {:else if rating}
    <h2 class="ui-h2">自己採点（{toRate.length}問）</h2>
    <p class="muted">登録された答えと一致しなかった問題と、自由に答える問題です。模範解答と比べて判定してください。</p>
    {#each toRate as x}
      {@const a = st.answers[x.id]}
      <div class="rate">
        <p class="rp">{x.prompt}</p>
        <p class="mine">あなた：<span class="en">{a.given}</span></p>
        <p class="model">模範：<span class="en">{x.acceptedAnswers.join(' / ')}</span></p>
        <div class="two">
          <button class="sec press" class:on={a.selfOk === false} onclick={() => rate(x.id, false)}>違った</button>
          <button class="sec press" class:on={a.selfOk === true} onclick={() => rate(x.id, true)}>合っていた</button>
        </div>
      </div>
    {/each}
    <button class="pri press" onclick={finish} disabled={toRate.some((x) => st.answers[x.id].selfOk === undefined)}>結果を見る</button>
  {:else if st.finishedAt}
    <h2 class="ui-h2">分野ごとの結果</h2>
    <table class="tbl">
      <thead><tr><th>分野</th><th>正答率</th><th>自動</th><th>自己</th><th>未回答</th><th>音声不可</th></tr></thead>
      <tbody>
        {#each scores as sc}
          <tr><td>{DOMAIN_LABEL[sc.domain]}</td><td class="en"><b>{pct(sc.rate)}</b></td><td class="en">{sc.auto}</td><td class="en">{sc.self}/{sc.selfRated}</td><td class="en">{sc.skipped}</td><td class="en">{sc.audioNA}</td></tr>
        {/each}
      </tbody>
    </table>
    <p class="muted">正答率 =（自動で一致＋自己採点で合っていた）÷（音声不可を除いた問題数）。自己採点の分は別に表示しています。</p>
    {#if cmp.length}
      <h2 class="ui-h2">Day0 と Day60 の比較（両方で答えた分野）</h2>
      <ul class="cmp">
        {#each cmp as c}<li><span>{DOMAIN_LABEL[c.domain]}</span><b class="en">{pct(c.before)} → {pct(c.after)}</b></li>{/each}
      </ul>
      <p class="muted">2つの診断は同じ分野・同じ形式ですが、統計的に等しい難しさに調整されたものではありません。目安として見てください。</p>
    {/if}
    <h2 class="ui-h2">答えの確認</h2>
    {#each f.questions as x}
      {@const a = st.answers[x.id]}
      <div class="rv">
        <p class="rp">{x.prompt}</p>
        <p class="mine">{a?.v === 'skipped' || !a ? '未回答' : a.v === 'audio-unavailable' ? '音声不可' : a.given}{a?.v === 'auto' ? ' ◯' : a?.selfOk ? ' ◯（自己採点）' : a && (a.v === 'mismatch' || a.v === 'self') ? ' ×（自己採点）' : ''}</p>
        <p class="model en">{x.acceptedAnswers.join(' / ')}</p>
        {#if x.audioText}<p class="model en">音声：{x.audioText}</p>{/if}
      </div>
    {/each}
    <button class="sec press" onclick={retake}>もう一度受ける（結果は上書きされます）</button>
  {/if}
</Page>

<style>
  .intro {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 14px;
    line-height: 1.6;
  }
  .intro ul {
    margin: 0;
    padding-left: 1.2em;
    color: var(--text2);
  }
  .muted {
    font-size: 12px;
    color: var(--text2);
    margin: 6px 0;
  }
  .prog {
    font-weight: 800;
    display: flex;
    gap: 10px;
    align-items: baseline;
  }
  .dm {
    font-size: 12px;
    color: var(--text2);
  }
  .prompt {
    font-size: 19px;
    font-weight: 700;
    margin: 12px 0;
    white-space: pre-line;
  }
  .audio {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 10px;
  }
  .play {
    min-height: 52px;
    padding: 0 20px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--bg);
    font-weight: 800;
  }
  .link {
    font-size: 12px;
    color: var(--text2);
    text-decoration: underline;
  }
  textarea {
    width: 100%;
    font: inherit;
    font-size: 18px;
    padding: 12px 14px;
    border-radius: 16px;
    border: var(--panel-border);
    background: var(--bg);
    color: var(--text);
    resize: none;
  }
  .acts,
  .two {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 10px;
    margin-top: 10px;
  }
  .two {
    grid-template-columns: 1fr 1fr;
  }
  .pri,
  .sec {
    min-height: 54px;
    border-radius: 18px;
    font-weight: 800;
    border: var(--frame) solid var(--ink);
  }
  .pri {
    background: var(--accent);
    color: var(--on-accent);
    margin-top: 10px;
  }
  .pri:disabled {
    opacity: 0.35;
  }
  .sec.on {
    background: var(--ink);
    color: var(--bg);
  }
  .rate,
  .rv {
    border: var(--card-border);
    border-radius: 14px;
    padding: 10px 12px;
    margin-bottom: 8px;
    font-size: 14px;
  }
  .rp {
    font-weight: 700;
  }
  .mine {
    color: var(--text2);
  }
  .model {
    color: var(--accent);
    font-size: 13px;
  }
  .tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .tbl th {
    font-size: 11px;
    color: var(--text3);
    text-align: left;
    padding: 4px;
  }
  .tbl td {
    padding: 8px 4px;
    border-top: 1.5px solid var(--line);
  }
  .cmp {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .cmp li {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1.5px solid var(--line);
    font-size: 14px;
  }
</style>
