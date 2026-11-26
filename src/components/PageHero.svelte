<script lang="ts">
  // 画面の見出し。ホームと同じ構成（日本語の小見出し＋極太の欧文見出し。*語* をアクセント色に）
  let { ja, en }: { ja: string; en: string } = $props();
  const parts = $derived(en.split(/(\*[^*]+\*)/).filter(Boolean).map((t) => ({ t: t.replace(/\*/g, ''), acc: t.startsWith('*') })));
</script>

<div class="hero">
  <p class="ja">{ja}</p>
  <h1 class="display">{#each parts as p}{#if p.acc}<span class="acc">{p.t}</span>{:else}{p.t}{/if}{/each}</h1>
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
  .acc {
    color: var(--accent);
  }
</style>
