<script lang="ts">
  // 「今の状況」に合わせた出し方（全モード共通。設定と一時停止の画面から変えられる）
  //   音声を使う: オフにすると聞き取り・書き取りを出さず、自動の読み上げもしない（イヤホンがない・静かな車内）
  //   文字入力: 入力して答える / 頭の中で答えて自己採点 / 出さない（片手で打てない・揺れる車内）
  import Toggle from './Toggle.svelte';
  import Segmented from './Segmented.svelte';
  import { store, updateSettings } from '../core/store.svelte.ts';
  import type { TypingMode } from '../core/storage.ts';
  import { stopSpeaking } from '../core/speech.ts';

  let { compact = false }: { compact?: boolean } = $props();
  const s = $derived(store.settings);
  const TYPING: { value: TypingMode; label: string }[] = [
    { value: 'on', label: '入力する' },
    { value: 'self', label: '頭の中で' },
    { value: 'skip', label: '出さない' },
  ];
</script>

<div class="ui-group" class:compact>
  <div class="ui-item">
    <div class="ui-txt">
      <span>音声を使う</span>
      <span class="ui-hint">{s.audio ? '聞き取り・書き取りの問題も出します' : '聞き取り・書き取りは出さず、自動の読み上げもしません'}</span>
    </div>
    <Toggle label="音声を使う" checked={s.audio} onchange={(v) => { updateSettings({ audio: v }); if (!v) stopSpeaking(); }} />
  </div>
  <div class="ui-item col">
    <div class="ui-line"><span>文字を入力する問題</span></div>
    <Segmented options={TYPING} value={s.typing} onchange={(v) => updateSettings({ typing: v })} />
    {#if !compact}
      <span class="ui-hint">
        {s.typing === 'on' ? '英語や日本語を入力して答えます' : s.typing === 'self' ? '入力せずに頭の中で答え、答えを見て自分で判定します（片手でも進められます）' : '入力が必要な問題は出しません（選ぶ問題・カード・会話だけ）'}
      </span>
    {/if}
  </div>
</div>

<style>
  .compact {
    text-align: left;
  }
</style>
