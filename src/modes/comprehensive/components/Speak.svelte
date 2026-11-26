<script lang="ts">
  // 🔊 読み上げ（en-NZ → en-GB → ほかの英語）。速さは設定の 0.75 / 1 / 1.25。再生回数を数える。もう一度押すと止める
  import Icon from '../../../components/Icon.svelte';
  import { canSpeak, speak, stopSpeaking } from '../../../core/speech.ts';
  import { modeSettings } from '../../../core/store.svelte.ts';
  import { compMode } from '../mode.ts';
  import { VOICE_LANGS } from '../settings.ts';

  let {
    text,
    size = 44,
    label = '読み上げ',
    rate,
    big = false,
    onplay,
  }: { text: string; size?: number; label?: string; rate?: number; big?: boolean; onplay?: () => void } = $props();
  let playing = $state(false);
  function toggle(e: Event) {
    e.stopPropagation();
    if (playing) {
      stopSpeaking();
      playing = false;
      return;
    }
    playing = true;
    onplay?.();
    speak(text, () => (playing = false), { rate: rate ?? modeSettings(compMode).rate, langs: VOICE_LANGS });
  }
  $effect(() => () => {
    if (playing) stopSpeaking();
  });
</script>

{#if canSpeak()}
  <button class="sp press" class:big class:playing style:--s="{size}px" onclick={toggle} aria-label={playing ? '停止' : label}>
    <Icon name={playing ? 'pause' : 'speaker'} size={Math.round(size * 0.48)} stroke={2.2} />
    {#if big}<span>{playing ? '停止' : label}</span>{/if}
  </button>
{/if}

<style>
  .sp {
    flex: none;
    min-width: var(--s);
    height: var(--s);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 999px;
    border: 2px solid var(--ink);
    color: var(--text);
    transition: background-color 0.2s, color 0.2s;
  }
  .sp.big {
    padding: 0 20px;
    font-weight: 800;
    font-size: 16px;
  }
  .sp.playing {
    background: var(--ink);
    color: var(--bg);
  }
</style>
