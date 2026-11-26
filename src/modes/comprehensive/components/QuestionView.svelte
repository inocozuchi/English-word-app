<script lang="ts">
  // 1問（7種類: recall / listening / translation / dictation / paraphrase / reading / correction）。
  //   答える → 自動で一致 → 正解 / 一致しない → 模範解答と比べて自己採点（自動の不一致を誤答にしない）。
  //   自由に書く問題（言い換え・会話の返答）は最初から模範解答と比べて自己採点。
  //   音声の問題は、答えるまで英文の原稿・答えを見せない。音声が使えなければ文字で確認し、聞き取りとしては記録しない。
  import { onMount } from 'svelte';
  import type { CQuestion } from '../types.ts';
  import type { CompIndex } from '../course.ts';
  import type { Result } from '../session.ts';
  import { autoGrade, isOpenKind, wordDiff, hintFor, normalize } from '../grade.ts';
  import { canSpeak, englishVoices, speak, onVoicesChanged } from '../../../core/speech.ts';
  import { modeSettings, updateModeSettings } from '../../../core/store.svelte.ts';
  import { haptic } from '../../../core/haptics.ts';
  import { compMode } from '../mode.ts';
  import { RATES, VOICE_LANGS } from '../settings.ts';
  import Speak from './Speak.svelte';
  import Passage from './Passage.svelte';
  import Visual from './Visual.svelte';
  import ItemInfo from './ItemInfo.svelte';

  let {
    ix,
    q,
    result,
    pending,
    choices,
    onpending,
    onresult,
    onnext,
  }: {
    ix: CompIndex;
    q: CQuestion;
    result?: Result;
    pending?: { given: string; hints: number; ms: number; plays?: number };
    choices: string[] | null;
    onpending: (p: { given: string; hints: number; ms: number; plays?: number }) => void;
    onresult: (r: Result) => void;
    onnext: () => void;
  } = $props();

  const s = $derived(modeSettings(compMode));
  const isAudio = $derived(q.kind === 'listening' || q.kind === 'dictation');
  const open = $derived(isOpenKind(q.kind, q.subtype));
  const jaAnswer = $derived(q.acceptedAnswers.some((a) => /[぀-ヿ㐀-鿿]/.test(a)));
  const doc = $derived(q.readingId ? ix.reading.get(q.readingId) : undefined);
  /** 読解の資料があれば、問題文から資料の本文を外す */
  const promptText = $derived(doc && q.prompt.startsWith(doc.text) ? q.prompt.slice(doc.text.length).trim() : q.prompt);
  const multiline = $derived(['translation', 'dictation', 'paraphrase', 'correction'].includes(q.kind) && !q.subtype?.includes('fill'));
  const hintable = $derived(!open && !choices && !jaAnswer && ['recall', 'translation', 'dictation', 'correction', 'listening'].includes(q.kind));
  const phase = $derived(result ? 'done' : pending ? 'judge' : 'ask');
  const KIND_LABEL: Record<string, string> = {
    recall: '思い出して書く',
    listening: '聞き取り',
    translation: '英語にする',
    dictation: '書き取り',
    paraphrase: '言い換え',
    reading: '読解',
    correction: '誤りを直す',
  };

  let text = $state('');
  let hints = $state(0);
  let plays = $state(0);
  let voiceOk = $state(canSpeak());
  // 回答までの時間（画面を閉じていた間は数えない）
  let shownAt = performance.now();
  let hiddenMs = 0;
  let hiddenAt = 0;
  const elapsed = () => Math.max(0, performance.now() - shownAt - hiddenMs);
  onMount(() => {
    const vis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = performance.now();
      else if (hiddenAt) {
        hiddenMs += performance.now() - hiddenAt;
        hiddenAt = 0;
      }
    };
    document.addEventListener('visibilitychange', vis);
    const check = () => (voiceOk = canSpeak() && (englishVoices().length > 0 || speechSynthesis.getVoices().length === 0));
    check();
    const off = onVoicesChanged(check);
    if (isAudio && phase === 'ask' && s.autoPlay && q.audioText && canSpeak()) setTimeout(play, 350);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      off();
    };
  });

  function play() {
    if (!q.audioText) return;
    plays++;
    // 音声の再生中・読み込みは回答時間に入れない（最初の再生までの時間を引く）
    if (plays === 1) shownAt = performance.now();
    speak(q.audioText, undefined, { rate: s.rate, langs: VOICE_LANGS });
  }

  function submit(given = text) {
    if (phase !== 'ask') return;
    const ms = Math.round(elapsed());
    if (open) {
      onpending({ given: given.trim(), hints, ms, plays });
      return;
    }
    const g = autoGrade(given, q.acceptedAnswers);
    if (g.verdict === 'empty') return;
    if (g.verdict === 'correct') {
      haptic('success');
      onresult({ v: 'correct', given: given.trim(), hints, ms, plays });
    } else {
      haptic('light');
      onpending({ given: given.trim(), hints, ms, plays });
    }
  }
  function skip() {
    if (phase !== 'ask') return;
    onresult({ v: 'skipped', given: text.trim() || undefined, hints, ms: Math.round(elapsed()), plays });
  }
  function audioUnavailable() {
    if (phase !== 'ask') return;
    onresult({ v: 'audio-unavailable', hints: 0, ms: 0, plays });
  }
  function judge(v: 'self-correct' | 'self-partial' | 'wrong') {
    if (!pending) return;
    haptic(v === 'wrong' ? 'error' : 'success');
    onresult({ v, given: pending.given || undefined, hints: pending.hints, ms: pending.ms, plays: pending.plays });
  }
  function hint() {
    hints++;
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  // 一致しなかった入力と、いちばん近い模範解答の語の違い
  const best = $derived(q.acceptedAnswers[0]);
  const given = $derived(result?.given ?? pending?.given ?? '');
  const diff = $derived(given && !jaAnswer ? wordDiff(given, q.acceptedAnswers.reduce((a, b) => (wordDiff(given, b).filter((x) => x.same).length > wordDiff(given, a).filter((x) => x.same).length ? b : a), best)) : []);
  const visuals = $derived.by(() => {
    const vs = [...(ix.qVisual.get(q.id) ?? []), ...q.itemIds.flatMap((i) => ix.itemVisual.get(i) ?? [])];
    return [...new Map(vs.map((v) => [v.id, v])).values()].slice(0, 3);
  });
  const grammar = $derived(q.grammarId ? ix.grammar.get(q.grammarId) : undefined);
  const VERDICT: Record<string, string> = {
    correct: '正解',
    'self-correct': '合っていた（自己採点）',
    'self-partial': 'あやしい（自己採点）',
    wrong: '不正解',
    skipped: 'わからなかった',
    'audio-unavailable': '音声なし（文字で確認）',
  };
  const good = $derived(result && (result.v === 'correct' || result.v === 'self-correct'));
  function setRate(r: number) {
    updateModeSettings(compMode, { rate: r });
  }
</script>

<div class="qv">
  <div class="top scroll">
    <p class="kind">{KIND_LABEL[q.kind]}{#if q.priority !== 'core'}<span class="pri">{q.priority === 'recommended' ? 'おすすめ' : '発展'}</span>{/if}</p>

    {#if doc}<Passage title={doc.title} text={doc.text} answers={q.acceptedAnswers} showEvidence={phase !== 'ask'} />{/if}

    {#if isAudio && phase === 'ask'}
      <div class="audio">
        {#if voiceOk}
          <button class="play press" onclick={play} aria-label="音声を聞く"><span class="pi" aria-hidden="true">▶</span>{plays ? 'もう一度聞く' : '聞く'}</button>
          <div class="rates" role="radiogroup" aria-label="読み上げの速さ">
            {#each RATES as r}<button class="rate" role="radio" aria-checked={s.rate === r} class:on={s.rate === r} onclick={() => setRate(r)}>{r}×</button>{/each}
          </div>
          <span class="plays">再生 {plays}回</span>
        {:else}
          <p class="na">この端末では英語の音声を使えません。</p>
        {/if}
        <button class="link" onclick={audioUnavailable}>音声が使えない・聞こえない（文字で確認する）</button>
      </div>
    {/if}

    <p class="prompt" class:big={q.kind === 'recall'}>{promptText}</p>

    {#if hints && phase === 'ask'}<p class="hint en" aria-live="polite">ヒント：{hintFor(q.acceptedAnswers[0])}</p>{/if}

    {#if phase !== 'ask'}
      <div class="fb">
        {#if result}
          <p class="verdict" class:good class:bad={result.v === 'wrong' || result.v === 'skipped'}>
            <span class="vm" aria-hidden="true">{good ? '◯' : result.v === 'self-partial' ? '△' : result.v === 'audio-unavailable' ? '—' : '×'}</span>{VERDICT[result.v]}
            {#if result.hints}<span class="tagx">ヒントあり</span>{/if}
          </p>
        {:else}
          <p class="verdict">{open ? '模範解答と比べて、自分で判定してください' : '登録された答えと一致しませんでした。模範解答と比べて判定してください'}</p>
        {/if}
        {#if given}
          <div class="box mine"><span class="lbl">あなたの答え</span>
            <p class="en">{#if diff.length}{#each diff as d}<span class:off={!d.same}>{d.w}</span>{' '}{/each}{:else}{given}{/if}</p>
          </div>
        {/if}
        <div class="box ans"><span class="lbl">{open ? '模範解答（例）' : q.acceptedAnswers.length > 1 ? '答え（どれでも可）' : '答え'}</span>
          {#each q.acceptedAnswers as a}
            <p class="arow"><span class:en={!/[぀-ヿ㐀-鿿]/.test(a)}>{a}</span>{#if !/[぀-ヿ㐀-鿿]/.test(a)}<Speak text={a} size={34} />{/if}</p>
          {/each}
        </div>
        {#if q.audioText && !q.acceptedAnswers.some((a) => normalize(a) === normalize(q.audioText ?? ''))}
          <div class="box"><span class="lbl">音声の英文</span><p class="arow en">{q.audioText}<Speak text={q.audioText} size={34} /></p></div>
        {/if}
        <p class="exp">{q.explanation}</p>
        {#if q.pronunciationId && ix.pron.get(q.pronunciationId)?.note}<p class="note">{ix.pron.get(q.pronunciationId)?.note}</p>{/if}
        {#if isAudio}<p class="note">合成音声は端末によって訛りや自然な音のつながりを再現できないことがあります。</p>{/if}
        {#each q.itemIds as id}{@const it = ix.item.get(id)}{#if it}<ItemInfo item={it} />{/if}{/each}
        {#if grammar}
          <details class="more">
            <summary>詳しい文法解説：{grammar.title}</summary>
            <p>{grammar.rule}</p>
            {#each grammar.examples as e}<p class="en">◯ {e.english}{#if e.incorrect}<br /><span class="ng">× {e.incorrect}</span>{/if}</p>{/each}
          </details>
        {/if}
        {#if visuals.length}
          <details class="more">
            <summary>図解を見る（{visuals.length}）</summary>
            <div class="vs">{#each visuals as v (v.id)}<Visual {v} />{/each}</div>
          </details>
        {/if}
      </div>
    {/if}
  </div>

  <div class="bottom">
    {#if phase === 'ask'}
      {#if choices}
        <div class="choices">
          {#each choices as c, k}<button class="choice en press" onclick={() => submit(c)}><span class="kn">{k + 1}</span>{c}</button>{/each}
        </div>
        <div class="acts one"><button class="sec press" onclick={skip}>わからない</button></div>
      {:else}
        {#if multiline || open}
          <textarea
            bind:value={text}
            rows="2"
            lang={jaAnswer ? 'ja' : 'en'}
            autocomplete="off"
            autocapitalize={jaAnswer ? 'off' : 'sentences'}
            spellcheck="false"
            enterkeyhint="done"
            placeholder={open ? '書かなくても OK（頭の中で答えてから）' : jaAnswer ? '日本語で答える' : '英語で答える'}
            onkeydown={key}
            aria-label="答え"
          ></textarea>
        {:else}
          <input
            bind:value={text}
            type="text"
            lang={jaAnswer ? 'ja' : 'en'}
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="done"
            placeholder={jaAnswer ? '日本語で答える' : '英語で答える'}
            onkeydown={key}
            aria-label="答え"
          />
        {/if}
        <div class="acts" class:three={hintable}>
          {#if hintable}<button class="sec press" onclick={hint} disabled={hints >= 1}>ヒント</button>{/if}
          <button class="sec press" onclick={open ? () => submit('') : skip}>{open ? '模範解答を見る' : 'わからない'}</button>
          <button class="pri press" onclick={() => submit()} disabled={!text.trim() && !open}>{open ? '答えて比べる' : '答え合わせ'}</button>
        </div>
      {/if}
    {:else if phase === 'judge'}
      <p class="ask">自分の答えはどうでしたか？</p>
      <div class="acts three">
        <button class="sec press" onclick={() => judge('wrong')}>違った</button>
        <button class="sec press" onclick={() => judge('self-partial')}>あやしい</button>
        <button class="pri press" onclick={() => judge('self-correct')}>合っていた</button>
      </div>
    {:else}
      <div class="acts one"><button class="pri press" onclick={onnext}>次へ</button></div>
    {/if}
  </div>
</div>

<style>
  .qv {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .top {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 6px 2px 16px;
  }
  .kind {
    font-size: 12px;
    font-weight: 800;
    color: var(--text2);
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .pri {
    font-size: 11px;
    padding: 0 7px;
    border-radius: 999px;
    border: 1.5px solid var(--line-strong);
    color: var(--text3);
  }
  .prompt {
    font-size: 19px;
    font-weight: 700;
    line-height: 1.5;
    white-space: pre-line;
  }
  .prompt.big {
    font-size: clamp(24px, 7vw, 30px);
    font-weight: 850;
  }
  .hint {
    font-size: 18px;
    letter-spacing: 0.06em;
    color: var(--accent);
  }
  .audio {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .play {
    min-height: 56px;
    padding: 0 22px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--bg);
    font-weight: 800;
    font-size: 17px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .rates {
    display: flex;
    gap: 4px;
  }
  .rate {
    min-width: 46px;
    min-height: 36px;
    border-radius: 10px;
    border: 2px solid var(--line-strong);
    font-size: 13px;
    font-weight: 700;
  }
  .rate.on {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--bg);
  }
  .plays {
    font-size: 12px;
    color: var(--text3);
  }
  .link {
    width: 100%;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
    text-decoration: underline;
    min-height: 32px;
  }
  .na {
    font-size: 13px;
    color: var(--text2);
  }
  .fb {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .verdict {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 800;
  }
  .verdict.good {
    color: var(--accent);
  }
  .vm {
    font-size: 20px;
  }
  .tagx {
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 999px;
    border: 1.5px solid var(--line-strong);
    color: var(--text2);
  }
  .box {
    border: var(--card-border);
    border-radius: 14px;
    padding: 9px 12px 10px;
  }
  .box.ans {
    border-color: var(--accent);
  }
  .lbl {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: var(--text3);
    margin-bottom: 2px;
  }
  .ans .lbl {
    color: var(--accent);
  }
  .arow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 17px;
    font-weight: 700;
    padding: 2px 0;
  }
  .mine p {
    font-size: 16px;
  }
  .off {
    text-decoration: underline wavy;
    text-decoration-color: var(--text2);
    font-weight: 800;
  }
  .exp {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text2);
  }
  .note {
    font-size: 11px;
    color: var(--text3);
  }
  .more summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    font-size: 14px;
    font-weight: 800;
    color: var(--accent);
  }
  .more p {
    font-size: 14px;
    line-height: 1.6;
  }
  .ng {
    color: var(--text2);
    text-decoration: line-through;
  }
  .vs {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .bottom {
    flex: none;
    padding-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  input,
  textarea {
    font: inherit;
    font-family: var(--font-en);
    font-size: 18px;
    padding: 12px 14px;
    border-radius: 16px;
    border: var(--panel-border);
    background: var(--bg);
    color: var(--text);
    resize: none;
    width: 100%;
  }
  .acts {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 10px;
  }
  .acts.three {
    grid-template-columns: 1fr 1fr 1.3fr;
  }
  .acts.one {
    grid-template-columns: 1fr;
  }
  .acts button {
    min-height: 56px;
    border-radius: 18px;
    font-size: 16px;
    font-weight: 800;
  }
  .pri {
    background: var(--accent);
    color: var(--on-accent);
    border: var(--frame) solid var(--ink);
  }
  .sec {
    border: var(--frame) solid var(--ink);
  }
  .acts button:disabled {
    opacity: 0.35;
  }
  .ask {
    font-size: 13px;
    font-weight: 700;
    color: var(--text2);
    text-align: center;
  }
  .choices {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .choice {
    position: relative;
    min-height: 64px;
    border-radius: 18px;
    border: 2px solid var(--line-strong);
    font-size: 20px;
    font-weight: 700;
  }
  .kn {
    position: absolute;
    left: 10px;
    top: 6px;
    font-size: 11px;
    color: var(--text3);
  }
</style>
