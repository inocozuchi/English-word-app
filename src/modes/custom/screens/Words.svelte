<script lang="ts">
  // 自由英単語の単語リスト: 追加（英単語・日本語訳・例文とメモは任意）・検索・編集・削除・まとめて追加・書き出し
  import Page from '../../../components/Page.svelte';
  import PageHero from '../../../components/PageHero.svelte';
  import SearchField from '../../../components/SearchField.svelte';
  import Num from '../../../components/Num.svelte';
  import Icon from '../../../components/Icon.svelte';
  import { store } from '../../../core/store.svelte.ts';
  import { haptic } from '../../../core/haptics.ts';
  import { canSpeak, speak } from '../../../core/speech.ts';
  import { router } from '../../../core/router.svelte.ts';
  import { normalizeCustomSettings, parseBulk, normWord, MODE_ID, MIN_WORDS } from '../quiz.ts';
  import { addWords, updateWord, removeWord } from '../words.ts';
  import { flip } from 'svelte/animate';
  import { onMount, tick } from 'svelte';

  let { focus }: { focus?: string } = $props();
  const words = $derived(normalizeCustomSettings(store.settings.modes[MODE_ID]).words);
  let en = $state('');
  let ja = $state('');
  let ex = $state('');
  let note = $state('');
  let more = $state(false);
  let msg = $state('');
  let query = $state('');
  // svelte-ignore state_referenced_locally
  let editing = $state<string | null>(focus ?? null);
  let draft = $state({ en: '', ja: '', ex: '', note: '' });
  let armed = $state<string | null>(null);
  let bulk = $state('');
  let showBulk = $state(false);
  let enInput: HTMLInputElement | undefined = $state();

  const dup = $derived(en.trim() ? words.find((w) => normWord(w.en) === normWord(en)) : undefined);
  const list = $derived(
    [...words]
      .sort((a, b) => b.added - a.added)
      .filter((w) => !query.trim() || `${w.en} ${w.ja} ${w.ex ?? ''} ${w.note ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())),
  );
  /** 覚え具合（英→日 と 日→英 の記録から。今のモードが自由英単語のときだけ） */
  const status = (id: string) => {
    if (store.settings.activeMode !== MODE_ID) return '';
    const a = store.progress.items['ej:' + id], b = store.progress.items['je:' + id];
    if (!a && !b) return '未学習';
    if ((a?.box ?? 0) >= 3 && (b?.box ?? 3) >= 3) return '覚えた';
    return a?.lastOk === false || b?.lastOk === false ? 'まちがえた' : '学習中';
  };
  function flash(m: string) {
    msg = m;
    setTimeout(() => (msg = ''), 2200);
  }
  function add() {
    if (!en.trim() || !ja.trim() || dup) return;
    addWords([{ en, ja, ex, note }]);
    haptic('success');
    flash(`「${en.trim()}」を追加しました`);
    en = ja = ex = note = '';
    enInput?.focus();
  }
  function startEdit(id: string) {
    const w = words.find((x) => x.id === id)!;
    editing = id;
    draft = { en: w.en, ja: w.ja, ex: w.ex ?? '', note: w.note ?? '' };
  }
  function saveEdit() {
    if (!editing || !draft.en.trim() || !draft.ja.trim()) return;
    updateWord(editing, { en: draft.en.trim(), ja: draft.ja.trim(), ex: draft.ex.trim() || undefined, note: draft.note.trim() || undefined });
    haptic('light');
    editing = null;
  }
  function del(id: string) {
    if (armed !== id) {
      armed = id;
      haptic('light');
      setTimeout(() => armed === id && (armed = null), 3500);
      return;
    }
    removeWord(id);
    armed = null;
    editing = null;
    haptic('success');
  }
  const parsed = $derived(parseBulk(bulk));
  function addBulk() {
    const n = addWords(parsed.words);
    flash(n ? `${n}語を追加しました${parsed.words.length - n ? `（同じ英単語 ${parsed.words.length - n}語は飛ばしました）` : ''}` : '追加できる新しい単語がありません');
    if (n) {
      bulk = '';
      showBulk = false;
      haptic('success');
    }
  }
  async function exportAll() {
    const text = words.map((w) => `${w.en}\t${w.ja}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      flash(`${words.length}語をコピーしました（「英単語<タブ>日本語」）`);
    } catch {
      flash('コピーできませんでした');
    }
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      add();
    }
  }
  onMount(async () => {
    if (focus) {
      await tick();
      document.getElementById('w-' + focus)?.scrollIntoView({ block: 'center' });
      const w = words.find((x) => x.id === focus);
      if (w) startEdit(focus);
    }
  });
</script>

<Page title="単語リスト">
  <PageHero ja="自由英単語 · 単語リスト" en="My *words*" />

  <div class="count">
    <span class="n en"><Num value={words.length} /></span><span class="cap">語</span>
    {#if words.length && words.length < MIN_WORDS}<span class="need">あと {MIN_WORDS - words.length} 語で4択のクイズができます</span>{/if}
  </div>

  <h2 class="ui-h2">単語を追加</h2>
  <div class="ui-group form">
    <label class="ui-item col">
      <span class="lbl">英単語・熟語</span>
      <input bind:this={enInput} bind:value={en} lang="en" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" placeholder="例: deadline" onkeydown={(e) => e.key === 'Enter' && !e.isComposing && (e.preventDefault(), document.getElementById('ja-in')?.focus())} />
      {#if dup}<span class="warn">「{dup.en}」はもう登録されています（{dup.ja}）</span>{/if}
    </label>
    <label class="ui-item col">
      <span class="lbl">日本語訳</span>
      <input id="ja-in" bind:value={ja} lang="ja" autocomplete="off" enterkeyhint="done" placeholder="例: 締め切り" onkeydown={key} />
    </label>
    {#if more}
      <label class="ui-item col"><span class="lbl">例文（任意）</span><input bind:value={ex} lang="en" autocomplete="off" autocapitalize="sentences" placeholder="When is the deadline?" /></label>
      <label class="ui-item col"><span class="lbl">メモ（任意）</span><input bind:value={note} autocomplete="off" placeholder="どこで出会ったか など" /></label>
    {/if}
    <div class="ui-item acts">
      <button class="link" onclick={() => (more = !more)}>{more ? '例文・メモを閉じる' : '＋ 例文・メモ'}</button>
      <button class="pri press" onclick={add} disabled={!en.trim() || !ja.trim() || !!dup}>追加する</button>
    </div>
  </div>
  {#if msg}<p class="msg" aria-live="polite">{msg}</p>{/if}

  <div class="tools">
    <button class="tool press" onclick={() => (showBulk = !showBulk)} aria-expanded={showBulk}>まとめて追加</button>
    {#if words.length}<button class="tool press" onclick={exportAll}>すべてコピー</button>{/if}
    {#if words.length >= MIN_WORDS}<button class="tool press go" onclick={() => router.push({ name: 'quiz', params: { seed: Date.now(), kind: 'normal' } }, 'modal')}>この単語でクイズ</button>{/if}
  </div>
  {#if showBulk}
    <div class="bulk">
      <p class="hint">1行に1語。「英単語, 日本語訳」（カンマ・タブ・「 - 」で区切る）。表計算やメモから貼り付けられます。</p>
      <textarea bind:value={bulk} rows="6" placeholder={'deadline, 締め切り\nsubmit\t提出する\ntake notes - メモを取る'}></textarea>
      <p class="hint">{parsed.words.length} 語を読み取りました{#if parsed.bad.length} · 読めない行 {parsed.bad.length}{/if}</p>
      <button class="pri press" onclick={addBulk} disabled={!parsed.words.length}>{parsed.words.length} 語を追加</button>
    </div>
  {/if}

  <h2 class="ui-h2">登録した単語</h2>
  {#if words.length > 6}<SearchField bind:value={query} placeholder="英語・日本語で探す" />{/if}
  <ul class="list">
    {#each list as w (w.id)}
      <li id="w-{w.id}" animate:flip={{ duration: 300 }}>
        {#if editing === w.id}
          <div class="edit">
            <input bind:value={draft.en} lang="en" autocapitalize="off" aria-label="英単語" />
            <input bind:value={draft.ja} lang="ja" aria-label="日本語訳" />
            <input bind:value={draft.ex} lang="en" placeholder="例文（任意）" aria-label="例文" />
            <input bind:value={draft.note} placeholder="メモ（任意）" aria-label="メモ" />
            <div class="eacts">
              <button class="del press" class:armed={armed === w.id} onclick={() => del(w.id)}>{armed === w.id ? 'もう一度で削除' : '削除'}</button>
              <button class="sec press" onclick={() => (editing = null)}>やめる</button>
              <button class="pri press" onclick={saveEdit}>保存</button>
            </div>
          </div>
        {:else}
          <button class="row press" onclick={() => startEdit(w.id)}>
            <span class="main"><span class="t en">{w.en}</span><span class="s">{w.ja}</span>{#if w.ex}<span class="x en">{w.ex}</span>{/if}</span>
            {#if status(w.id)}<span class="st" class:bad={status(w.id) === 'まちがえた'} class:good={status(w.id) === '覚えた'}>{status(w.id)}</span>{/if}
            {#if canSpeak() && store.settings.audio}<span class="sp" role="button" tabindex="-1" aria-label="読み上げ" onclick={(e) => { e.stopPropagation(); speak(w.en, undefined, { langs: ['en-NZ', 'en-GB', 'en'] }); }} onkeydown={() => {}}><Icon name="speaker" size={16} /></span>{/if}
          </button>
        {/if}
      </li>
    {:else}
      <li class="empty">{words.length ? '見つかりませんでした' : 'まだ単語がありません。上から追加するか、総合英語・語源英単語の単語の「自由英単語に追加」から集められます。'}</li>
    {/each}
  </ul>
</Page>

<style>
  .count {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }
  .n {
    font-size: 40px;
    font-weight: 850;
    letter-spacing: -0.03em;
  }
  .cap {
    font-weight: 700;
    color: var(--text2);
  }
  .need {
    width: 100%;
    font-size: 12px;
    color: var(--accent);
    font-weight: 700;
  }
  .lbl {
    font-size: 12px;
    font-weight: 700;
    color: var(--text2);
  }
  input,
  textarea {
    width: 100%;
    font: inherit;
    font-size: 17px;
    padding: 11px 13px;
    border-radius: 14px;
    border: 2px solid var(--line-strong);
    background: var(--bg);
    color: var(--text);
    resize: vertical;
  }
  input:focus,
  textarea:focus {
    border-color: var(--ink);
    outline: none;
  }
  .warn {
    font-size: 12px;
    color: var(--text2);
  }
  .acts {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .link {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    min-height: 40px;
  }
  .pri,
  .sec,
  .del {
    min-height: 48px;
    padding: 0 20px;
    border-radius: 16px;
    font-weight: 800;
    border: var(--frame) solid var(--ink);
  }
  .pri {
    background: var(--accent);
    color: var(--on-accent);
  }
  .pri:disabled {
    opacity: 0.35;
  }
  .msg {
    margin-top: 8px;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }
  .tool {
    min-height: 42px;
    padding: 0 14px;
    border-radius: 999px;
    border: 2px solid var(--ink);
    font-size: 13px;
    font-weight: 700;
  }
  .tool.go {
    background: var(--ink);
    color: var(--bg);
  }
  .bulk {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: var(--card-border);
    border-radius: 16px;
  }
  .hint {
    font-size: 12px;
    color: var(--text2);
  }
  .list {
    list-style: none;
    margin: 10px 0 0;
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
    font-size: 17px;
    font-weight: 800;
  }
  .s {
    font-size: 14px;
    color: var(--text2);
  }
  .x {
    font-size: 12px;
    color: var(--text3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .st {
    flex: none;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1.5px solid var(--line-strong);
    color: var(--text2);
  }
  .st.good {
    border-color: var(--accent);
    color: var(--accent);
  }
  .st.bad {
    border-color: var(--ink);
    color: var(--text);
  }
  .sp {
    flex: none;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1.5px solid var(--line-strong);
  }
  .edit {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    border: var(--panel-border);
    border-radius: 16px;
  }
  .eacts {
    display: grid;
    grid-template-columns: 1fr 1fr 1.2fr;
    gap: 8px;
  }
  .del {
    border-color: var(--line-strong);
    color: var(--text2);
  }
  .del.armed {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--bg);
  }
  .empty {
    padding: 20px 4px;
    font-size: 13px;
    color: var(--text2);
    line-height: 1.6;
  }
</style>
