<script lang="ts">
  // 音声変化モードの問題文。回答後もこのまま表示し、英文にマーキングを浮かび上がらせ、
  // 聞こえ方（カタカナ）と変化の理由をフェードインで見せる（inlineExplain）。
  import Marked from './components/Marked.svelte';
  import RuleBadge from './components/RuleBadge.svelte';
  import WhyList from './components/WhyList.svelte';
  import type { SoundQuestion } from './quiz.ts';
  import { snd } from './state.svelte.ts';
  import { stagger } from '../../core/transitions.ts';
  import { reducedMotion } from '../../core/spring.ts';
  import type { LineType } from './marks.ts';

  let { q, phase }: { q: SoundQuestion; phase: 'ask' | 'reveal' } = $props();
  const s = $derived(q.data);
  const rv = $derived(phase === 'reveal');
  const ix = $derived(snd.index!);

  /** 英文の長さで文字の大きさを変える */
  const sizeOf = (text: string) => (text.length > 34 ? 'sm' : text.length > 18 ? 'md' : 'lg');

  /** t の行方 → 回答後に重ねる線 */
  const FATE_LINE: Record<string, LineType | null> = { flap: 'flap', elide: 'elide', absorb: 'assim', clear: null };

  /** 解説: マーキングが浮かび終わるころから、上から順にフェードイン */
  function reveal(node: HTMLElement, marks: number) {
    if (reducedMotion()) return;
    stagger([...node.children], { step: 70, distance: 8, delay: 160 + marks * 120 });
  }
  const markCount = (marks: { type: string }[]) => marks.length;
</script>

<div class="p">
  {#if s.kind === 'item' && s.pattern === 's1'}
    <p class="ask">実際にはどう聞こえる？</p>
    <p class="sentence"><Marked words={s.item.words} marks={s.item.marks} show={rv} animate size={sizeOf(s.item.text)} /></p>
    {#if rv}
      <div class="rv" use:reveal={markCount(s.item.marks)}>
        <p class="kana">{s.item.kana}</p>
        <p class="ja">{s.item.ja}</p>
        <WhyList changes={s.item.changes} />
        {#if s.item.alt}<p class="alt">別の聞こえ方：{s.item.alt}</p>{/if}
      </div>
    {/if}
  {:else if s.kind === 'item'}
    <p class="ask">元の英文は？</p>
    <p class="kana big">{s.item.kana}</p>
    {#if rv}
      <div class="rv" use:reveal={0}>
        <p class="sentence"><Marked words={s.item.words} marks={s.item.marks} show animate size={sizeOf(s.item.text)} /></p>
        <p class="ja">{s.item.ja}</p>
        <WhyList changes={s.item.changes} />
      </div>
    {/if}
  {:else if s.kind === 'cause'}
    <p class="ask">{s.ask}</p>
    <p class="sentence"><Marked words={s.item.words} marks={s.item.marks} show={rv} animate size={sizeOf(s.item.text)} /></p>
    {#if rv}
      <div class="rv" use:reveal={markCount(s.item.marks)}>
        <p class="kana">{s.item.kana}</p>
        <WhyList changes={s.item.changes} focus={s.index} />
      </div>
    {/if}
  {:else if s.kind === 'symptom'}
    <p class="ask">まず疑うルールは？</p>
    <p class="statement">{s.symptom.symptom}</p>
    {#if rv}
      <div class="rv" use:reveal={0}>
        <p class="rule-line"><RuleBadge rule={s.symptom.rule} size="md" /></p>
        <p class="ja">{ix.rule.get(s.symptom.rule)?.summary}</p>
      </div>
    {/if}
  {:else if s.kind === 'contraction'}
    <p class="ask">もとの形は？</p>
    <p class="form en">{s.c.form}</p>
    {#if rv}
      <div class="rv" use:reveal={0}>
        <p class="orig en">{s.c.original.join(' / ')}</p>
        <p class="kana">{s.c.kana}</p>
        <p class="ja">{s.c.ja}</p>
      </div>
    {/if}
  {:else if s.kind === 'assim'}
    <p class="ask">融合すると？</p>
    <p class="form en">{s.a.combo}</p>
    {#if rv}
      <div class="rv" use:reveal={0}>
        <p class="orig en">{s.a.combo} → {s.a.result}<span class="kana inline">（{s.a.kana}）</span></p>
        <p class="ja en">{s.a.example}</p>
      </div>
    {/if}
  {:else if s.kind === 'tfate'}
    <p class="ask">この t はどうなる？</p>
    <p class="sentence">
      <Marked words={s.t.words} target={s.t.target} targetLine={rv ? FATE_LINE[s.t.fate] : null} show={rv} animate size={sizeOf(s.t.text)} />
    </p>
    {#if rv}
      <div class="rv" use:reveal={1}>
        <p class="fate">{ix.d.fateLabels[s.t.fate]}</p>
        <p class="ja">{s.t.why}</p>
      </div>
    {/if}
  {:else if s.kind === 'compound'}
    <p class="ask">変化が起きる順に並べると？</p>
    <p class="sentence"><Marked words={s.c.words} marks={s.c.marks} show={rv} animate size={sizeOf(s.c.text)} /></p>
    {#if !rv}
      <ol class="steps">
        {#each s.order as stepIdx}
          <li><b class="en">{s.letters[stepIdx]}</b><span>{s.c.steps[stepIdx].label}</span></li>
        {/each}
      </ol>
    {:else}
      <div class="rv" use:reveal={markCount(s.c.marks)}>
        <ol class="steps done">
          {#each s.c.steps as st, k}
            <li><b class="en">{s.letters[k]}</b><span>{st.label}</span>{#if st.rule}<RuleBadge rule={st.rule} />{/if}</li>
          {/each}
        </ol>
        <p class="kana">{s.c.kana}</p>
        <p class="ja">{s.c.note}</p>
      </div>
    {/if}
  {:else if s.kind === 'concept'}
    <p class="ask">知識問題</p>
    <p class="statement">{s.c.q}</p>
    {#if rv}
      <div class="rv" use:reveal={0}>
        <p class="ja">{s.c.why}</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .p {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ask {
    font-size: 13px;
    font-weight: 600;
    color: var(--text3);
    letter-spacing: 0.04em;
  }
  .sentence {
    margin: 2px 0 4px;
  }
  .statement {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.5;
  }
  .form {
    font-size: 40px;
    font-weight: 750;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }
  .rv {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kana {
    font-size: 20px;
    font-weight: 750;
    color: var(--accent);
    letter-spacing: 0.04em;
  }
  .kana.big {
    font-size: 28px;
    margin: 2px 0 6px;
  }
  .kana.inline {
    font-size: 15px;
  }
  .ja {
    font-size: 14px;
    color: var(--text2);
    line-height: 1.6;
  }
  .alt {
    font-size: 13px;
    color: var(--text2);
  }
  .orig {
    font-size: 22px;
    font-weight: 700;
  }
  .fate {
    font-size: 18px;
    font-weight: 750;
  }
  .rule-line {
    display: flex;
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .steps li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 14px;
    line-height: 1.5;
  }
  .steps b {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 7px;
    display: grid;
    place-items: center;
    font-size: 13px;
    border: 2px solid var(--ink);
  }
  .steps.done li span {
    flex: 1;
  }
</style>
