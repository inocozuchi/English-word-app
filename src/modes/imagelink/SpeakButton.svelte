<script lang="ts">
  // 🔊 英文を読み上げる（Web Speech API、en-US）
  import Icon from '../../components/Icon.svelte';
  import { canSpeak, speak } from '../../core/speech.ts';
  let { text, size = 40 }: { text: string; size?: number } = $props();
  let playing = $state(false);
  function play(e: Event) {
    e.stopPropagation();
    playing = true;
    speak(text, () => (playing = false));
  }
</script>

{#if canSpeak()}
  <button class="sp press" class:playing style:--s="{size}px" onclick={play} aria-label="読み上げ"><Icon name="speaker" size={Math.round(size * 0.5)} stroke={2.2} /></button>
{/if}

<style>
  .sp {
    flex: none;
    width: var(--s);
    height: var(--s);
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 2px solid var(--ink);
    color: var(--text);
    transition: background-color 0.2s, color 0.2s;
  }
  .sp.playing {
    background: var(--ink);
    color: var(--bg);
  }
</style>
