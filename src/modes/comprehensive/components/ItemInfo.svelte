<script lang="ts">
  // 項目（単語・熟語・チャンク）の要点: 英語・カナ・意味・例文（カナと訳は設定で切り替え）・お気に入り
  import type { Item } from '../types.ts';
  import Speak from './Speak.svelte';
  import { modeSettings } from '../../../core/store.svelte.ts';
  import { compMode } from '../mode.ts';
  import { isFav, toggleFav } from '../state.svelte.ts';
  import { STAGE_LABEL } from '../course.ts';
  import { comp } from '../state.svelte.ts';

  let { item, large = false }: { item: Item; large?: boolean } = $props();
  const s = $derived(modeSettings(compMode));
  const fav = $derived(isFav(item.id));
  const irr = $derived(comp.index?.d.irregularVerbs.find((v) => v.itemId === item.id));
  const senses = $derived(comp.index?.d.verbSenses.filter((v) => v.itemId === item.id) ?? []);
</script>

<div class="ii" class:large>
  <div class="row">
    <span class="tg">{STAGE_LABEL[item.kind]}</span>
    <button class="fav press" class:on={fav} onclick={() => toggleFav(item.id)} aria-pressed={fav} aria-label="お気に入り">{fav ? '★' : '☆'}</button>
  </div>
  <p class="en w">{item.english}<Speak text={item.english} size={large ? 44 : 34} /></p>
  {#if s.kana}<p class="kana">{item.kana}</p>{/if}
  <p class="ja">{item.japanese}</p>
  <p class="ex en">{item.example}<Speak text={item.example} size={30} /></p>
  {#if s.ja && item.exampleJapanese}<p class="exj">{item.exampleJapanese}</p>{/if}
  {#if irr}<p class="irr en">{irr.base} — {irr.past.join(' / ')} — {irr.participle.join(' / ')}<span class="lab">（不規則動詞）</span></p>{/if}
  {#each senses as v}<p class="sense"><span class="en">{v.phrase}</span>：{v.japanese}</p>{/each}
</div>

<style>
  .ii {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 14px;
    border: var(--card-border);
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .tg {
    font-size: 11px;
    font-weight: 800;
    color: var(--text3);
  }
  .fav {
    min-width: 40px;
    min-height: 36px;
    font-size: 20px;
    color: var(--text3);
  }
  .fav.on {
    color: var(--accent);
  }
  .w {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 22px;
    font-weight: 800;
  }
  .large .w {
    font-size: clamp(30px, 9vw, 40px);
  }
  .kana {
    font-size: 14px;
    color: var(--accent);
  }
  .ja {
    font-size: 17px;
    font-weight: 700;
  }
  .large .ja {
    font-size: 20px;
  }
  .ex {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    margin-top: 4px;
  }
  .exj,
  .sense {
    font-size: 13px;
    color: var(--text2);
  }
  .irr {
    font-size: 14px;
  }
  .lab {
    font-size: 11px;
    color: var(--text3);
  }
</style>
