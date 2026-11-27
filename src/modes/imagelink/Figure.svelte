<script lang="ts">
  // イメージ図: 画面幅いっぱいに表示。ダブルタップ（または右下の虫めがね）で拡大表示。
  // 図は白地で描かれているので、ダークモードでも白いカードに載せる。
  import Icon from '../../components/Icon.svelte';
  import { overlay } from '../../core/overlay.svelte.ts';
  import { spring, SPRINGS, reducedMotion } from '../../core/spring.ts';

  let { src, alt = 'イメージ図', compact = false }: { src: string; alt?: string; compact?: boolean } = $props();
  let zoomed = $state(false);
  let lastTap = 0;

  function tap(e: Event) {
    const now = Date.now();
    if (now - lastTap < 320) {
      e.preventDefault();
      open();
      lastTap = 0;
    } else lastTap = now;
  }
  function open() {
    if (zoomed) return;
    zoomed = true;
    overlay.count++;
  }
  function close() {
    if (!zoomed) return;
    zoomed = false;
    overlay.count--;
  }
  $effect(() => () => {
    if (zoomed) overlay.count--;
  });
  /** Esc で拡大を閉じる（クイズの Esc＝やめる より先に受け取る） */
  function esc(e: KeyboardEvent) {
    if (zoomed && e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
  }
  /** マウスでは図をつかんで動かせる（タッチは指でスクロール） */
  function pan(node: HTMLElement) {
    let sx = 0, sy = 0, l = 0, t = 0, id = -1;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      id = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      l = node.scrollLeft;
      t = node.scrollTop;
      node.setPointerCapture(id);
      node.classList.add('grabbing');
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      node.scrollLeft = l - (e.clientX - sx);
      node.scrollTop = t - (e.clientY - sy);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      node.classList.remove('grabbing');
    };
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
  }
  /** 拡大表示は body の直下に移す（クイズのカードは transform で動くので、その中だと画面全体を覆えない）。
   *  最初は図の真ん中が見えるようにスクロールしておく */
  function zoomIn(node: HTMLElement) {
    document.body.appendChild(node);
    const sc = node.querySelector('.lb-scroll') as HTMLElement | null;
    const center = () => sc && (sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2);
    center();
    node.querySelector('img')?.addEventListener('load', center, { once: true });
    if (reducedMotion()) return;
    const s = spring(SPRINGS.card);
    node.animate([{ transform: 'scale(0.92)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: s.duration, easing: s.easing });
  }
</script>

<svelte:window onkeydowncapture={esc} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="fig" class:compact onclick={tap}>
  <img {src} {alt} draggable="false" />
  <button class="zb press" onclick={(e) => { e.stopPropagation(); open(); }} aria-label="図を拡大"><Icon name="zoom" size={18} /></button>
</div>

{#if zoomed}
  <div class="lb" role="dialog" tabindex="-1" aria-modal="true" aria-label="図の拡大" use:zoomIn ontouchstart={(e) => e.stopPropagation()}>
    <div class="lb-scroll" use:pan><img {src} {alt} draggable="false" /></div>
    <button class="lb-close press" onclick={close} aria-label="閉じる"><Icon name="close" size={22} /></button>
    <p class="lb-hint">ドラッグ・スクロールで図を動かせます（Esc で閉じる）</p>
  </div>
{/if}

<style>
  .fig {
    position: relative;
    flex: none;
    background: #fff;
    border-radius: 16px;
    border: var(--card-border);
    padding: 8px;
  }
  .fig img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 34vh;
    object-fit: contain;
  }
  .fig.compact img {
    max-height: 20vh;
  }
  .zb {
    position: absolute;
    right: 6px;
    bottom: 6px;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    color: #111114;
    border: 1.5px solid #d6d6dc;
  }
  .lb {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: #fff;
    display: flex;
    flex-direction: column;
    padding: var(--pad-top) 0 var(--pad-bottom);
  }
  .lb-scroll {
    flex: 1;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    display: flex;
    align-items: center;
  }
  .lb-scroll img {
    flex: none;
    width: 200vw;
    max-width: none;
    height: auto;
  }
  .lb-close {
    position: absolute;
    top: var(--pad-top);
    right: var(--pad-x-r);
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #111114;
    color: #fff;
  }
  .lb-hint {
    text-align: center;
    font-size: 12px;
    color: #6b6b73;
    padding-top: 8px;
  }
  @media (hover: hover) and (pointer: fine) {
    .lb-scroll {
      cursor: grab;
    }
    .lb-scroll:global(.grabbing) {
      cursor: grabbing;
    }
  }
</style>
