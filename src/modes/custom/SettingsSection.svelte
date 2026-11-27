<script lang="ts">
  // 自由英単語の設定: 出題パターン・単語リストへ
  import Toggle from '../../components/Toggle.svelte';
  import Icon from '../../components/Icon.svelte';
  import { modeSettings, updateModeSettings } from '../../core/store.svelte.ts';
  import { router } from '../../core/router.svelte.ts';
  import { customMode } from './mode.ts';
  import { PATTERNS, type Pattern } from './quiz.ts';
  const s = $derived(modeSettings(customMode));
  function toggle(p: Pattern) {
    const next = s.patterns.includes(p) ? s.patterns.filter((x) => x !== p) : [...s.patterns, p];
    if (next.length) updateModeSettings(customMode, { patterns: PATTERNS.map((x) => x.id).filter((x) => next.includes(x)) });
  }
</script>

<h2 class="ui-h2">出題パターン</h2>
<div class="ui-group">
  {#each PATTERNS as p}
    <div class="ui-item">
      <div class="ui-txt"><span>{p.label}</span><span class="ui-hint">{p.desc}</span></div>
      <Toggle label={p.label} checked={s.patterns.includes(p.id)} onchange={() => toggle(p.id)} />
    </div>
  {/each}
</div>
<div class="ui-group sub">
  <button class="ui-item link" onclick={() => router.push({ name: 'custom/words' })}>
    <span class="ui-txt"><span>単語リスト（{s.words.length}語）</span><span class="ui-hint">追加・編集・まとめて追加・書き出し</span></span>
    <Icon name="chevron" size={18} />
  </button>
</div>

<style>
  .sub {
    margin-top: 10px;
  }
  .link {
    text-align: left;
    color: var(--text);
  }
</style>
