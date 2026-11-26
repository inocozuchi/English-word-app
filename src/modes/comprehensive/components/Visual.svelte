<script lang="ts">
  // 図解の共通レンダラー（visual_reference.json の16種類すべて）。
  // 色だけに頼らず必ず文字のラベルを付ける・狭い画面では縦に積む・カナと訳は設定で切り替え・例文は折りたたむ。
  // 答えを含む図（読解の答え・聞き取りの原稿など）は reveal が true のときだけ答えを見せる。
  import type { Visual } from '../types.ts';
  import Speak from './Speak.svelte';
  import { modeSettings } from '../../../core/store.svelte.ts';
  import { compMode } from '../mode.ts';

  let { v, reveal = true }: { v: Visual; reveal?: boolean } = $props();
  const s = $derived(modeSettings(compMode));
  const str = (x: unknown) => (typeof x === 'string' ? x : '');
  const TYPE_LABEL: Record<string, string> = {
    contrast: '使い分け',
    morphology: '語形成',
    wordFamily: '語族',
    collocation: 'コロケーション',
    preposition: '前置詞・副詞',
    questionResponse: '質問と返答',
    paraphraseFlow: '言い換え',
    grammarStructure: '英文の構造',
    soundContrast: '音の聞き分け',
    connectedSpeech: '音のつながり',
    numberListening: '数字の聞き取り',
    listeningPassage: '聞き取り',
    conversationFlow: '会話の流れ',
    practicalReading: '実践読解',
    topicVocabulary: '場面別の語彙',
    sentenceExpansion: '構文の展開',
  };
  /** diagram の「a → b → c」「a / b」「a ≠ b」を段に分ける */
  const steps = $derived((v.diagram ?? '').split(/\s*(→|≠|\/)\s*/).filter((x) => x && x.trim()));
  let open = $state(false);
  let picked = $state<number | null>(null);
  const roleLabel: Record<string, string> = { vocabulary: '単語', idiom: '熟語', chunk: 'チャンク' };
  const groups = $derived.by(() => {
    if (v.type !== 'topicVocabulary') return [];
    const m = new Map<string, typeof v.nodes>();
    for (const n of v.nodes) {
      const r = str(n.role) || (str(n.itemId).split('-')[0] ?? 'vocabulary');
      if (!m.has(r)) m.set(r, []);
      m.get(r)!.push(n);
    }
    return [...m.entries()];
  });
</script>

<figure class="vis" aria-label="図解：{v.title}">
  <figcaption>
    <span class="tl">{TYPE_LABEL[v.type] ?? v.type}</span>
    <b>{v.title}</b>
    <span class="desc">{v.description}</span>
  </figcaption>

  {#if v.type === 'grammarStructure'}
    {#if steps.length}
      <ol class="flow" aria-label="構造: {v.diagram}">
        {#each steps as st}
          {#if st === '→'}<li class="arrow" aria-hidden="true">→</li>{:else if st === '≠'}<li class="arrow neq" aria-label="ではない">≠</li>{:else if st === '/'}<li class="arrow" aria-hidden="true">／</li>{:else}<li class="chip en">{st}</li>{/if}
        {/each}
      </ol>
    {/if}
    <ul class="ex">
      {#each v.nodes as n}
        <li>
          <span class="ok"><span class="mk" aria-hidden="true">◯</span><span class="lab">正しい</span><span class="en">{n.english}</span><Speak text={n.english} size={32} /></span>
          {#if s.ja}<span class="ja">{n.japanese}</span>{/if}
          {#if str(n.incorrect)}<span class="ng"><span class="mk" aria-hidden="true">×</span><span class="lab">誤り</span><span class="en">{str(n.incorrect)}</span></span>{/if}
        </li>
      {/each}
    </ul>
  {:else if v.type === 'contrast'}
    <div class="cards">
      {#each v.nodes as n}<div class="card"><span class="en big">{n.english}</span><span class="ja">{n.japanese}</span></div>{/each}
    </div>
  {:else if v.type === 'morphology'}
    <ul class="rows">
      {#each v.nodes as n}
        <li class="morph"><span class="en">{str(n.base)}</span><span class="arrow" aria-label="から">→</span><span class="en big">{n.english}</span>{#if s.ja}<span class="ja">{n.japanese}</span>{/if}</li>
      {/each}
    </ul>
  {:else if v.type === 'wordFamily'}
    <div class="tree">
      <span class="root en">{v.title}</span>
      <ul>
        {#each v.nodes as n}<li><span class="pos">{str(n.partOfSpeech)}</span><span class="en">{n.english}</span>{#if s.ja}<span class="ja">{n.japanese}</span>{/if}</li>{/each}
      </ul>
    </div>
  {:else if v.type === 'collocation' || v.type === 'preposition'}
    <div class="hub">
      <span class="center en">{v.title}</span>
      <ul>
        {#each v.nodes.slice(0, open ? 99 : 6) as n}
          <li>
            <span class="en">{#if str(n.complement)}<span class="dim">{v.title}</span>{' '}<b>{str(n.complement)}</b>{:else}{n.english}{/if}</span>
            {#if s.kana && str(n.kana)}<span class="kana">{str(n.kana)}</span>{/if}
            {#if s.ja}<span class="ja">{n.japanese}</span>{/if}
            {#if open && str(n.example)}<span class="exs en">{str(n.example)}{#if s.ja && str(n.exampleJapanese)}<span class="ja">{str(n.exampleJapanese)}</span>{/if}</span>{/if}
          </li>
        {/each}
      </ul>
    </div>
  {:else if v.type === 'questionResponse'}
    <ul class="rows">
      {#each v.nodes as n}
        <li class="qa">
          <span class="tag">{n.japanese}</span>
          <span class="q en">Q. {str(n.example) || n.english}<Speak text={str(n.example) || n.english} size={30} /></span>
          {#if str(n.response)}<span class="a en">A. {str(n.response)}{#if s.ja && str(n.responseJapanese)}<span class="ja">{str(n.responseJapanese)}</span>{/if}</span>{/if}
        </li>
      {/each}
    </ul>
  {:else if v.type === 'paraphraseFlow'}
    <ul class="rows">
      {#each v.nodes as n, k}
        <li class="pf">
          <span class="lab">言いたいこと</span><span>{n.japanese}（<span class="en">{n.english}</span>）</span>
          <span class="lab">手がかり</span><span class="en">{str(n.template)} …</span>
          {#if picked === k || reveal === true && open}
            <span class="lab">英文</span><span class="en">{str(n.example)}</span>
            {#if str(n.alternative)}<span class="lab">別の言い方</span><span class="en">{str(n.alternative)}</span>{/if}
          {:else}
            <button class="reveal press" onclick={() => (picked = k)}>英文を見る</button>
          {/if}
        </li>
      {/each}
    </ul>
  {:else if v.type === 'soundContrast' || v.type === 'connectedSpeech'}
    <div class="cards">
      {#each v.nodes as n, k}
        <div class="card">
          {#if reveal}<span class="en big">{n.english}</span>{:else}<span class="big">音 {k + 1}</span>{/if}
          {#if reveal && str(n.ipa)}<span class="ipa">{str(n.ipa)}</span>{/if}
          {#if reveal && s.ja}<span class="ja">{n.japanese}</span>{/if}
          <Speak text={n.english.replace(/‿/g, ' ')} size={34} />
        </div>
      {/each}
    </div>
  {:else if v.type === 'numberListening' || v.type === 'listeningPassage'}
    <div class="listen">
      <Speak text={v.type === 'listeningPassage' ? (v.nodes[1]?.english ?? '') : v.nodes[0].english} big label="聞く" />
      {#if reveal}
        <details>
          <summary>原稿を見る</summary>
          {#each v.nodes as n}<p><span class="lab">{n.japanese}</span> <span class="en">{n.english}</span></p>{/each}
        </details>
      {:else}<p class="hidden-note">原稿は答えたあとに表示します</p>{/if}
    </div>
  {:else if v.type === 'conversationFlow'}
    <ol class="conv">
      {#each v.nodes as n}<li><span class="lab">{n.japanese}</span><span class="en">{n.english}</span></li>{/each}
    </ol>
  {:else if v.type === 'practicalReading'}
    <div class="doc">
      <span class="fict">架空の練習資料</span>
      <p class="en">{v.nodes[0].english}</p>
      {#each v.nodes.slice(1) as n}<p class="qline"><span>{n.japanese}</span>{#if reveal}<b class="en">{n.english}</b>{:else}<span class="dim">（答えたあとに表示）</span>{/if}</p>{/each}
    </div>
  {:else if v.type === 'topicVocabulary'}
    {#each groups as [role, ns]}
      <p class="grp">{roleLabel[role] ?? role}</p>
      <ul class="rows tv">
        {#each ns as n}
          <li>
            <span class="en">{n.english}</span>
            {#if s.kana && str(n.kana)}<span class="kana">{str(n.kana)}</span>{/if}
            {#if s.ja}<span class="ja">{n.japanese}</span>{/if}
            {#if open && str(n.example)}<span class="exs en">{str(n.example)}{#if s.ja && str(n.exampleJapanese)}<span class="ja">{str(n.exampleJapanese)}</span>{/if}</span>{/if}
          </li>
        {/each}
      </ul>
    {/each}
  {:else if v.type === 'sentenceExpansion'}
    <p class="stem en">{v.title} …</p>
    <div class="ends">
      {#each v.nodes as n, k}
        <button class="end press" class:on={picked === k} onclick={() => (picked = k)}>{n.english.replace(new RegExp('^' + v.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '…')}</button>
      {/each}
    </div>
    {#if picked !== null}
      <p class="full"><span class="en">{v.nodes[picked].english}</span><Speak text={v.nodes[picked].english} size={32} />{#if s.ja}<span class="ja">{v.nodes[picked].japanese}</span>{/if}</p>
    {/if}
  {:else}
    <!-- 未知の種類: 文字だけで表示する -->
    <ul class="rows">{#each v.nodes as n}<li><span class="en">{n.english}</span><span class="ja">{n.japanese}</span></li>{/each}</ul>
  {/if}

  {#if ['collocation', 'preposition', 'topicVocabulary', 'paraphraseFlow'].includes(v.type)}
    <button class="more" onclick={() => (open = !open)} aria-expanded={open}>{open ? '例文を閉じる' : '例文を見る'}</button>
  {/if}
</figure>

<style>
  .vis {
    margin: 0;
    padding: 14px;
    border: var(--card-border);
    border-radius: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  figcaption {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
  }
  .tl {
    font-size: 11px;
    font-weight: 800;
    padding: 1px 8px;
    border-radius: 999px;
    border: 1.5px solid var(--ink);
  }
  figcaption b {
    font-size: 16px;
  }
  .desc {
    width: 100%;
    font-size: 12px;
    color: var(--text2);
  }
  .en {
    font-family: var(--font-en);
  }
  .big {
    font-size: 19px;
    font-weight: 800;
  }
  .ja {
    font-size: 13px;
    color: var(--text2);
  }
  .kana {
    font-size: 12px;
    color: var(--accent);
  }
  .lab {
    font-size: 11px;
    font-weight: 800;
    color: var(--text3);
  }
  .dim {
    color: var(--text3);
  }
  .flow {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .chip {
    padding: 4px 10px;
    border-radius: 10px;
    border: 2px solid var(--ink);
    font-weight: 700;
    font-size: 14px;
  }
  .arrow {
    color: var(--text2);
    font-weight: 800;
  }
  .neq {
    color: var(--text);
  }
  .ex,
  .rows,
  .conv {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ex li {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ok,
  .ng {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 16px;
  }
  .ok .mk {
    color: var(--accent);
    font-weight: 900;
  }
  .ng {
    color: var(--text2);
  }
  .ng .en {
    text-decoration: line-through;
  }
  .ng .mk {
    font-weight: 900;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 8px;
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 14px;
    background: var(--fill);
  }
  .ipa {
    font-family: var(--font-en);
    font-size: 13px;
    color: var(--text2);
  }
  .morph,
  .tree li,
  .hub li,
  .tv li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 10px;
  }
  .tree {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .root,
  .center {
    align-self: flex-start;
    padding: 4px 12px;
    border-radius: 12px;
    background: var(--ink);
    color: var(--bg);
    font-weight: 800;
    font-size: 17px;
  }
  .tree ul,
  .hub ul {
    list-style: none;
    margin: 0;
    padding: 0 0 0 14px;
    border-left: 2px solid var(--line-strong);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hub {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pos {
    font-size: 11px;
    font-weight: 800;
    padding: 0 6px;
    border-radius: 6px;
    border: 1.5px solid var(--line-strong);
  }
  .exs {
    width: 100%;
    font-size: 13px;
    color: var(--text2);
  }
  .exs .ja {
    display: block;
  }
  .qa {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tag {
    font-size: 11px;
    font-weight: 800;
    color: var(--text3);
  }
  .q,
  .a {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 15px;
  }
  .a .ja {
    width: 100%;
  }
  .pf {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    align-items: baseline;
    padding: 8px 0;
    border-bottom: 1.5px solid var(--line);
  }
  .reveal,
  .more {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    justify-self: start;
    align-self: flex-start;
    min-height: 36px;
  }
  .pf .reveal {
    grid-column: 2;
  }
  .listen {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .hidden-note {
    font-size: 12px;
    color: var(--text3);
  }
  details summary {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    min-height: 36px;
    display: flex;
    align-items: center;
  }
  .conv li {
    display: flex;
    flex-direction: column;
    padding-left: 10px;
    border-left: 3px solid var(--line-strong);
  }
  .doc {
    padding: 12px;
    border-radius: 12px;
    background: var(--fill);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .fict {
    font-size: 11px;
    font-weight: 800;
    color: var(--text3);
  }
  .qline {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 14px;
  }
  .grp {
    font-size: 12px;
    font-weight: 800;
    color: var(--text2);
  }
  .stem {
    font-size: 18px;
    font-weight: 800;
  }
  .ends {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .end {
    min-height: 40px;
    padding: 0 12px;
    border-radius: 12px;
    border: 2px solid var(--line-strong);
    font-family: var(--font-en);
    font-size: 14px;
    text-align: left;
  }
  .end.on {
    border-color: var(--ink);
  }
  .full {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 16px;
  }
  .full .ja {
    width: 100%;
  }
</style>
