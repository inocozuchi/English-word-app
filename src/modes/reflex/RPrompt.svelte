<script lang="ts">
  // 反射版の問題文: 短い指示＋語（大きく）・イメージ（日本語）・図。ひと目で読めるように
  // 問題文（question）は「「冠詞（…）」の図はどれ？」のように語を繰り返すので、型ごとの短い指示にする
  import type { RQuestion } from './types.ts';
  import { figSrc } from './state.svelte.ts';
  let { q }: { q: RQuestion } = $props();
  const ASK: Record<string, string> = {
    r_word2image: 'コアイメージは？',
    r_image2word: 'この語は？',
    r_prep_icon: 'この前置詞は？',
    r_prep_word2icon: 'このアイコンは？',
    r_fig2word: 'この図は？',
    r_word2fig: '合う図は？',
  };
</script>

<div class="rp" class:hasfig={!!q.figure}>
  <p class="qq">{ASK[q.type] ?? q.question}</p>
  {#if q.figure}
    <div class="fig" class:icon={q.type === 'r_prep_icon'}><img src={figSrc(q.figure)} alt="問題の図" draggable="false" /></div>
  {:else if q.prompt_en}
    <p class="word en">{q.prompt_en}</p>
  {:else if q.prompt_ja}
    <p class="ja" class:long={q.prompt_ja.length > 14}>{q.prompt_ja}</p>
  {/if}
</div>

<style>
  .rp {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-align: center;
    min-height: 0;
  }
  .qq {
    font-size: 13px;
    font-weight: 700;
    color: var(--text2);
    letter-spacing: 0.04em;
  }
  .word {
    font-size: clamp(44px, 14vw, 64px);
    font-weight: 850;
    letter-spacing: -0.03em;
    line-height: 1.05;
  }
  .ja {
    font-size: clamp(24px, 7.2vw, 30px);
    font-weight: 850;
    line-height: 1.35;
  }
  .ja.long {
    font-size: clamp(20px, 6vw, 24px);
  }
  .fig {
    width: 100%;
    min-height: 0;
    flex: 0 1 auto;
    max-height: 100%;
    display: grid;
    place-items: center;
    background: #fff;
    border-radius: 18px;
    border: var(--card-border);
    padding: 10px 6px;
  }
  .fig img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 38vh;
    object-fit: contain;
  }
  .fig.icon {
    flex: none;
    width: auto;
    padding: 12px 22px;
  }
  .fig.icon img {
    width: auto;
    height: min(30vh, 220px);
  }
</style>
