<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import Num from '../components/Num.svelte';
  import { booted, isBooted } from '../core/boot.ts';
  import { stagger } from '../core/transitions.ts';
  import { router } from '../core/router.svelte.ts';
  import { store, activeMode, modeSettings, loadData } from '../core/store.svelte.ts';
  import { streak, dayKey } from '../core/day.ts';
  import { isDue } from '../core/srs.ts';
  import { reviewCount } from '../core/review.ts';
  import { haptic } from '../core/haptics.ts';
  import { loadSuspend, clearSuspend } from '../core/suspend.ts';
  import HomeBackdrop from '../components/HomeBackdrop.svelte';

  loadData();
  const mode = $derived(activeMode());
  const t = $derived(store.today);
  const days = $derived(streak(store.progress.days, t));
  const todayCount = $derived(store.progress.days[dayKey(t)]?.a ?? 0);
  const inReview = $derived(reviewCount(store.progress.review));
  /** 時間帯のあいさつ（日付と同じく午前4時区切り）と、続けている日数 */
  const greeting = $derived.by(() => {
    void t;
    const h = new Date().getHours();
    const g = h >= 4 && h < 11 ? 'Good morning' : h >= 11 && h < 17 ? 'Good afternoon' : h >= 17 && h < 23 ? 'Good evening' : 'Late night';
    return days >= 2 ? `${g} · ${days}-day loop` : g;
  });
  /** 出題範囲で、今日の復習待ち（間隔反復の期限が来ている問題） */
  const due = $derived.by(() => {
    if (!mode.ready()) return 0;
    let n = 0;
    for (const c of mode.candidates(modeSettings(mode))) {
      const st = store.progress.items[c.key];
      if (st && isDue(st, t)) n++;
    }
    return n;
  });
  // 中断したクイズ（共通のクイズ画面のモードだけ）。ホームに戻るたびに読み直す
  let susVer = $state(0);
  const suspended = $derived((void router.stack.length, void susVer, mode.quizRoute ? null : loadSuspend(mode.id)));
  function resumeQuiz() {
    const sus = suspended;
    if (!sus) return;
    haptic('light');
    router.push({ name: 'quiz', params: { seed: sus.seed, kind: sus.kind, override: sus.override, resume: true } }, 'modal');
  }
  function discard() {
    clearSuspend();
    haptic('light');
    susVer++;
  }
  const summary = $derived(mode.hideCount ? mode.summary(modeSettings(mode)) : `${store.settings.count}問 · ${mode.summary(modeSettings(mode))}`);

  // 大見出し: \n で改行、*語* をアクセント色に
  const hero = $derived(
    mode.hero.split('\n').map((line) => line.split(/(\*[^*]+\*)/).filter(Boolean).map((t) => ({ t: t.replace(/\*/g, ''), acc: t.startsWith('*') }))),
  );

  // 起動時だけ、要素を上から順に静かに出す（配置が確定してから。core/boot.ts）
  let root: HTMLElement;
  onMount(() => {
    if (!isBooted()) booted.then(() => stagger([...root.querySelectorAll('[data-intro]')], { step: 55 }));
  });

  async function start(kind: 'normal' | 'review') {
    haptic('light');
    await loadData();
    const r = mode.quizRoute?.(kind) ?? { name: 'quiz', params: { seed: Date.now(), kind } };
    router.push({ ...r, params: { seed: Date.now(), kind, ...(r.params ?? {}) } }, 'modal');
  }
  /** パソコン: ホームで Enter（何も選んでいないとき）でスタート、R で復習 */
  function homeKey(e: KeyboardEvent) {
    if (router.stack.length !== 1 || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && t !== document.body) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      start('normal');
    } else if ((e.key === 'r' || e.key === 'R') && inReview) {
      e.preventDefault();
      start('review');
    }
  }
</script>

<svelte:window onkeydown={homeKey} />

<div class="home" bind:this={root}>
  <HomeBackdrop />
  <header data-intro>
    <div class="logo en" aria-label="EIGO LOOP"><span>EIGO</span><span>LOOP</span></div>
    <button class="icon press" onclick={() => router.push({ name: 'settings' })} aria-label="設定"><Icon name="gear" size={24} /></button>
  </header>

  <div class="hero" data-intro>
    <p class="greet eyebrow-en">{greeting}</p>
    <p class="tagline">{mode.tagline}</p>
    <h1 class="display">
      {#each hero as line, li}{#if li > 0}<br />{/if}{#each line as part}{#if part.acc}<span class="acc">{part.t}</span>{:else}{part.t}{/if}{/each}{/each}
    </h1>
  </div>

  <div class="side">
  <!-- 今のモード（切り替えは設定で。ここは表示だけ） -->
  <p class="mode-line" data-intro><span class="eyebrow-en">Mode</span><span class="mname">{mode.title}</span>{#if mode.stat()}<span class="stat">{mode.stat()}</span>{/if}</p>
  {#if suspended}
    <div class="resume-card" data-intro>
      <button class="rc-main press" onclick={resumeQuiz}>
        <span class="rc-ic" aria-hidden="true">▶</span>
        <span class="rc-txt"><b>中断したクイズを再開</b><span>{suspended.i} / {suspended.qs.length} 問まで · {suspended.kind === 'review' ? '復習' : mode.title}</span></span>
      </button>
      <button class="rc-x press" onclick={discard} aria-label="中断したクイズを破棄">✕</button>
    </div>
  {/if}
  <button class="start press" data-intro onclick={() => start('normal')} aria-label="スタート（{mode.title}）">
    <span class="start-en display">Start</span>
    <span class="start-ja">{mode.startLabel?.() ?? 'スタート'}</span>
    <span class="start-sum">{summary}</span>
    <span class="arrow"><Icon name="chevron" size={30} stroke={3} /></span>
  </button>

  <button class="review press" data-intro class:empty={!inReview} onclick={() => (inReview ? start('review') : router.push({ name: 'review' }))}>
    <span class="r-icon"><Icon name="review" size={22} /></span>
    <span class="r-txt">
      <span class="r-title">復習する</span>
      <span class="r-sub">{inReview ? 'まちがえた問題だけを出題' : 'まちがえた問題がここに入ります'}</span>
    </span>
    <span class="r-num en"><Num value={inReview} delay={520} /></span>
  </button>

  <div class="stats" data-intro>
    <div class="stat-c">
      <span class="num en"><Num value={days} delay={520} /></span>
      <span class="cap">連続日数</span>
    </div>
    <div class="stat-c">
      <span class="num en"><Num value={todayCount} delay={520} /></span>
      <span class="cap">今日の回答</span>
    </div>
    <div class="stat-c">
      <span class="num en"><Num value={due} delay={520} /></span>
      <span class="cap">期限の来た問題</span>
    </div>
  </div>

  <nav data-intro>
    {#if mode.browse}
      <button class="press" onclick={() => router.push(mode.browse!.route)}><Icon name="book" size={20} /><span>{mode.browse.label}</span></button>
    {/if}
    <button class="press" onclick={() => router.push({ name: 'review' })}><Icon name="review" size={20} /><span>復習リスト</span></button>
    <button class="press" onclick={() => router.push({ name: 'stats' })}><Icon name="chart" size={20} /><span>記録</span></button>
  </nav>
  </div>
</div>

<style>
  .home {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: var(--pad-top) var(--pad-x-r) var(--pad-bottom) var(--pad-x);
    gap: 12px;
    isolation: isolate;
  }
  /* 背景の文字の上でも読めるように、枠のある部品は背景色で塗る */
  .review,
  .stats,
  nav button,
  .resume-card {
    background: var(--bg);
  }
  .greet {
    color: var(--accent);
    margin-bottom: -2px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  /* ロゴ: 太い枠に2行の欧文 */
  .logo {
    display: inline-flex;
    flex-direction: column;
    padding: 5px 9px 4px;
    border: var(--frame) solid var(--ink);
    font-weight: 850;
    font-size: 14px;
    line-height: 1.02;
    letter-spacing: 0.02em;
  }
  .icon {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 22px;
    color: var(--text);
  }
  .hero {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    min-height: 0;
  }
  .mode-line {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0 4px -4px;
    font-size: 13px;
  }
  .mode-line .eyebrow-en {
    font-size: 10px;
    color: var(--text3);
  }
  .mname {
    font-weight: 700;
    color: var(--text2);
  }
  .stat {
    margin-left: auto;
    font-size: 11px;
    color: var(--text3);
    font-weight: 600;
  }
  .tagline {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-top: 6px;
  }
  .hero h1 {
    font-size: clamp(36px, 11.4vw, 54px);
  }
  .acc {
    color: var(--accent);
  }

  /* スタート: 画面の主役。太い枠のアクセント色ブロック */
  .start {
    position: relative;
    display: grid;
    align-items: end;
    text-align: left;
    min-height: 172px;
    padding: 20px 22px 18px 24px;
    border: var(--frame) solid var(--ink);
    border-radius: 28px;
    background: var(--accent);
    color: var(--on-accent);
    overflow: hidden;
    isolation: isolate;
  }
  /* パソコン: ポインターを合わせると光が斜めに一度だけ通り、矢印が前へ出る */
  .start::before {
    content: '';
    position: absolute;
    inset: -20% auto -20% 0;
    width: 40%;
    background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.22), transparent);
    transform: translateX(-160%) skewX(-12deg);
    pointer-events: none;
    z-index: -1;
  }
  @media (hover: hover) and (pointer: fine) {
    .start:hover::before {
      transform: translateX(320%) skewX(-12deg);
      transition: transform 0.9s cubic-bezier(0.2, 0.7, 0.2, 1);
    }
    .start:hover .arrow {
      transform: translateX(4px);
    }
  }
  .start-en {
    font-size: 60px;
  }
  .start-ja {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.12em;
    margin-top: 6px;
  }
  .start-sum {
    font-size: 13px;
    opacity: 0.85;
    margin-top: 2px;
  }
  .arrow {
    position: absolute;
    top: 18px;
    right: 18px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--on-accent);
    color: var(--accent);
    transition: transform 0.35s var(--ease-pop, ease-out);
  }

  /* 中断したクイズ: スタートの上に。押すと続きから */
  .resume-card {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }
  .rc-main {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    padding: 8px 14px;
    border-radius: 20px;
    border: var(--frame) solid var(--accent);
    color: var(--text);
    text-align: left;
  }
  .rc-ic {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: var(--on-accent);
    flex: none;
  }
  .rc-txt {
    display: flex;
    flex-direction: column;
    font-size: 12px;
    color: var(--text2);
  }
  .rc-txt b {
    font-size: 16px;
    color: var(--text);
  }
  .rc-x {
    width: 52px;
    border-radius: 18px;
    border: 2px solid var(--line-strong);
    color: var(--text2);
    font-size: 16px;
  }

  /* 復習: スタートの次に押しやすい位置 */
  .review {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 10px 18px 10px 16px;
    border: var(--frame) solid var(--ink);
    border-radius: 20px;
    text-align: left;
  }
  .r-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--bg);
  }
  .r-txt {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .r-title {
    font-size: 16px;
    font-weight: 800;
  }
  .r-sub {
    font-size: 12px;
    color: var(--text2);
  }
  .r-num {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }
  .review.empty .r-icon {
    background: var(--fill-strong);
    color: var(--text3);
  }
  .review.empty .r-num {
    color: var(--text3);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: var(--frame) solid var(--ink);
    border-radius: 20px;
  }
  .stat-c {
    display: flex;
    flex-direction: column;
    padding: 10px 14px 9px;
    gap: 1px;
  }
  .stat-c + .stat-c {
    border-left: var(--frame) solid var(--ink);
  }
  .num {
    font-size: 26px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    line-height: 1.05;
  }
  .cap {
    font-size: 11px;
    font-weight: 600;
    color: var(--text2);
  }
  nav {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  nav button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    height: 58px;
    border-radius: 18px;
    border: var(--frame) solid var(--ink);
    font-size: 12px;
    font-weight: 700;
  }

  /* 縦向きでは .side は箱を作らない（中身がそのまま .home の行になる） */
  .side {
    display: contents;
  }
  /* 横向き（iPad・パソコン・横にしたスマホ）: 見出しを左、スタートと記録を右に並べる */
  @media (orientation: landscape) and (min-width: 640px) {
    .home {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, min(54%, 540px));
      grid-template-rows: auto minmax(0, 1fr);
      column-gap: clamp(24px, 5vw, 64px);
      row-gap: 8px;
      padding-left: var(--pad-x-wide);
      padding-right: var(--pad-x-wide-r);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    header {
      grid-column: 1 / -1;
    }
    .hero {
      align-self: center;
    }
    .hero h1 {
      font-size: clamp(40px, 6.2vw, 92px);
    }
    .side {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 10px;
    }
  }
  /* 横にしたスマホ（背が低い）: さらに詰める */
  @media (orientation: landscape) and (max-height: 520px) {
    .side {
      justify-content: flex-start;
      gap: 8px;
    }
    .start {
      min-height: 104px !important;
      padding-top: 10px !important;
    }
    .start-en {
      font-size: 40px !important;
    }
    .review {
      min-height: 50px !important;
    }
    nav button {
      height: 46px !important;
    }
  }

  /* 背の低い画面（iPhone SE など）では詰める */
  @media (max-height: 740px) and (orientation: portrait) {
    .home {
      gap: 9px;
    }
    .tagline {
      display: none;
    }
    .start {
      min-height: 136px;
      padding-top: 14px;
    }
    .start-en {
      font-size: 48px;
    }
    .arrow {
      width: 42px;
      height: 42px;
      top: 14px;
    }
    .review {
      min-height: 56px;
    }
    nav button {
      height: 50px;
    }
  }
</style>
