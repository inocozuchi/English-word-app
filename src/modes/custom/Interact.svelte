<script lang="ts">
  import { typingOf } from '../../core/storage.ts';
  // つづり: 意味を見て英単語を入力する。大文字小文字・前後の空白・文末の記号は無視。
  // 「文字を入力する問題」を「頭の中で」にしているときは、入力せずに答えを見て自己採点
  import type { Snippet } from 'svelte';
  import type { InteractResult } from '../../core/mode.ts';
  import type { CQuestion } from './quiz.ts';
  import { normWord } from './quiz.ts';
  import { store } from '../../core/store.svelte.ts';
  import { haptic } from '../../core/haptics.ts';
  import { stagger } from '../../core/transitions.ts';
  import WordCard from './WordCard.svelte';
  import { choiceIndex, isNextKey, inField } from '../../core/keys.ts';

  let { q, phase, onanswer, status }: { q: CQuestion; phase: 'ask' | 'reveal'; onanswer: (r: InteractResult) => void; status: Snippet } = $props();
  const w = $derived(q.data.word);
  const think = $derived(typingOf(store.settings) === 'self');
  let text = $state('');
  let shown = $state(false);
  let given = $state('');
  let ok = $state<boolean | null>(null);

  function check() {
    if (phase !== 'ask' || !text.trim()) return;
    given = text.trim();
    ok = normWord(given) === normWord(w.en);
    haptic(ok ? 'success' : 'error');
    onanswer({ ok, given });
  }
  function giveUp() {
    if (phase !== 'ask') return;
    given = text.trim();
    ok = false;
    onanswer({ ok: false, given });
  }
  function judge(level: 0 | 1 | 2) {
    ok = level > 0;
    onanswer({ ok: level > 0, conf: level === 2 ? 'high' : 'low' });
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      check();
    }
  }
  /** 「頭の中で」のとき: 次へのキーで答えを見る、選ぶキー（A S D など）で 違った／あやしい／合っていた */
  function onWinKey(e: KeyboardEvent) {
    if (phase !== 'ask' || !think || inField(e.target) || e.metaKey || e.ctrlKey || e.altKey || root?.closest('[inert]')) return;
    const k = choiceIndex(e, store.settings);
    if (!shown && isNextKey(e, store.settings)) {
      e.preventDefault();
      shown = true;
    } else if (shown && k >= 0 && k < 3) {
      e.preventDefault();
      judge(k as 0 | 1 | 2);
    }
  }
  let root: HTMLElement | undefined = $state();
  function riseIn(node: HTMLElement) {
    stagger([...node.children], { step: 50, distance: 12 });
  }
  /** 入力と正解を1文字ずつ比べる（違う文字に印） */
  const diff = $derived.by(() => {
    const a = given, b = w.en;
    return [...a].map((c, i) => ({ c, ok: (b[i] ?? '').toLowerCase() === c.toLowerCase() }));
  });
</script>

<svelte:window onkeydown={onWinKey} />

<div class="sp" bind:this={root}>
  <div class="top scroll">
    <div class="status-slot">{#if phase === 'reveal'}{@render status()}{/if}</div>
    <p class="ask">この意味の英単語を{think ? '思い浮かべる' : '書く'}</p>
    <h2 class="ja">{w.ja}</h2>
    {#if phase === 'reveal' || shown}
      <div use:riseIn class="ans">
        {#if given && ok === false}<p class="mine en">あなた：{#each diff as d}<span class:bad={!d.ok}>{d.c}</span>{/each}</p>{/if}
        <WordCard {w} />
      </div>
    {/if}
  </div>
  {#if phase === 'ask'}
    <div class="bottom">
      {#if think}
        {#if !shown}
          <button class="pri press" onclick={() => (shown = true)}>答えを見る</button>
        {:else}
          <div class="acts three">
            <button class="sec press" onclick={() => judge(0)}>違った</button>
            <button class="sec press" onclick={() => judge(1)}>あやしい</button>
            <button class="pri press" onclick={() => judge(2)}>合っていた</button>
          </div>
        {/if}
      {:else}
        <input bind:value={text} type="text" lang="en" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="英単語を入力" onkeydown={key} aria-label="英単語" />
        <div class="acts">
          <button class="sec press" onclick={giveUp}>わからない</button>
          <button class="pri press" onclick={check} disabled={!text.trim()}>答え合わせ</button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .sp {
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
  .status-slot {
    min-height: 30px;
    display: flex;
    align-items: center;
  }
  .status-slot > :global(*) {
    flex: 1;
  }
  .ask {
    font-size: 13px;
    font-weight: 600;
    color: var(--text3);
  }
  .ja {
    font-size: clamp(24px, 7vw, 32px);
    font-weight: 850;
  }
  .ans {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    border: var(--card-border);
    border-radius: 18px;
  }
  .mine {
    font-size: 18px;
    color: var(--text2);
  }
  .bad {
    text-decoration: underline wavy;
    color: var(--text);
    font-weight: 800;
  }
  .bottom {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 8px;
  }
  input {
    font: inherit;
    font-family: var(--font-en);
    font-size: 20px;
    padding: 14px 16px;
    border-radius: 16px;
    border: var(--panel-border);
    background: var(--bg);
    color: var(--text);
  }
  .acts {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 10px;
  }
  .acts.three {
    grid-template-columns: 1fr 1fr 1.3fr;
  }
  .acts button,
  .bottom > .pri {
    min-height: 58px;
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
  button:disabled {
    opacity: 0.35;
  }
</style>
