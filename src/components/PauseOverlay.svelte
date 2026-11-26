<script lang="ts">
  // 一時停止の画面。押すまで止まったまま（アプリを離れて戻っても勝手に再開しない）。
  // 「再開する」は親指の届く下側に大きく。中断すると続きはホームから
  import { spring, SPRINGS, reducedMotion } from '../core/spring.ts';
  import Icon from './Icon.svelte';

  let {
    progress = '',
    note = 'タイマーは止まっています。アプリを閉じても、ここから続けられます。',
    onresume,
    onsuspend,
  }: { progress?: string; note?: string; onresume: () => void; onsuspend?: () => void } = $props();

  function fadeIn(node: HTMLElement) {
    if (reducedMotion()) return;
    node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
  }
  function popIn(node: HTMLElement) {
    if (reducedMotion()) return;
    const s = spring(SPRINGS.card);
    node.animate([{ transform: 'translateY(40px) scale(0.96)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: s.duration, easing: s.easing });
  }
  /** 一時停止のマークがゆっくり脈打つ（止まっていることが分かるように。点滅はしない） */
  function breathe(node: HTMLElement) {
    if (reducedMotion()) return;
    const a = node.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 2400, iterations: Infinity, easing: 'ease-in-out' });
    return { destroy: () => a.cancel() };
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="po" use:fadeIn ontouchstart={(e) => e.stopPropagation()} onmousedown={(e) => e.stopPropagation()} onclick={(e) => e.stopPropagation()}>
  <div class="panel" role="dialog" aria-modal="true" aria-label="一時停止中" use:popIn>
    <span class="mark" use:breathe aria-hidden="true"><Icon name="pause" size={34} stroke={3} /></span>
    <p class="eyebrow-en">Paused</p>
    <p class="ttl display">一時停止中</p>
    {#if progress}<p class="prog en">{progress}</p>{/if}
    <p class="note">{note}</p>
    <div class="acts">
      <!-- svelte-ignore a11y_autofocus -->
      <button class="resume press" onclick={onresume} autofocus><span aria-hidden="true">▶</span>再開する</button>
      {#if onsuspend}<button class="sus press" onclick={onsuspend}>中断してホームへ</button>{/if}
    </div>
  </div>
</div>

<style>
  .po {
    position: absolute;
    inset: 0;
    z-index: 30;
    background: color-mix(in srgb, var(--bg) 95%, transparent);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: var(--pad-top) var(--pad-x-r) var(--pad-bottom) var(--pad-x);
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 24px 22px 22px;
    border: var(--panel-border);
    border-radius: 28px;
    background: var(--bg);
  }
  .mark {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--ink);
    color: var(--bg);
    margin-bottom: 6px;
  }
  .ttl {
    font-size: 40px;
  }
  .prog {
    font-size: 15px;
    font-weight: 800;
    color: var(--text2);
  }
  .note {
    font-size: 13px;
    color: var(--text2);
    line-height: 1.6;
  }
  .acts {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 12px;
  }
  .resume {
    min-height: 68px;
    border-radius: 22px;
    background: var(--accent);
    color: var(--on-accent);
    border: var(--frame) solid var(--ink);
    font-size: 20px;
    font-weight: 850;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .sus {
    min-height: 54px;
    border-radius: 18px;
    border: var(--frame) solid var(--ink);
    font-size: 16px;
    font-weight: 800;
  }
</style>
