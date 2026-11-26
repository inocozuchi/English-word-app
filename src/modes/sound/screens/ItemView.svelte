<script lang="ts">
  // 1フレーズの詳細（結果画面・復習リストから開く）
  import Page from '../../../components/Page.svelte';
  import ItemCard from '../components/ItemCard.svelte';
  import RuleBadge from '../components/RuleBadge.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { snd } from '../state.svelte.ts';

  let { id }: { id: string } = $props();
  const ix = $derived(snd.index!);
  const it = $derived(ix.item.get(id)!);
  const l = $derived(ix.lecture.get(it.lecture));
</script>

<Page title={it.text}>
  <p class="eyebrow-en">Phrase</p>
  <p class="lec">第{it.lecture}講 {l?.title} · Lv.{it.level}</p>
  <ItemCard item={it} />
  <div class="links">
    {#each it.rules as r}
      <button class="link press" onclick={() => router.push({ name: 'sound/rule', params: { id: r } })}><RuleBadge rule={r} /> のノートへ</button>
    {/each}
    <button class="link press" onclick={() => router.push({ name: 'sound/lecture', params: { no: it.lecture } })}>第{it.lecture}講のノートへ</button>
  </div>
  <p class="note">カタカナは目安です（実際の速さや話者によって揺れます）</p>
</Page>

<style>
  .lec {
    font-size: 12px;
    color: var(--text3);
    margin: 4px 0 12px;
  }
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  .link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    border-radius: 999px;
    background: var(--panel-bg);
    border: var(--panel-border);
    font-size: 13px;
    font-weight: 600;
  }
  .note {
    margin-top: 18px;
    font-size: 11px;
    color: var(--text3);
  }
</style>
