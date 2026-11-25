<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import { router } from '../lib/router.svelte.ts';
  import { store, loadData, today } from '../lib/store.svelte.ts';
  import { streak } from '../lib/day.ts';
  import { dayKey } from '../lib/day.ts';
  import { dueCount, settingsSummary } from '../lib/summary.ts';
  import { haptic } from '../lib/haptics.ts';

  const t = $derived(today());
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
  <div class="top">
    <p class="brand">語源で英単語</p>
  </div>

  <div class="center">
    <button class="start press" onclick={start} aria-label="スタート">
      <span class="label">スタート</span>
    </button>
    <button class="summary" onclick={() => router.push({ name: 'settings' })}>{summary}</button>
  </div>

  <div class="stats">
    <div class="stat">
      <span class="num">{days}<small>日</small></span>
      <span class="cap">連続</span>
    </div>
    <div class="stat">
      <span class="num">{todayCount}<small>問</small></span>
      <span class="cap">今日</span>
    </div>
    <div class="stat">
      <span class="num">{due}<small>語</small></span>
      <span class="cap">復習待ち</span>
    </div>
  </div>

  <nav>
    <button class="press" onclick={() => router.push({ name: 'book' })}><Icon name="book" /><span>単語帳</span></button>
    <button class="press" onclick={() => router.push({ name: 'stats' })}><Icon name="chart" /><span>記録</span></button>
    <button class="press" onclick={() => router.push({ name: 'settings' })}><Icon name="gear" /><span>設定</span></button>
  </nav>
</div>

<style>
  .home {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: var(--pad-top) var(--pad-x-r) var(--pad-bottom) var(--pad-x);
  }
  .top {
    height: 44px;
    display: flex;
    align-items: center;
  }
  .brand {
    font-size: 15px;
    font-weight: 600;
    color: var(--text2);
    letter-spacing: 0.04em;
  }
  .center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 22px;
  }
  .start {
    width: min(62vw, 240px);
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--accent);
    color: var(--on-accent);
    display: grid;
    place-items: center;
    box-shadow: 0 12px 32px -8px color-mix(in srgb, var(--accent) 55%, transparent);
  }
  .label {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  .summary {
    font-size: 14px;
    color: var(--text2);
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--fill);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin-bottom: 28px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .num {
    font-size: 28px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    font-family: var(--font-en);
    line-height: 1.1;
  }
  .num small {
    font-size: 13px;
    font-weight: 600;
    margin-left: 2px;
    color: var(--text2);
    font-family: var(--font-ja);
  }
  .cap {
    font-size: 12px;
    color: var(--text2);
  }
  nav {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  nav button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 0 10px;
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font-size: 13px;
  }
  nav button :global(svg) {
    color: var(--text2);
  }
</style>
