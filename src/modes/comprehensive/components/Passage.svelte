<script lang="ts">
  // 読解の資料（架空の文書）。答えたあとは、答えの根拠になる文に印を付ける
  import { normalize } from '../grade.ts';
  let { title, text, answers = [], showEvidence = false }: { title: string; text: string; answers?: string[]; showEvidence?: boolean } = $props();
  const sentences = $derived(text.split(/(?<=[.!?])\s+|\n+/).filter((x) => x.trim()));
  /** 答えの語（数字・英語）を含む文が根拠 */
  const isEvidence = (sent: string) => {
    if (!showEvidence) return false;
    const n = normalize(sent);
    return answers.some((a) => {
      const k = normalize(a);
      return k.length >= 1 && /[0-9a-z]/.test(k) && n.includes(k);
    });
  };
</script>

<section class="doc" aria-label="資料：{title}">
  <p class="hd"><b>{title}</b><span class="fict">架空の練習資料</span></p>
  <p class="body en">
    {#each sentences as s}<span class:ev={isEvidence(s)}>{s}</span>{' '}{/each}
  </p>
  {#if showEvidence && sentences.some(isEvidence)}<p class="note"><span class="mk">▍</span>印の文が答えの根拠です</p>{/if}
</section>

<style>
  .doc {
    padding: 14px;
    border-radius: 16px;
    border: var(--card-border);
    background: var(--fill);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .hd {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 14px;
  }
  .fict {
    font-size: 11px;
    font-weight: 700;
    color: var(--text3);
  }
  .body {
    font-size: 16px;
    line-height: 1.6;
  }
  .ev {
    background: var(--accent-soft);
    box-shadow: inset 3px 0 0 var(--accent);
    padding: 1px 3px;
    border-radius: 4px;
  }
  .note {
    font-size: 12px;
    color: var(--text2);
  }
  .mk {
    color: var(--accent);
  }
</style>
