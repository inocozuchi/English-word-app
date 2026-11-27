<script lang="ts">
  // 新しい項目の学習カード（認識）。英語・音声・カナ・意味・例文・関連する図解（折りたたみ）。
  // このあと同じ項目の「思い出す問題」が出る。
  import type { Item } from '../types.ts';
  import type { CompIndex } from '../course.ts';
  import ItemInfo from './ItemInfo.svelte';
  import Visual from './Visual.svelte';
  import { speak } from '../../../core/speech.ts';
  import { modeSettings, store } from '../../../core/store.svelte.ts';
  import { compMode } from '../mode.ts';
  import { VOICE_LANGS } from '../settings.ts';
  import { onMount } from 'svelte';

  let { ix, item, done, onseen, onnext }: { ix: CompIndex; item: Item; done: boolean; onseen: () => void; onnext: () => void } = $props();
  const visuals = $derived((ix.itemVisual.get(item.id) ?? []).slice(0, 2));
  onMount(() => {
    const s = modeSettings(compMode);
    if (s.autoPlay && store.settings.audio) setTimeout(() => speak(item.english, undefined, { rate: s.rate, langs: VOICE_LANGS }), 300);
  });
  function next() {
    if (!done) onseen();
    onnext();
  }
</script>

<div class="lc">
  <div class="top scroll">
    <p class="kind">新しい{item.kind === 'vocabulary' ? '単語' : item.kind === 'idiom' ? '熟語' : 'チャンク'}{#if item.priority !== 'core'}<span class="pri">{item.priority === 'recommended' ? 'おすすめ' : '発展'}</span>{/if}</p>
    <ItemInfo {item} large />
    {#if visuals.length}
      <details class="more">
        <summary>図解を見る（{visuals.length}）</summary>
        <div class="vs">{#each visuals as v (v.id)}<Visual {v} />{/each}</div>
      </details>
    {/if}
    <p class="tip">声に出して読んでから進みましょう。次に、日本語から思い出す問題が出ます。</p>
  </div>
  <div class="bottom"><button class="pri press" onclick={next}>覚えた・次へ</button></div>
</div>

<style>
  .lc {
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
  .kind {
    font-size: 12px;
    font-weight: 800;
    color: var(--text2);
    display: flex;
    gap: 8px;
  }
  .pri {
    font-size: 11px;
    padding: 0 7px;
    border-radius: 999px;
    border: 1.5px solid var(--line-strong);
    color: var(--text3);
  }
  .more summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    font-size: 14px;
    font-weight: 800;
    color: var(--accent);
  }
  .vs {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tip {
    font-size: 12px;
    color: var(--text3);
  }
  .bottom {
    flex: none;
    padding-top: 8px;
  }
  .pri {
    width: 100%;
    min-height: 56px;
    border-radius: 18px;
    font-size: 16px;
    font-weight: 800;
    background: var(--accent);
    color: var(--on-accent);
    border: var(--frame) solid var(--ink);
  }
  .kind .pri {
    width: auto;
    min-height: 0;
    background: none;
    color: var(--text3);
    border: 1.5px solid var(--line-strong);
    font-size: 11px;
    border-radius: 999px;
  }
</style>
