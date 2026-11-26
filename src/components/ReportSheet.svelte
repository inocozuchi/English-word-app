<script lang="ts">
  // 「この問題を報告」の下からのシート。理由を選んで送る（端末に保存するだけ）
  import { REPORT_REASONS, type ReportReason } from '../core/reports.ts';
  import { spring, SPRINGS, reducedMotion } from '../core/spring.ts';

  let { id, onsend, onclose }: { id: string; onsend: (reason: ReportReason, comment: string) => void; onclose: () => void } = $props();
  let reason = $state<ReportReason | null>(null);
  let comment = $state('');

  function sheetIn(node: HTMLElement) {
    if (reducedMotion()) return;
    const s = spring(SPRINGS.nav);
    node.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: s.duration, easing: s.easing });
  }
  function fadeIn(node: HTMLElement) {
    node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="scrim" use:fadeIn onclick={onclose} ontouchstart={(e) => e.stopPropagation()}></div>
<div class="sheet" role="dialog" tabindex="-1" aria-modal="true" aria-label="この問題を報告" use:sheetIn ontouchstart={(e) => e.stopPropagation()}>
  <p class="ttl">この問題を報告</p>
  <p class="id en">{id}</p>
  <div class="reasons" role="radiogroup">
    {#each REPORT_REASONS as r}
      <button class="reason press" role="radio" aria-checked={reason === r.id} class:on={reason === r.id} onclick={() => (reason = r.id)}>
        <span class="dot"></span>{r.label}
      </button>
    {/each}
  </div>
  <textarea bind:value={comment} rows="2" placeholder="気づいたこと（任意）"></textarea>
  <div class="acts">
    <button class="cancel press" onclick={onclose}>やめる</button>
    <button class="send press" disabled={!reason} onclick={() => reason && onsend(reason, comment.trim())}>報告する</button>
  </div>
  <p class="hint">この端末に保存されます。設定の「報告した問題」から書き出せます。</p>
</div>

<style>
  .scrim {
    position: absolute;
    inset: 0;
    z-index: 20;
    background: rgba(0, 0, 0, 0.35);
  }
  .sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 21;
    padding: 20px var(--pad-x-r) var(--pad-bottom) var(--pad-x);
    background: var(--bg);
    border-top: var(--panel-border);
    border-radius: 24px 24px 0 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ttl {
    font-size: 18px;
    font-weight: 800;
  }
  .id {
    font-size: 11px;
    color: var(--text3);
    margin-top: -8px;
  }
  .reasons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .reason {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 0 14px;
    border-radius: 14px;
    border: 2px solid var(--line-strong);
    font-size: 15px;
    font-weight: 600;
    text-align: left;
  }
  .reason.on {
    border-color: var(--ink);
  }
  .dot {
    flex: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid var(--text3);
  }
  .reason.on .dot {
    border: 6px solid var(--accent);
  }
  textarea {
    font: inherit;
    font-size: 15px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 2px solid var(--line-strong);
    background: var(--bg);
    color: var(--text);
    resize: none;
  }
  .acts {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 10px;
  }
  .acts button {
    height: 52px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 16px;
  }
  .cancel {
    border: var(--panel-border);
  }
  .send {
    background: var(--accent);
    color: var(--on-accent);
  }
  .send:disabled {
    opacity: 0.4;
  }
  .hint {
    font-size: 11px;
    color: var(--text3);
  }
</style>
