<script lang="ts">
  // 1語の中身（英単語・🔊・意味・例文・メモ）。解説とつづりの答え合わせで使う
  import type { CWord } from './quiz.ts';
  import { canSpeak, speak } from '../../core/speech.ts';
  import { store } from '../../core/store.svelte.ts';
  import Icon from '../../components/Icon.svelte';
  let { w }: { w: CWord } = $props();
  const say = (t: string) => speak(t, undefined, { rate: 0.95, langs: ['en-NZ', 'en-GB', 'en'] });
</script>

<div class="wc">
  <p class="en hw">{w.en}{#if canSpeak() && store.settings.audio}<button class="sp press" onclick={() => say(w.en)} aria-label="読み上げ"><Icon name="speaker" size={18} /></button>{/if}</p>
  <p class="ja">{w.ja}</p>
  {#if w.ex}<p class="ex en">{w.ex}</p>{/if}
  {#if w.note}<p class="note">{w.note}</p>{/if}
</div>

<style>
  .wc {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hw {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .sp {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 2px solid var(--ink);
  }
  .ja {
    font-size: 20px;
    font-weight: 700;
  }
  .ex {
    font-size: 16px;
    padding-left: 12px;
    border-left: 3px solid var(--line-strong);
  }
  .note {
    font-size: 13px;
    color: var(--text2);
  }
</style>
