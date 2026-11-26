<script lang="ts">
  // 画面の見出し。ホームと同じ構成（日本語の小見出し＋極太の欧文見出し。*語* をアクセント色に）
  // 開いたとき、欧文の見出しは下から「せり上がる」（文字の下半分を隠した枠の中を上がってくる）
  import { spring, SPRINGS, reducedMotion } from '../core/spring.ts';
  let { ja, en }: { ja: string; en: string } = $props();
  const parts = $derived(en.split(/(\*[^*]+\*)/).filter(Boolean).map((t) => ({ t: t.replace(/\*/g, ''), acc: t.startsWith('*') })));

  function rise(node: HTMLElement, delay: number) {
    if (reducedMotion()) return;
    const s = spring(SPRINGS.card);
    node.animate([{ transform: 'translateY(105%)' }, { transform: 'none' }], { duration: s.duration, easing: s.easing, delay, fill: 'backwards' });
  }
  function fade(node: HTMLElement) {
    if (reducedMotion()) return;
    node.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'ease-out', delay: 40, fill: 'backwards' });
  }
</script>

<div class="hero">
  <p class="ja" use:fade>{ja}</p>
  <h1 class="display"><span class="mask"><span class="inner" use:rise={90}>{#each parts as p}{#if p.acc}<span class="acc">{p.t}</span>{:else}{p.t}{/if}{/each}</span></span></h1>
</div>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 4px 0 18px;
  }
  .ja {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  h1 {
    font-size: clamp(38px, 11vw, 50px);
  }
  .mask {
    display: block;
    overflow: hidden;
    /* 字の下端（descender）が切れないように少し余白 */
    padding-bottom: 0.06em;
    margin-bottom: -0.06em;
  }
  .inner {
    display: block;
  }
  .acc {
    color: var(--accent);
  }
</style>
