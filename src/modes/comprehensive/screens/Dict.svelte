<script lang="ts">
  // 教材辞典: 語彙（単語・熟語・チャンク）・図解・文法・会話・読解・不規則動詞を検索。★だけに絞れる
  import Page from '../../../components/Page.svelte';
  import PageHero from '../../../components/PageHero.svelte';
  import SearchField from '../../../components/SearchField.svelte';
  import Icon from '../../../components/Icon.svelte';
  import { router } from '../../../core/router.svelte.ts';
  import { modeSettings } from '../../../core/store.svelte.ts';
  import { compMode } from '../mode.ts';
  import { comp, loadComp, extra } from '../state.svelte.ts';
  import { STAGE_LABEL } from '../course.ts';

  let { fav = false }: { fav?: boolean } = $props();
  loadComp().catch(() => {});
  type Tab = 'vocab' | 'visual' | 'grammar' | 'conv' | 'reading' | 'irregular';
  const TABS: { id: Tab; label: string }[] = [
    { id: 'vocab', label: '語彙' },
    { id: 'visual', label: '図解' },
    { id: 'grammar', label: '文法' },
    { id: 'conv', label: '会話' },
    { id: 'reading', label: '読解' },
    { id: 'irregular', label: '不規則動詞' },
  ];
  let tab = $state<Tab>('vocab');
  let query = $state('');
  // svelte-ignore state_referenced_locally
  let onlyFav = $state(fav);
  const s = $derived(modeSettings(compMode));
  const favs = $derived(new Set(extra().fav ?? []));
  const LIMIT = 120;
  const has = (...xs: (string | undefined)[]) => {
    const k = query.trim().toLowerCase();
    return !k || xs.some((x) => x?.toLowerCase().includes(k));
  };
  const rows = $derived.by(() => {
    const ix = comp.index;
    if (!ix) return [];
    const f = (id: string) => !onlyFav || favs.has(id);
    switch (tab) {
      case 'vocab':
        return ix.d.items.filter((i) => f(i.id) && has(i.english, i.japanese, i.kana)).map((i) => ({ id: i.id, title: i.english, sub: i.japanese, tag: `${STAGE_LABEL[i.kind]} · Day ${i.day}`, kana: i.kana }));
      case 'visual':
        return ix.d.visuals.filter((v) => f(v.id) && has(v.title, v.description, ...v.nodes.map((n) => n.english))).map((v) => ({ id: v.id, title: v.title, sub: v.description, tag: `図解 · Day ${v.day}`, kana: '' }));
      case 'grammar':
        return ix.d.grammar.filter((g) => f(g.id) && has(g.title, g.rule)).map((g) => ({ id: g.id, title: g.title, sub: g.rule, tag: `文法 · Day ${g.day}`, kana: '' }));
      case 'conv':
        return ix.d.scenarios.filter((c) => f(c.id) && has(c.title, c.goal)).map((c) => ({ id: c.id, title: c.title, sub: c.goal, tag: `会話 · Day ${c.day}`, kana: '' }));
      case 'reading':
        return ix.d.readings.filter((r) => f(r.id) && has(r.title, r.text)).map((r) => ({ id: r.id, title: r.title, sub: r.text, tag: `読解 · Day ${r.day}`, kana: '' }));
      case 'irregular':
        return ix.d.irregularVerbs.filter((v) => has(v.base, v.japanese, ...v.past, ...v.participle)).map((v) => ({ id: v.itemId ?? v.id, title: `${v.base} — ${v.past.join('/')} — ${v.participle.join('/')}`, sub: v.japanese, tag: '不規則動詞', kana: v.kana }));
    }
  });
</script>

<Page title="教材辞典">
  <PageHero ja={onlyFav ? 'お気に入り · 総合英語' : '教材辞典 · 総合英語'} en={onlyFav ? 'My *stars*' : 'Course *book*'} />
  <SearchField bind:value={query} placeholder="英語・日本語・カナで探す" />
  <div class="tabs" role="tablist">
    {#each TABS as t}<button class="tab press" role="tab" aria-selected={tab === t.id} class:on={tab === t.id} onclick={() => (tab = t.id)}>{t.label}</button>{/each}
    <button class="tab press star" aria-pressed={onlyFav} class:on={onlyFav} onclick={() => (onlyFav = !onlyFav)}>★のみ</button>
  </div>
  <p class="cnt">{rows.length.toLocaleString()} 件{#if rows.length > LIMIT}（先頭の{LIMIT}件を表示。絞り込んでください）{/if}</p>
  <ul class="list">
    {#each rows.slice(0, LIMIT) as r (r.id + r.title)}
      <li>
        <button class="row press" onclick={() => router.push({ name: 'comp/entry', params: { id: r.id } })}>
          <span class="main">
            <span class="t en">{r.title}{#if favs.has(r.id)}<span class="st">★</span>{/if}</span>
            {#if s.kana && r.kana}<span class="k">{r.kana}</span>{/if}
            <span class="s">{r.sub}</span>
          </span>
          <span class="tg">{r.tag}</span>
          <Icon name="chevron" size={16} />
        </button>
      </li>
    {:else}
      <li class="empty">{onlyFav ? '★を付けた項目はまだありません（学習カードや辞典の☆から付けられます）' : '見つかりませんでした'}</li>
    {/each}
  </ul>
</Page>

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 12px 0 6px;
  }
  .tab {
    min-height: 38px;
    padding: 0 12px;
    border-radius: 999px;
    border: 2px solid var(--line-strong);
    font-size: 13px;
    font-weight: 700;
    color: var(--text2);
  }
  .tab.on {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--bg);
  }
  .cnt {
    font-size: 12px;
    color: var(--text3);
    margin-bottom: 6px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: var(--card-border);
    border-radius: 14px;
    text-align: left;
    color: var(--text);
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .t {
    font-weight: 800;
    font-size: 16px;
  }
  .st {
    color: var(--accent);
    margin-left: 6px;
  }
  .k {
    font-size: 12px;
    color: var(--accent);
  }
  .s {
    font-size: 13px;
    color: var(--text2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tg {
    flex: none;
    font-size: 11px;
    color: var(--text3);
  }
  .empty {
    padding: 24px 0;
    text-align: center;
    color: var(--text2);
    font-size: 13px;
  }
</style>
