<script lang="ts">
  import { choiceIndex, isNextKey } from '../../../core/keys.ts';
  import { typingOf } from '../../../core/storage.ts';
  // 今日の学習（ワンボタンで自動に進む）。
  //   復習 → 単語 → 熟語 → チャンク → 文法 → 英作文 → 言い換え → 音声 → 会話 → 読解 → 混合 → 間違い直し（空の段階は飛ばす）
  //   1問ごとにセッションを保存し、閉じても続きから。記録は1回だけ（state.svelte.ts の commitResult）。
  //   学習時間は目安。過ぎたら「今の問題のあと」に続けるか終えるかを聞く（強制終了しない）。残りは次回へ繰り越す。
  import { onMount } from 'svelte';
  import Icon from '../../../components/Icon.svelte';
  import Num from '../../../components/Num.svelte';
  import { stagger } from '../../../core/transitions.ts';
  import ReportSheet from '../../../components/ReportSheet.svelte';
  import PauseOverlay from '../../../components/PauseOverlay.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { store, modeSettings } from '../../../core/store.svelte.ts';
  import { createRng, shuffle } from '../../../core/rng.ts';
  import { reviewOrder } from '../../../core/review.ts';
  import { haptic } from '../../../core/haptics.ts';
  import { stopSpeaking } from '../../../core/speech.ts';
  import { reducedMotion } from '../../../core/spring.ts';
  import { loadReports, saveReports, addReport, type ReportReason } from '../../../core/reports.ts';
  import { compMode } from '../mode.ts';
  import { allowedBy, planSession, planReview, courseDayFor, INITIAL_DAY, STAGE_LABEL, AFTER_COURSE, MODE_ID, estimateSec, type Stage, type Task } from '../course.ts';
  import { newSession, applyResult, advance, resumeCursor, isOk, type SessionState, type Result, type ConvState } from '../session.ts';
  import { choicesFromPrompt } from '../grade.ts';
  import { scoreDiag, DOMAIN_STAGES } from '../diag.ts';
  import { comp, loadComp, extra, saveSession, loadSession, commitResult, patchExtra, nowDay, medians } from '../state.svelte.ts';
  import QuestionView from '../components/QuestionView.svelte';
  import LearnCard from '../components/LearnCard.svelte';
  import Conversation from '../components/Conversation.svelte';

  let { kind = 'normal', seed = Date.now(), keys }: { kind?: 'normal' | 'review'; seed?: number; keys?: string[] } = $props();

  let s = $state.raw<SessionState | null>(null);
  let ready = $state(false);
  let askTime = $state(false);
  let reporting = $state(false);
  /** 一時停止（ボタン・アプリを離れたとき）。学習した時間を数えない */
  let stopped = $state(false);
  let reported = $state('');
  let closed = false;
  const settings = $derived(modeSettings(compMode));
  const ix = $derived(comp.index);

  /** 今の状況（設定の「音声を使う」「文字を入力する問題」） */
  const situation = () => ({ audio: store.settings.audio, typing: typingOf(store.settings), selfGrade: store.settings.selfGrade });
  // 学習中に状況を変えたら、合わない問題は記録せずに飛ばす（あとで状況が戻れば、また出る）
  $effect(() => {
    const sit = situation();
    if (!s || !task || !q || s.results[task.id] || s.pending?.taskId === task.id) return;
    if (!allowedBy(q, sit)) {
      s = advance(applyResult(s, task.id, { v: 'excluded', hints: 0, ms: 0 }));
      saveSession(s);
    }
  });
  /** 苦手な段階（段階ごとの正答率が低い・診断で低かった分野） */
  function weakStages(): Set<Stage> {
    const out = new Set<Stage>();
    for (const [tag, v] of Object.entries(store.progress.tags)) if (tag.startsWith('st:') && v.seen >= 10 && v.correct / v.seen < 0.6) out.add(tag.slice(3) as Stage);
    const d = extra().diag;
    const form = d?.final?.finishedAt ? 'final' : d?.baseline?.finishedAt ? 'baseline' : null;
    if (form && comp.index) {
      const f = comp.index.d.diagnostics.find((x) => x.id === form)!;
      const th = comp.index.d.diagScoring.thresholds.normalReviewBelow;
      for (const sc of scoreDiag(f, d![form]!)) if (sc.rate !== null && sc.rate < th) for (const st of DOMAIN_STAGES[sc.domain]) out.add(st as Stage);
    }
    return out;
  }

  onMount(() => {
    loadComp().then((ix) => {
      if (closed) return;
      const today = nowDay();
      const saved = loadSession();
      if (kind === 'normal' && saved && saved.kind === 'normal' && saved.date === today && !saved.finished) {
        // 続きから（答えたところは飛ばす）
        s = { ...saved, cursor: resumeCursor(saved) };
      } else if (kind === 'review') {
        const rng = createRng(seed);
        const ks = keys ?? reviewOrder(store.progress.review, rng).map((e) => e.key);
        s = newSession({ id: `r${seed}`, date: today, day: extra().cd?.day ?? 1, kind: 'review', minutes: settings.minutes, tasks: planReview(ix, ks, extra().qs ?? {}, rng, 20, situation()) });
      } else {
        // 新しい日: 日程を進め（学習した日ごとに1日）、今日のキューを作る
        const cd = courseDayFor(extra().cd ?? INITIAL_DAY, today);
        patchExtra((x) => ({ ...x, cd }));
        const ex = extra();
        const p = planSession({
          ix,
          minutes: settings.minutes,
          day: cd.day,
          today,
          rng: createRng(seed),
          items: store.progress.items,
          ev: ex.ev ?? {},
          qs: ex.qs ?? {},
          convDone: ex.conv ?? {},
          weak: weakStages(),
          situation: situation(),
        });
        s = newSession({ id: `s${seed}`, date: today, day: cd.day, kind: 'normal', minutes: settings.minutes, tasks: p.tasks });
      }
      saveSession(s);
      ready = true;
    });
    // 学習した時間（画面が見えている間だけ）
    const iv = setInterval(() => {
      if (!s || s.finished || document.visibilityState === 'hidden' || reporting || stopped) return;
      s = { ...s, activeMs: s.activeMs + 1000 };
      if (s.activeMs % 15000 === 0) saveSession(s);
    }, 1000);
    window.addEventListener('keydown', onKey);
    const vis = () => {
      if (document.visibilityState === 'hidden' && s && !s.finished) {
        stopped = true;
        saveSession(s);
      }
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      closed = true;
      clearInterval(iv);
      window.removeEventListener('keydown', onKey);
      stopSpeaking();
      if (s) saveSession(s);
    };
  });

  const task = $derived(s && !s.finished ? s.tasks[s.cursor] : undefined);
  const q = $derived(task?.qid && ix ? ix.q.get(task.qid) : undefined);
  const done = $derived(s ? Object.keys(s.results).length : 0);
  const total = $derived(s?.tasks.length ?? 0);
  const prevStage = $derived(s && s.cursor > 0 ? s.tasks[s.cursor - 1]?.stage : undefined);
  const minutesDone = $derived(Math.floor((s?.activeMs ?? 0) / 60000));
  const dayInfo = $derived(s && ix ? ix.day.get(Math.min(s.day, 60)) : undefined);

  /** 選択肢の順（最初に1回だけ決めて保存。再開しても同じ順） */
  const choices = $derived.by(() => {
    if (!s || !task || !q) return null;
    if (s.choiceOrder[task.id]) return s.choiceOrder[task.id];
    const c = choicesFromPrompt(q.prompt, q.acceptedAnswers);
    return c ? shuffle(c, createRng(seed + s.cursor)) : null;
  });
  $effect(() => {
    if (s && task && choices && !s.choiceOrder[task.id]) {
      s = { ...s, choiceOrder: { ...s.choiceOrder, [task.id]: choices } };
      saveSession(s);
    }
  });

  function result(r: Result) {
    if (!s || !task || !ix) return;
    commitResult(ix, s, task.id, r); // 同じタスクは2回記録しない
    s = applyResult(s, task.id, r);
    saveSession(s);
  }
  function pending(p: { given: string; hints: number; ms: number; plays?: number }) {
    if (!s || !task) return;
    s = { ...s, pending: { taskId: task.id, ...p } };
    saveSession(s);
  }
  function convStep(c: ConvState) {
    if (!s) return;
    s = { ...s, conv: c };
    saveSession(s);
  }
  function convDone() {
    if (!s || !task) return;
    const sid = task.scenarioId!;
    patchExtra((x) => ({ ...x, conv: { ...(x.conv ?? {}), [sid]: nowDay() } }));
    result({ v: 'seen', hints: 0, ms: 0 });
  }
  function next() {
    if (!s) return;
    stopSpeaking();
    s = advance(s);
    saveSession(s);
    // 目安の時間を過ぎたら、ここで続けるか聞く（強制終了しない）
    if (!s.finished && !s.overtime && s.activeMs >= s.minutes * 60000) askTime = true;
    scrollTop();
  }
  function keepGoing() {
    if (!s) return;
    s = { ...s, overtime: true };
    saveSession(s);
    askTime = false;
  }
  function finishNow() {
    if (!s) return;
    s = { ...s, finished: true };
    saveSession(s);
    askTime = false;
  }
  function close() {
    stopSpeaking();
    if (s) saveSession(s);
    router.pop();
  }
  let body: HTMLElement | undefined = $state();
  function scrollTop() {
    body?.querySelector('.scroll')?.scrollTo({ top: 0 });
    if (!reducedMotion()) body?.animate([{ opacity: 0, transform: 'translateX(12px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'ease-out' });
  }
  function onKey(e: KeyboardEvent) {
    const el = e.target as HTMLElement | null;
    const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
    if (e.key === 'Escape' && !reporting) close();
    if (stopped) {
      if (isNextKey(e, store.settings) && !typing) {
        e.preventDefault();
        stopped = false;
      }
      return;
    }
    if (!s || !task || typing || reporting || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.code === 'KeyP' || e.key === 'p') && !e.repeat) {
      e.preventDefault();
      stopped = true;
      return;
    }
    const k = choiceIndex(e, store.settings);
    if (isNextKey(e, store.settings) && !e.repeat) {
      // 答えたあとは次へ。答える前は、その画面のいちばん大事なボタン（覚えた・次へ／答えを見る／次へ）を押す
      e.preventDefault();
      if (s.results[task.id]) return next();
      const pri = [...(body?.querySelectorAll<HTMLButtonElement>('.acts.one .pri, .bottom .pri, .acts:not(.three) .pri') ?? [])].find((b) => !b.disabled && b.offsetParent);
      pri?.click();
    } else if (k >= 0 && !s.results[task.id]) {
      // 選択肢、または自己採点（違った／あやしい／合っていた）
      const opts = [...(body?.querySelectorAll<HTMLButtonElement>('.choice') ?? [])];
      const btn = opts.length ? opts[k] : [...(body?.querySelectorAll<HTMLButtonElement>('.acts.three button') ?? [])][k];
      if (btn && !btn.disabled) {
        e.preventDefault();
        btn.click();
      }
    }
  }
  function report(reason: ReportReason, comment: string) {
    const id = task?.qid ?? task?.itemId ?? task?.scenarioId;
    if (id) saveReports(MODE_ID, addReport(loadReports(MODE_ID), { key: id, reason, comment: comment || undefined, at: new Date().toISOString() }));
    reporting = false;
    haptic('success');
    reported = '報告しました';
    setTimeout(() => (reported = ''), 2000);
  }

  // ---- まとめ ----
  const summary = $derived.by(() => {
    if (!s || !ix) return null;
    const rs = Object.entries(s.results)
      .filter(([id, r]) => r.v !== 'excluded' && s!.tasks.find((t) => t.id === id)?.type === 'question')
      .map(([, r]) => r);
    const left = s.tasks.filter((t) => !s!.results[t.id]).length;
    return {
      answered: rs.length,
      ok: rs.filter((r) => isOk(r.v)).length,
      auto: rs.filter((r) => r.v === 'correct').length,
      self: rs.filter((r) => r.v.startsWith('self')).length,
      audioNA: rs.filter((r) => r.v === 'audio-unavailable').length,
      learned: s.tasks.filter((t) => t.type === 'learn' && s!.results[t.id]).length,
      left,
      leftSec: estimateSec(ix, s.tasks.filter((t) => !s!.results[t.id]), medians()),
    };
  });
  /** 段階が変わったときのラベル: 小さく弾んで出る */
  function bannerIn(node: HTMLElement) {
    if (reducedMotion()) return;
    node.animate([{ opacity: 0, transform: 'translateY(-6px) scale(0.9)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
  }
  /** まとめ: 見出し・数字・ボタンが下から順に */
  function endIn(node: HTMLElement) {
    stagger([...node.children], { step: 60, distance: 30, delay: 60 });
  }
  const showDiagHint = $derived(!!s && s.kind === 'normal' && s.cursor === 0 && !extra().diag?.baseline?.finishedAt && s.day <= 3);
  const finalDue = $derived(!!s && s.day >= 60 && !extra().diag?.final?.finishedAt);
</script>

<div class="ses">
  <header>
    <button class="close press" onclick={close} aria-label="閉じる（途中で保存）"><Icon name="close" size={22} /></button>
    <span class="mid">
      {#if s}
        <span class="dl">{s.kind === 'review' ? '復習' : s.day >= AFTER_COURSE ? '修了後の復習' : `Day ${s.day}`}</span>
        {#if task}<span class="st">{STAGE_LABEL[task.stage]}</span>{/if}
      {/if}
    </span>
    <span class="right">
      {#if task && !s?.finished}<button class="flag press" onclick={() => { stopped = true; if (s) saveSession(s); haptic('light'); }} aria-label="一時停止"><Icon name="pause" size={18} stroke={2.6} /></button>{/if}
      {#if task && !s?.finished}<button class="flag press" onclick={() => (reporting = true)} aria-label="この問題を報告"><Icon name="flag" size={17} /></button>{/if}
    </span>
  </header>
  {#if s && total}
    <div class="track" aria-label="進み具合 {done} / {total}"><div class="bar" style:transform="scaleX({done / total})"></div></div>
    <p class="meta"><span>{done} / {total}</span><span>{minutesDone}分 / 目安{s.minutes}分</span>{#if reported}<span class="rp">{reported}</span>{/if}</p>
  {/if}

  <div class="body" bind:this={body}>
    {#if !ready}
      <p class="loading">{comp.error || '今日の学習を準備しています…'}</p>
    {:else if s && !s.finished && task && ix}
      {#if task.stage !== prevStage}
        <p class="banner" aria-live="polite" use:bannerIn>{s.cursor === 0 && dayInfo && s.kind === 'normal' ? `${dayInfo.topic} · ` : ''}{STAGE_LABEL[task.stage]}{task.reason === 'carry' ? '（前の日からの繰り越し）' : ''}</p>
      {/if}
      {#if showDiagHint}
        <button class="diag-hint press" onclick={() => router.push({ name: 'comp/diag', params: { form: 'baseline' } })}>
          はじめに Day0 診断（30問・任意）を受けると、学習前の力を記録できます<Icon name="chevron" size={16} />
        </button>
      {/if}
      {#key task.id}
        {#if task.type === 'learn' && task.itemId}
          <LearnCard {ix} item={ix.item.get(task.itemId)!} done={!!s.results[task.id]} onseen={() => result({ v: 'seen', hints: 0, ms: 0 })} onnext={next} />
        {:else if task.type === 'conversation' && task.scenarioId}
          <Conversation scene={ix.scenario.get(task.scenarioId)!} taskId={task.id} conv={s.conv} done={!!s.results[task.id]} onstep={convStep} ondone={convDone} onnext={next} />
        {:else if q}
          <QuestionView
            {ix}
            {q}
            result={s.results[task.id]}
            pending={s.pending?.taskId === task.id ? s.pending : undefined}
            {choices}
            onpending={pending}
            onresult={result}
            onnext={next}
          />
        {/if}
      {/key}
    {:else if s && summary}
      <div class="end scroll" use:endIn>
        <p class="eyebrow-en">{s.kind === 'review' ? 'Review' : 'Today'}</p>
        <h2 class="display">{#if summary.left}Good <span class="acc">work</span>{:else}All <span class="acc">done</span>{/if}</h2>
        <div class="kpi">
          <div><b class="en"><Num value={summary.answered} delay={300} /></b><span>答えた問題</span></div>
          <div><b class="en"><Num value={summary.answered ? Math.round((summary.ok / summary.answered) * 100) : 0} delay={420} /><small>%</small></b><span>正解（自己採点を含む）</span></div>
          <div><b class="en"><Num value={Math.max(1, minutesDone)} delay={540} /></b><span>学習した分</span></div>
        </div>
        <ul class="facts">
          {#if summary.learned}<li>新しく学んだ項目 {summary.learned}</li>{/if}
          <li>自動で正解 {summary.auto} · 自己採点 {summary.self}{#if summary.audioNA} · 音声なし {summary.audioNA}（聞き取りとしては記録しません）{/if}</li>
          {#if summary.left}<li>残り {summary.left} 件は次回に繰り越します（必須の教材は消化済みにしません）</li>{/if}
          <li>まちがえた問題は、忘却曲線に合わせて復習に出ます</li>
        </ul>
        {#if finalDue}
          <button class="sec press" onclick={() => router.push({ name: 'comp/diag', params: { form: 'final' } })}>Day60 の診断を受ける</button>
        {/if}
        {#if summary.left}<button class="sec press" onclick={() => s && (s = { ...s, finished: false, overtime: true, cursor: resumeCursor(s) })}>もう少し続ける（約{Math.max(1, Math.round(summary.leftSec / 60))}分）</button>{/if}
        <button class="pri press" onclick={close}>ホームへ</button>
        <button class="link" onclick={() => router.replace({ name: 'comp/report' })}>学習レポートを見る（ChatGPT にコピー）</button>
      </div>
    {:else if s}
      <p class="loading">今日の学習はありません。</p>
      <button class="pri press" onclick={close}>ホームへ</button>
    {/if}
  </div>

  {#if stopped && s && !s.finished}
    <PauseOverlay progress="{done} / {total} · {minutesDone}分" note="学習した時間は数えていません。アプリを閉じても、ホームの「続きから再開する」で続けられます。" onresume={() => { stopped = false; haptic('light'); }} onsuspend={close} />
  {/if}
  {#if askTime && s}
    <div class="scrim"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="目安の時間">
      <p class="ttl">目安の{s.minutes}分になりました</p>
      <p class="sub">ここで終えても、残りは次回に繰り越されます。</p>
      <div class="two">
        <button class="sec press" onclick={finishNow}>ここで終える</button>
        <button class="pri press" onclick={keepGoing}>続ける</button>
      </div>
    </div>
  {/if}
  {#if reporting && task}
    <ReportSheet id={task.qid ?? task.itemId ?? task.scenarioId ?? ''} onsend={report} onclose={() => (reporting = false)} />
  {/if}
</div>

<style>
  .ses {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: var(--pad-top) var(--pad-x-r) var(--pad-bottom) var(--pad-x);
    background: var(--bg);
  }
  header {
    flex: none;
    height: 44px;
    display: grid;
    grid-template-columns: 44px 1fr auto;
    align-items: center;
    margin-left: -10px;
  }
  .close,
  .flag {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    color: var(--text2);
    border-radius: 22px;
  }
  .flag {
    color: var(--text3);
  }
  .mid {
    display: flex;
    justify-content: center;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }
  .dl {
    font-weight: 850;
    font-size: 15px;
  }
  .st {
    font-size: 12px;
    font-weight: 700;
    color: var(--text2);
    white-space: nowrap;
  }
  .track {
    flex: none;
    height: 5px;
    margin-top: 6px;
    border-radius: 3px;
    background: var(--fill);
    overflow: hidden;
  }
  .bar {
    height: 100%;
    background: var(--accent);
    transform-origin: left center;
    transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .meta {
    flex: none;
    display: flex;
    gap: 12px;
    font-size: 11px;
    font-weight: 700;
    color: var(--text3);
    margin-top: 4px;
    font-variant-numeric: tabular-nums;
  }
  .rp {
    margin-left: auto;
    color: var(--accent);
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding-top: 6px;
  }
  .banner {
    flex: none;
    align-self: flex-start;
    font-size: 12px;
    font-weight: 800;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--bg);
    margin-bottom: 4px;
  }
  .diag-hint {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    text-align: left;
    font-size: 12px;
    font-weight: 700;
    padding: 10px 12px;
    border-radius: 14px;
    border: var(--card-border);
    margin: 4px 0;
  }
  .loading {
    color: var(--text2);
    padding: 40px 0;
    text-align: center;
  }
  .end {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 2px;
  }
  .end h2 {
    font-size: 44px;
  }
  .acc {
    color: var(--accent);
  }
  .kpi {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: var(--panel-border);
    border-radius: 20px;
  }
  .kpi > div {
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
  }
  .kpi > div + div {
    border-left: var(--panel-border);
  }
  .kpi b {
    font-size: 26px;
    font-weight: 850;
  }
  .kpi small {
    font-size: 13px;
  }
  .kpi span {
    font-size: 11px;
    font-weight: 600;
    color: var(--text2);
  }
  .facts {
    margin: 0;
    padding-left: 1.2em;
    font-size: 13px;
    color: var(--text2);
    line-height: 1.7;
  }
  .pri,
  .sec {
    min-height: 56px;
    border-radius: 18px;
    font-size: 16px;
    font-weight: 800;
    border: var(--frame) solid var(--ink);
  }
  .pri {
    background: var(--accent);
    color: var(--on-accent);
  }
  .link {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    min-height: 40px;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 20;
  }
  .sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 21;
    background: var(--bg);
    border-top: var(--panel-border);
    border-radius: 24px 24px 0 0;
    padding: 20px var(--pad-x-r) var(--pad-bottom) var(--pad-x);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ttl {
    font-size: 19px;
    font-weight: 850;
  }
  .sub {
    font-size: 13px;
    color: var(--text2);
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1.3fr;
    gap: 10px;
  }
</style>
