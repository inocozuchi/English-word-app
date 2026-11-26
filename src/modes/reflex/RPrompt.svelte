<script lang="ts">
  // 反射版の問題文: 語（大きく）・イメージ（日本語）・図。短く、ひと目で
  import type { RQuestion } from './types.ts';
  import { figureUrl } from './engine.ts';
  let { q }: { q: RQuestion } = $props();
</script>

<div class="rp">
  <p class="qq">{q.question}</p>
  {#if q.figure}
    <div class="fig"><img src={figureUrl(q.figure)} alt="問題の図" draggable="false" /></div>
  {:else if q.prompt_en}
    <p class="word en">{q.prompt_en}</p>
  {:else if q.prompt_ja}
    <p class="ja">{q.prompt_ja}</p>
  {/if}
</div>

<style>
  .rp {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    text-align: center;
    min-height: 0;
  }
  .qq {
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
  }
  .word {
    font-size: clamp(40px, 13vw, 60px);
    font-weight: 850;
    letter-spacing: -0.03em;
    line-height: 1.05;
  }
  .ja {
    font-size: clamp(22px, 6.6vw, 28px);
    font-weight: 800;
    line-height: 1.4;
  }
  .fig {
    width: 100%;
    min-height: 0;
    display: grid;
    place-items: center;
    background: #fff;
    border-radius: 18px;
    border: var(--card-border);
    padding: 8px;
  }
  .fig img {
    width: 100%;
    height: 100%;
    max-height: 30vh;
    object-fit: contain;
  }
</style>
