<script lang="ts">
  import { router, swipeBack } from './lib/router.svelte.ts';
  import { store } from './lib/store.svelte.ts';
  import Home from './screens/Home.svelte';
  import Quiz from './screens/Quiz.svelte';
  import Result from './screens/Result.svelte';
  import Book from './screens/Book.svelte';
  import Chapter from './screens/Chapter.svelte';
  import RootView from './screens/RootView.svelte';
  import WordView from './screens/WordView.svelte';
  import GroupView from './screens/GroupView.svelte';
  import Settings from './screens/Settings.svelte';
  import Scope from './screens/Scope.svelte';
  import Stats from './screens/Stats.svelte';

  function reg(node: HTMLElement, id: number) {
    return { destroy: router.register(id, node) };
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

{#each router.stack as e, i (e.id)}
  {@const depth = router.stack.length - 1 - i}
  <div
    class="screen"
    class:hidden={depth > 1 || (depth === 1 && !router.revealing)}
    style:z-index={i + 1}
    use:reg={e.id}
    use:swipeBack={depth === 0 && i > 0 && e.kind === 'push'}
    inert={depth > 0}
  >
    {#if e.route.name === 'home'}<Home />
    {:else if e.route.name === 'quiz'}<Quiz seed={e.route.seed} />
    {:else if e.route.name === 'result'}<Result logs={e.route.logs} />
    {:else if e.route.name === 'book'}<Book />
    {:else if e.route.name === 'chapter'}<Chapter no={e.route.no} />
    {:else if e.route.name === 'root'}<RootView id={e.route.id} />
    {:else if e.route.name === 'word'}<WordView w={e.route.w} />
    {:else if e.route.name === 'group'}<GroupView id={e.route.id} />
    {:else if e.route.name === 'settings'}<Settings />
    {:else if e.route.name === 'scope'}<Scope />
    {:else if e.route.name === 'stats'}<Stats />
    {/if}
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
