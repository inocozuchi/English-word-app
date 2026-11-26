<script lang="ts">
  // 学習レポート: 今の学習の状況を文章にして、ChatGPT に貼り付けられるようにコピーする
  // （自由会話・自由作文は ChatGPT で練習する想定。アプリは外部の AI を使わない）
  import Page from '../../../components/Page.svelte';
  import PageHero from '../../../components/PageHero.svelte';
  import { haptic } from '../../../core/haptics.ts';
  import { comp, loadComp } from '../state.svelte.ts';
  import { buildReport } from '../report.ts';

  loadComp().catch(() => {});
  const text = $derived(comp.index ? buildReport(comp.index) : '');
  let copied = $state('');
  let area: HTMLTextAreaElement | undefined = $state();
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      copied = 'コピーしました';
    } catch {
      area?.select();
      copied = '選択しました。共有メニューからコピーしてください';
    }
    haptic('success');
    setTimeout(() => (copied = ''), 2500);
  }
</script>

<Page title="学習レポート">
  <PageHero ja="学習レポート · 総合英語" en="Study *report*" />
  <p class="lead">下の文章をコピーして ChatGPT に貼り付けると、苦手に合わせた自由会話・自由作文の練習を頼めます。</p>
  <button class="pri press" onclick={copy}>{copied || 'レポートをコピー'}</button>
  <textarea bind:this={area} readonly value={text} rows="18" aria-label="学習レポート"></textarea>
</Page>

<style>
  .lead {
    font-size: 13px;
    color: var(--text2);
    line-height: 1.6;
  }
  .pri {
    width: 100%;
    min-height: 54px;
    margin: 12px 0;
    border-radius: 18px;
    font-weight: 800;
    background: var(--accent);
    color: var(--on-accent);
    border: var(--frame) solid var(--ink);
  }
  textarea {
    width: 100%;
    font: inherit;
    font-size: 13px;
    line-height: 1.6;
    padding: 12px;
    border-radius: 14px;
    border: var(--card-border);
    background: var(--bg);
    color: var(--text);
    resize: vertical;
  }
</style>
