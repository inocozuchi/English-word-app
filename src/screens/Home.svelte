<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import { router } from '../lib/router.svelte.ts';
  import { store, loadData } from '../lib/store.svelte.ts';
  import { streak, dayKey } from '../lib/day.ts';
  import { dueCount, settingsSummary } from '../lib/summary.ts';
  import { haptic } from '../lib/haptics.ts';

  const t = $derived(store.today);
  const days = $derived(streak(store.progress.days, t));
  const todayCount = $derived(store.progress.days[dayKey(t)]?.a ?? 0);
  const due = $derived(store.index ? dueCount(store.index, store.settings, store.progress, t) : 0);
  const summary = $derived(settingsSummary(store.index, store.settings));

  async function start() {
    haptic('light');
    if (!store.index) await loadData();
    router.push({ name: 'quiz', seed: Date.now() }, 'modal');
  }
</script>

<div class="home">
  <header>
    <div class="logo en" aria-label="語源で英単語"><span>ETYMO</span><span>WORDS</span></div>
    <button class="icon press" onclick={() => router.push({ name: 'settings' })} aria-label="設定"><Icon name="gear" size={24} /></button>
  </header>

  <div class="hero">
    <p class="tagline">語源で、英単語を。</p>
    <h1 class="display">Learn words<br />by <span class="acc">roots</span></h1>
  </div>

  <button class="start press" onclick={start} aria-label="スタート">
    <span class="start-en display">Start</span>
    <span class="start-ja">スタート</span>
    <span class="start-sum">{summary}</span>
    <span class="arrow"><Icon name="chevron" size={30} stroke={3} /></span>
  </button>

  <div class="stats">
    <div class="stat">
      <span class="num en">{days}</span>
      <span class="cap">連続日数</span>
    </div>
    <div class="stat">
      <span class="num en">{todayCount}</span>
      <span class="cap">今日の回答</span>
    </div>
    <div class="stat">
      <span class="num en">{due}</span>
      <span class="cap">復習待ち</span>
    </div>
  </div>

  <nav>
    <button class="press" onclick={() => router.push({ name: 'book' })}><Icon name="book" size={22} /><span>単語帳</span></button>
    <button class="press" onclick={() => router.push({ name: 'stats' })}><Icon name="chart" size={22} /><span>学習記録</span></button>
  </nav>
</div>

<style>
  .home {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: var(--pad-top) var(--pad-x-r) var(--pad-bottom) var(--pad-x);
    gap: 14px;
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
    gap: 10px;
    min-height: 0;
  }
  .tagline {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.04em;
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
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto auto;
    align-items: end;
    text-align: left;
    min-height: 196px;
    padding: 22px 22px 20px 24px;
    border: var(--frame) solid var(--ink);
    border-radius: 28px;
    background: var(--accent);
    color: var(--on-accent);
  }
  .start-en {
    grid-column: 1;
    font-size: 64px;
  }
  .start-ja {
    grid-column: 1;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.12em;
    margin-top: 6px;
  }
  .start-sum {
    grid-column: 1;
    font-size: 13px;
    opacity: 0.85;
    margin-top: 2px;
  }
  .arrow {
    position: absolute;
    top: 20px;
    right: 18px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--on-accent);
    color: var(--accent);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: var(--frame) solid var(--ink);
    border-radius: 20px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    padding: 12px 14px 11px;
    gap: 2px;
  }
  .stat + .stat {
    border-left: var(--frame) solid var(--ink);
  }
  .num {
    font-size: 30px;
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
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  nav button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 56px;
    border-radius: 18px;
    border: var(--frame) solid var(--ink);
    font-size: 15px;
    font-weight: 700;
  }
</style>
