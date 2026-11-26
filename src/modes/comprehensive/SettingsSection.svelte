<script lang="ts">
  // 総合英語の設定: 1日の学習時間（保存して毎日聞かない）・カナと訳・読み上げの速さと声・報告した問題
  import Segmented from '../../components/Segmented.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import ReportsGroup from '../../components/ReportsGroup.svelte';
  import { modeSettings, updateModeSettings } from '../../core/store.svelte.ts';
  import { canSpeak, pickVoice, englishVoices, onVoicesChanged, speak } from '../../core/speech.ts';
  import { compMode } from './mode.ts';
  import { MINUTES, RATES, VOICE_LANGS } from './settings.ts';
  import { comp } from './state.svelte.ts';
  import { MODE_ID } from './course.ts';
  import { onMount } from 'svelte';

  const s = $derived(modeSettings(compMode));
  let voice = $state<string>('');
  let count = $state(0);
  function refresh() {
    const v = pickVoice(VOICE_LANGS);
    voice = v ? `${v.name}（${v.lang}）` : '';
    count = englishVoices().length;
  }
  onMount(() => {
    refresh();
    return onVoicesChanged(refresh);
  });
  function describe(key: string) {
    const ix = comp.index;
    const q = ix?.q.get(key);
    if (q) return { day: q.day, kind: q.kind, prompt: q.prompt, answers: q.acceptedAnswers };
    const it = ix?.item.get(key);
    return it ? { day: it.day, kind: it.kind, english: it.english, japanese: it.japanese } : null;
  }
</script>

<h2 class="ui-h2">1日の学習時間</h2>
<div class="ui-group">
  <div class="ui-item col">
    <Segmented options={MINUTES.map((m) => ({ value: m, label: `${m}分` }))} value={s.minutes} onchange={(v: number) => updateModeSettings(compMode, { minutes: v })} />
    <span class="ui-hint">目安です。時間になっても途中で終わらず、続けるか選べます。学びきれなかった必須の教材は次回に繰り越します。</span>
  </div>
</div>

<h2 class="ui-h2">表示</h2>
<div class="ui-group">
  <div class="ui-item">
    <div class="ui-txt"><span>カタカナ発音を出す</span><span class="ui-hint">カナは目安です。音声で確かめましょう</span></div>
    <Toggle label="カタカナ発音を出す" checked={s.kana} onchange={(v) => updateModeSettings(compMode, { kana: v })} />
  </div>
  <div class="ui-item">
    <div class="ui-txt"><span>日本語訳を出す</span><span class="ui-hint">例文・図解の訳</span></div>
    <Toggle label="日本語訳を出す" checked={s.ja} onchange={(v) => updateModeSettings(compMode, { ja: v })} />
  </div>
</div>

<h2 class="ui-h2">音声</h2>
<div class="ui-group">
  <div class="ui-item col">
    <div class="ui-line"><span>読み上げの速さ</span></div>
    <Segmented options={RATES.map((r) => ({ value: r, label: `${r}×` }))} value={s.rate} onchange={(v: number) => updateModeSettings(compMode, { rate: v })} />
  </div>
  <div class="ui-item">
    <div class="ui-txt"><span>聞き取りで最初に自動で読む</span></div>
    <Toggle label="聞き取りで最初に自動で読む" checked={s.autoPlay} onchange={(v) => updateModeSettings(compMode, { autoPlay: v })} />
  </div>
  <div class="ui-item col">
    <div class="ui-line"><span>使う声</span>{#if canSpeak()}<button class="test" onclick={() => speak('Kia ora! Welcome to New Zealand.', undefined, { rate: s.rate, langs: VOICE_LANGS })}>試しに聞く</button>{/if}</div>
    <span class="ui-hint">
      {#if !canSpeak()}この端末では音声を使えません。聞き取りは文字で確認します。
      {:else if voice}{voice}（英語の声 {count} 種類。ニュージーランド → イギリス → ほかの英語の順に選びます）
      {:else}英語の声が見つかりません（端末の設定で英語の音声を追加すると使えます）{/if}
    </span>
    <span class="ui-hint">合成音声は端末によって訛りや自然な音のつながりを再現できません。発音の自動採点・録音はしません。音声はオフラインでは使えないことがあります。</span>
  </div>
</div>

<ReportsGroup modeId={MODE_ID} fileName="comprehensive-reports" {describe} />

<style>
  .test {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    min-height: 36px;
  }
</style>
