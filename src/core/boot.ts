// 起動時の「カクッ」を防ぐ。
// ホーム画面から起動した直後の iOS は、最初の一瞬だけ画面の高さやセーフエリアが確定しておらず、
// 欧文フォントも遅れて差し替わる。そのまま描くと配置がずれて見えるので、
// フォントの読み込みと画面サイズの確定を待ってから、ホームを静かに表示する（html.booted）。
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

let resolveBoot!: () => void;
export const booted = new Promise<void>((r) => (resolveBoot = r));
export const isBooted = () => document.documentElement.classList.contains('booted');

/** 画面の高さとセーフエリアが 150ms 変わらなくなるまで待つ（最大 maxMs） */
async function stableViewport(maxMs: number) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  const read = () => {
    const cs = getComputedStyle(probe);
    return `${innerWidth}x${innerHeight}|${cs.paddingTop}|${cs.paddingBottom}`;
  };
  const start = performance.now();
  let last = read();
  let since = performance.now();
  while (performance.now() - start < maxMs) {
    await frame();
    const now = read();
    if (now !== last) {
      last = now;
      since = performance.now();
    } else if (performance.now() - since >= 150) break;
  }
  probe.remove();
}

export async function boot() {
  const fonts = document.fonts?.load
    ? Promise.all([document.fonts.load('850 48px Inter'), document.fonts.load('600 16px Inter')]).catch(() => {})
    : Promise.resolve();
  await Promise.race([fonts, wait(700)]);
  await stableViewport(900);
  document.documentElement.classList.add('booted');
  resolveBoot();
}
