<script lang="ts">
  // 語源デッキの設定（出題形式・出題範囲）
  import Toggle from '../../components/Toggle.svelte';
  import Icon from '../../components/Icon.svelte';
  import { router } from '../../core/router.svelte.ts';
  import { deckSettings, updateDeckSettings } from '../../core/store.svelte.ts';
  import { etymologyDeck } from './deck.ts';
  import { ety } from './state.svelte.ts';
  import { scopeLabel } from './summary.ts';
  import type { Format } from './types.ts';

  const s = $derived(deckSettings(etymologyDeck));
  function toggle(f: Format, on: boolean) {
    const next = on ? [...s.formats, f] : s.formats.filter((x) => x !== f);
    if (!next.length) return; // 最低1つは残す
    updateDeckSettings(etymologyDeck, { formats: (['ej', 'je', 'rm', 'ph'] as Format[]).filter((x) => next.includes(x)) });
  }
</script>

<h2 class="ui-h2">出題形式</h2>
<div class="ui-group">
  {#each etymologyDeck.modes as m}
    <div class="ui-item">
      <div class="ui-txt"><span>{m.label}</span><span class="ui-hint">{m.desc}</span></div>
      <Toggle label={m.label} checked={s.formats.includes(m.id as Format)} onchange={(v) => toggle(m.id as Format, v)} />
    </div>
  {/each}
</div>

<h2 class="ui-h2">出題範囲</h2>
<div class="ui-group">
  <button class="ui-item" onclick={() => router.push({ name: 'ety/scope' })}>
    <span>章・語源を選ぶ</span>
    <span class="ui-right">{scopeLabel(ety.index, s)}<Icon name="chevron" size={18} /></span>
  </button>
</div>
