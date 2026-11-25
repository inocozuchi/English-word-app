<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import Num from '../components/Num.svelte';
  import { booted, isBooted } from '../core/boot.ts';
  import { stagger } from '../core/transitions.ts';
  import { router } from '../core/router.svelte.ts';
  import { store, activeDeck, deckSettings, loadData } from '../core/store.svelte.ts';
  import { streak, dayKey } from '../core/day.ts';
  import { isDue } from '../core/srs.ts';
  import { reviewCount } from '../core/review.ts';
  import { haptic } from '../core/haptics.ts';

  loadData();
  const deck = $derived(activeDeck());
  const t = $derived(store.today);
  const days = $derived(streak(store.progress.days, t));
  const todayCount = $derived(store.progress.days[dayKey(t)]?.a ?? 0);
  const inReview = $derived(reviewCount(store.progress.review, deck.id));
  /** 出題範囲で、今日の復習待ち（間隔反復の期限が来ている問題） */
  const due = $derived.by(() => {
    if (!deck.ready()) return 0;
    let n = 0;
    for (const c of deck.candidates(deckSettings(deck))) {
      const st = store.progress.items[c.key];
      if (st && isDue(st, t)) n++;
    }
    return n;
  });
  const summary = $derived(`${store.settings.count}問 · ${deck.summary(deckSettings(deck))}`);

  // 大見出し: \n で改行、*語* をアクセント色に
  const hero = $derived(
    deck.hero.split('\n').map((line) => line.split(/(\*[^*]+\*)/).filter(Boolean).map((t) => ({ t: t.replace(/\*/g, ''), acc: t.startsWith('*') }))),
  );

  // 起動時だけ、要素を上から順に静かに出す（配置が確定してから。core/boot.ts）
  let root: HTMLElement;
  onMount(() => {
    if (!isBooted()) booted.then(() => stagger([...root.querySelectorAll('[data-intro]')], { step: 55 }));
  });

  async function start(mode: 'normal' | 'review') {
    haptic('light');
    await loadData();
    router.push({ name: 'quiz', params: { seed: Date.now(), mode } }, 'modal');
  }
</script>

<div class="home" bind:this={root}>
  <header data-intro>
    <div class="logo en" aria-label="語源で英単語"><span>ETYMO</span><span>WORDS</span></div>
    <button class="icon press" onclick={() => router.push({ name: 'settings' })} aria-label="設定"><Icon name="gear" size={24} /></button>
  </header>

  <div class="hero" data-intro>
    <p class="deck"><span class="chip">{deck.title}</span>{#if deck.stat()}<span class="stat">{deck.stat()}</span>{/if}</p>
    <p class="tagline">{deck.tagline}</p>
    <h1 class="display">
      {#each hero as line, li}{#if li > 0}<br />{/if}{#each line as part}{#if part.acc}<span class="acc">{part.t}</span>{:else}{part.t}{/if}{/each}{/each}
    </h1>
  </div>

  <button class="start press" data-intro onclick={() => start('normal')} aria-label="スタート">
    <span class="start-en display">Start</span>
    <span class="start-ja">スタート</span>
    <span class="start-sum">{summary}</span>
    <span class="arrow"><Icon name="chevron" size={30} stroke={3} /></span>
  </button>

  <button class="review press" data-intro class:empty={!inReview} onclick={() => (inReview ? start('review') : router.push({ name: 'review' }))}>
    <span class="r-icon"><Icon name="review" size={22} /></span>
    <span class="r-txt">
      <span class="r-title">復習する</span>
      <span class="r-sub">{inReview ? 'まちがえた問題だけを出題' : 'まちがえた問題がここに入ります'}</span>
    </span>
    <span class="r-num en"><Num value={inReview} /></span>
  </button>

  <div class="stats" data-intro>
    <div class="stat-c">
      <span class="num en"><Num value={days} /></span>
      <span class="cap">連続日数</span>
    </div>
    <div class="stat-c">
      <span class="num en"><Num value={todayCount} /></span>
      <span class="cap">今日の回答</span>
    </div>
    <div class="stat-c">
      <span class="num en"><Num value={due} /></span>
      <span class="cap">期限の来た語</span>
    </div>
  </div>

  <nav data-intro>
    {#if deck.browse}
      <button class="press" onclick={() => router.push(deck.browse!.route)}><Icon name="book" size={20} /><span>{deck.browse.label}</span></button>
    {/if}
    <button class="press" onclick={() => router.push({ name: 'review' })}><Icon name="review" size={20} /><span>復習リスト</span></button>
    <button class="press" onclick={() => router.push({ name: 'stats' })}><Icon name="chart" size={20} /><span>記録</span></button>
  </nav>
</div>

<style>
  .home {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: var(--pad-top) var(--pad-x-r) var(--pad-bottom) var(--pad-x);
    gap: 12px;
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
  .deck {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .chip {
    padding: 2px 9px;
    border-radius: 999px;
    border: 1.5px solid var(--ink);
    font-weight: 700;
  }
  .stat {
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

  /* 背の低い画面（iPhone SE など）では詰める */
  @media (max-height: 740px) {
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
