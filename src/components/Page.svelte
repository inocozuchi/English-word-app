<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import { router } from '../core/router.svelte.ts';
  import { stagger } from '../core/transitions.ts';
  // 戻るボタン付きの画面の枠。中身はネイティブスクロール
  let {
    title = '',
    back = true,
    children,
    footer,
  }: { title?: string; back?: boolean; children: Snippet; footer?: Snippet } = $props();
  let scrolled = $state(false);

  /** 開いたとき、中身が上から少しずつ浮かび上がる（画面のスライドと一緒に。控えめに） */
  function intro(node: HTMLElement) {
    // 下から「ヌルッ」と: 見出し・パネル・一覧が順に浮かび、パネルや一覧の中の行もさらに1行ずつ遅れて出る
    const kids = [...node.children].slice(0, 14) as HTMLElement[];
    stagger(kids, { step: 45, distance: 34, delay: 40 });
    kids.forEach((el, k) => {
      if (el.matches('.ui-group, ul, ol')) stagger([...el.children].slice(0, 12), { step: 35, distance: 18, delay: 140 + k * 45 });
    });
  }
</script>

<div class="page">
  <header class:scrolled>
    {#if back}
      <button class="back press" onclick={() => router.pop()} aria-label="戻る" title="戻る（Esc）"><Icon name="back" size={26} /></button>
    {/if}
    <span class="small-title" class:show={scrolled}>{title}</span>
  </header>
  <div class="scroll body" use:intro onscroll={(e) => (scrolled = (e.currentTarget as HTMLElement).scrollTop > 40)}>
    {@render children()}
    <div class="end"></div>
  </div>
  {#if footer}<div class="footer">{@render footer()}</div>{/if}
</div>

<style>
  .page {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  header {
    flex: none;
    position: relative;
    display: flex;
    align-items: center;
    height: calc(var(--pad-top) + 44px);
    padding: var(--pad-top) var(--pad-x-r) 0 calc(var(--pad-x) - 10px);
    border-bottom: 0.5px solid transparent;
    transition: border-color 0.2s;
  }
  header.scrolled {
    border-bottom-color: var(--line);
  }
  .back {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    color: var(--accent);
    border-radius: 22px;
  }
  .small-title {
    position: absolute;
    left: 64px;
    right: 64px;
    bottom: 0;
    height: 44px;
    line-height: 44px;
    text-align: center;
    font-weight: 600;
    font-size: 16px;
    opacity: 0;
    transition: opacity 0.2s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .small-title.show {
    opacity: 1;
  }
  .body {
    flex: 1;
    padding: 4px var(--pad-x-r) 0 var(--pad-x);
  }
  .end {
    height: var(--pad-bottom);
  }
  .footer {
    flex: none;
    padding: 12px var(--pad-x-r) var(--pad-bottom) var(--pad-x);
  }
</style>
