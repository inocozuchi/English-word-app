<script lang="ts">
  // 復習リスト: まちがえた問題の一覧。連続正解の進み具合を点で示し、手動で外すこともできる
  import Page from '../components/Page.svelte';
  import Icon from '../components/Icon.svelte';
  import { router } from '../core/router.svelte.ts';
  import { store, activeDeck, loadData, removeFromReview } from '../core/store.svelte.ts';
  import { reviewOrder } from '../core/review.ts';
  import { createRng } from '../core/rng.ts';
  import { haptic } from '../core/haptics.ts';

  loadData();
  const deck = $derived(activeDeck());
  const goal = $derived(store.settings.reviewGoal);
  const entries = $derived(deck.ready() ? reviewOrder(store.progress.review, deck.id, createRng(1)) : []);

  function start() {
    haptic('light');
    router.push({ name: 'quiz', params: { seed: Date.now(), mode: 'review' } }, 'modal');
  }
  function open(key: string) {
    const r = deck.detailRoute(key);
    if (r) router.push(r);
  }
</script>

<Page title="復習リスト">
  <p class="eyebrow-en">Review</p>
  <h1 class="ui-title">復習リスト</h1>
  <p class="lead">まちがえた問題が自動で入ります。<b>{goal}回続けて正解</b>するとリストから外れます。</p>

  {#if entries.length}
    <ul class="ui-group list">
      {#each entries as e (e.key)}
        {@const lb = deck.label(e.key)}
        {#if lb}
          <li>
            <button class="row" onclick={() => open(e.key)}>
              <span class="main">
                <span class="t"><span class:en={lb.latin}>{lb.title}</span>{#if lb.tag}<span class="tag">{lb.tag}</span>{/if}</span>
                <span class="s">{lb.sub}</span>
              </span>
              <span class="dots" aria-label="連続正解 {e.streak}/{goal}">
                {#each Array(goal) as _, k}<span class="dot" class:on={k < e.streak}></span>{/each}
              </span>
            </button>
            <button class="remove press" onclick={() => removeFromReview(e.key)} aria-label="{lb.title} をリストから外す">外す</button>
          </li>
        {/if}
      {/each}
    </ul>
  {:else}
    <div class="empty">
      <Icon name="review" size={32} />
      <p>復習リストは空です</p>
      <p class="sub">クイズでまちがえた問題が、ここに自動で入ります。</p>
    </div>
  {/if}

  {#snippet footer()}
    <button class="start press" disabled={!entries.length} onclick={start}>
      <span class="display">Review</span><span class="ja">復習する（{Math.min(entries.length, store.settings.count)}問）</span>
    </button>
  {/snippet}
</Page>

<style>
  .lead {
    font-size: 14px;
    color: var(--text2);
    margin-bottom: 18px;
    line-height: 1.6;
  }
  .lead b {
    color: var(--text);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list li {
    display: flex;
    align-items: center;
  }
  .list li + li {
    border-top: 0.5px solid var(--line);
  }
  .row {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 6px 12px 18px;
    text-align: left;
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .t {
    font-size: 17px;
    font-weight: 650;
  }
  .tag {
    margin-left: 8px;
    font-size: 10px;
    font-weight: 700;
    color: var(--text2);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 0 5px;
    vertical-align: 0.2em;
  }
  .s {
    font-size: 13px;
    color: var(--text2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dots {
    display: flex;
    gap: 4px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--text3);
  }
  .dot.on {
    background: var(--accent);
    border-color: var(--accent);
  }
  .remove {
    flex: none;
    margin-right: 10px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
    background: var(--fill);
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 48px 0;
    color: var(--text3);
    text-align: center;
  }
  .empty p {
    color: var(--text);
    font-weight: 600;
  }
  .empty .sub {
    color: var(--text2);
    font-weight: 400;
    font-size: 14px;
  }
  .start {
    width: 100%;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border-radius: 20px;
    border: var(--frame) solid var(--ink);
    background: var(--accent);
    color: var(--on-accent);
  }
  .start:disabled {
    background: var(--fill);
    color: var(--text3);
    border-color: var(--line-strong);
  }
  .start .display {
    font-size: 26px;
  }
  .start .ja {
    font-size: 14px;
    font-weight: 700;
  }
</style>
