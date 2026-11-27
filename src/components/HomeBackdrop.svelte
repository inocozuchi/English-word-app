<script lang="ts">
  // ホームの背景: 大きな輪郭文字の英語が3列でゆっくり左右に流れ、輪の矢印（LOOP）がゆっくり回る。
  // 語は今のモードから毎回ちがうものを選び、学習した語はアクセント色。動きは transform だけで、
  // ホームが見えていない間・アプリを離れている間は止める。動きを減らす設定では止まったまま。
  // パソコンではポインターの位置に合わせて少しだけ奥行きが動く。
  import { store, activeMode } from '../core/store.svelte.ts';
  import { router } from '../core/router.svelte.ts';
  import { shuffle, createRng } from '../core/rng.ts';

  /** モードが語を持たないとき（イメージリンクなど）: コアイメージで覚える基本の語 */
  const BASIC = ['in', 'on', 'at', 'over', 'under', 'through', 'across', 'by', 'with', 'for', 'to', 'from', 'into', 'out of', 'off', 'up', 'down', 'around', 'along', 'beyond', 'get', 'take', 'make', 'give', 'have', 'keep', 'put', 'come', 'go', 'run', 'break', 'hold'];
  const ROWS = 3;
  const PER_ROW = 7;

  const mode = $derived(activeMode());
  // 起動ごとに選び直す（同じ起動の中ではモードを変えたときだけ）
  const seed = Math.floor(Math.random() * 1e9);
  const rows = $derived.by(() => {
    const src = mode.backdrop?.() ?? [];
    const pool = src.length >= 12 ? src : BASIC.map((t) => ({ t, id: '' }));
    // 学習した語（記録のキーの末尾が id）
    const seen = new Set<string>();
    for (const k of Object.keys(store.progress.items)) {
      seen.add(k);
      seen.add(k.slice(k.indexOf(':') + 1));
    }
    const rng = createRng(seed + mode.id.length);
    const known = pool.filter((w) => w.id && seen.has(w.id));
    // 学習した語を3割ほど混ぜる（なければ全部まだの語）
    const picked = [...shuffle(known, rng).slice(0, Math.round(ROWS * PER_ROW * 0.3)), ...shuffle(pool, rng)];
    const uniq = [...new Map(picked.map((w) => [w.t.toLowerCase(), w])).values()].slice(0, ROWS * PER_ROW);
    const ordered = shuffle(uniq, rng);
    return Array.from({ length: ROWS }, (_, r) => ordered.slice(r * PER_ROW, (r + 1) * PER_ROW).map((w) => ({ t: w.t, known: !!w.id && seen.has(w.id) })));
  });
  // ホームが一番上にないとき（ほかの画面を開いている間）は止める
  const idle = $derived(router.stack.length > 1);

  let el: HTMLElement;
  /** パソコン: ポインターの位置で列を少しずらす（requestAnimationFrame で1フレームに1回だけ） */
  function parallax(node: HTMLElement) {
    el = node;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0, x = 0, y = 0;
    const move = (e: PointerEvent) => {
      x = e.clientX / innerWidth - 0.5;
      y = e.clientY / innerHeight - 0.5;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          el.style.setProperty('--px', x.toFixed(3));
          el.style.setProperty('--py', y.toFixed(3));
        });
    };
    addEventListener('pointermove', move, { passive: true });
    return { destroy: () => (removeEventListener('pointermove', move), cancelAnimationFrame(raf)) };
  }
</script>

<div class="bd" class:idle aria-hidden="true" use:parallax>
  {#each rows as row, r (r + row.map((w) => w.t).join('|'))}
    <div class="row r{r}" style:--d="{86 + r * 22}s">
      <!-- 同じ並びを2つ続けて、半分動いたら最初に戻す（つなぎ目が見えない） -->
      <div class="track">
        {#each [0, 1] as copy}
          {#each row as w}<span class="w display" class:known={w.known} aria-hidden={copy === 1}>{w.t}</span>{/each}
        {/each}
      </div>
    </div>
  {/each}
  <!-- 輪の矢印（アイコンと同じ「LOOP」）: 290° の弧と、その終わりの接線に合わせた矢じり -->
  <svg class="ring" viewBox="0 0 200 200">
    <path d="M139.0 32.5 A78 78 0 1 1 49.9 40.2" />
    <path d="M34.6 36.1 L58.3 33.2 L51.3 56.0" />
  </svg>
</div>

<style>
  .bd {
    --px: 0;
    --py: 0;
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
    contain: strict;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    padding: 12vh 0;
    opacity: 0;
    animation: bdIn 1.2s 0.4s ease-out forwards;
  }
  @keyframes bdIn {
    to {
      opacity: 1;
    }
  }
  .row {
    white-space: nowrap;
    transform: translate3d(calc(var(--px) * -18px), calc(var(--py) * -10px), 0);
    transition: transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .row.r1 {
    transform: translate3d(calc(var(--px) * 26px), calc(var(--py) * -6px), 0);
  }
  .track {
    display: inline-flex;
    will-change: transform;
    animation: flow var(--d) linear infinite;
  }
  .r1 .track {
    animation-direction: reverse;
  }
  @keyframes flow {
    from {
      transform: translate3d(0, 0, 0);
    }
    to {
      transform: translate3d(-50%, 0, 0);
    }
  }
  /* 輪郭文字: 可変フォントの字形は輪郭が重なっているので、線だけ描くと「t」の横棒などの中にも線が出る。
     線（2倍の太さ）を先に描き、背景色で塗りつぶして内側を隠す（paint-order）。半透明にすると透けるので、色の濃さで薄くする */
  .w {
    font-size: clamp(54px, 13vw, 150px);
    letter-spacing: -0.01em;
    color: var(--bg);
    -webkit-text-stroke: 2.6px color-mix(in srgb, var(--line-strong) 62%, var(--bg));
    paint-order: stroke fill;
    text-transform: none;
    /* 語と語の間（各語の右に付けるので、半分動いたところがちょうど最初と同じになる） */
    padding-right: 0.42em;
  }
  .w.known {
    -webkit-text-stroke-color: color-mix(in srgb, var(--accent) 34%, var(--bg));
  }
  .ring {
    position: absolute;
    width: clamp(220px, 46vw, 460px);
    right: -12%;
    top: 6%;
    fill: none;
    stroke: var(--accent);
    stroke-width: 7;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.1;
    will-change: transform;
    animation: spin 60s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  /* ほかの画面を開いている間は止める（見えないところで動かさない） */
  .idle .track,
  .idle .ring {
    animation-play-state: paused;
  }
  @media (prefers-reduced-motion: reduce) {
    .track,
    .ring {
      animation: none;
    }
    .bd {
      animation-duration: 0.01s;
    }
  }
</style>
