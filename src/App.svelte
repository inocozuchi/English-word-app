<script lang="ts">
  import type { Component } from 'svelte';
  import { router, swipeBack } from './core/router.svelte.ts';
  import { store, modes } from './core/store.svelte.ts';
  import Home from './screens/Home.svelte';
  import Quiz from './screens/Quiz.svelte';
  import Result from './screens/Result.svelte';
  import Settings from './screens/Settings.svelte';
  import Stats from './screens/Stats.svelte';
  import ReviewList from './screens/ReviewList.svelte';
  import { overlay } from './core/overlay.svelte.ts';

  // 画面の登録: 共通の画面 + 各デッキの画面（'ety/word' など）
  const SCREENS: Record<string, Component<any>> = {
    home: Home,
    quiz: Quiz,
    result: Result,
    settings: Settings,
    stats: Stats,
    review: ReviewList,
    ...Object.assign({}, ...modes.map((d) => d.screens)),
  };

  function reg(node: HTMLElement, id: number) {
    return { destroy: router.register(id, node) };
  }

  // パソコン: Esc・Alt+←・マウスの「戻る」ボタンで前の画面へ（スワイプバックの代わり）。
  // クイズなど全画面の学習（modal）は各画面が Esc を扱う。入力中・重なり表示中は使わない
  function canGoBack(t: EventTarget | null) {
    const el = t as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return false;
    if (overlay.count > 0 || document.querySelector('[aria-modal="true"]')) return false;
    const top = router.top;
    return router.stack.length > 1 && top.kind === 'push';
  }
  function onkey(e: KeyboardEvent) {
    if (e.defaultPrevented || e.repeat) return;
    if ((e.key === 'Escape' || (e.altKey && e.key === 'ArrowLeft')) && canGoBack(e.target)) {
      e.preventDefault();
      router.pop();
    }
  }
  function onmouseup(e: MouseEvent) {
    if (e.button === 3 && canGoBack(e.target)) {
      e.preventDefault();
      router.pop();
    }
  }

  // テーマ（設定で固定した場合）とステータスバーの色
  $effect(() => {
    const t = store.settings.theme;
    const root = document.documentElement;
    if (t === 'system') delete root.dataset.theme;
    else root.dataset.theme = t;
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    metas.forEach((m) => {
      const isDark = m.media.includes('dark');
      m.content = t === 'system' ? (isDark ? '#0b0b0d' : '#ffffff') : t === 'dark' ? '#0b0b0d' : '#ffffff';
    });
  });
</script>

<svelte:window onkeydown={onkey} {onmouseup} />

{#each router.stack as e, i (e.id)}
  {@const depth = router.stack.length - 1 - i}
  {@const Screen = SCREENS[e.route.name] ?? Home}
  <div
    class="screen"
    class:hidden={depth > 1 || (depth === 1 && !router.revealing)}
    style:z-index={i + 1}
    use:reg={e.id}
    use:swipeBack={depth === 0 && i > 0 && e.kind === 'push'}
    inert={depth > 0}
  >
    <Screen {...e.route.params ?? {}} />
    <div class="dim"></div>
  </div>
{/each}

<style>
  .screen {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: var(--bg);
    touch-action: pan-y;
    contain: layout paint;
  }
  .screen.hidden {
    visibility: hidden;
  }
  .dim {
    position: absolute;
    inset: 0;
    background: #000;
    opacity: 0;
    pointer-events: none;
    z-index: 100;
  }
</style>
