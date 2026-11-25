// 画面スタック型のルーター。URL は使わず、状態だけで画面を積む。
// 遷移アニメーションとスワイプバックは WAAPI で transform / opacity だけを動かす。
import { tick } from "svelte";
import type { Question } from './quiz.ts';
import { spring, SPRINGS, reducedMotion } from './spring.ts';
import type { SpringOptions } from './spring.ts';

export interface AnswerLog {
  q: Question;
  /** 選んだ番号。未回答は null */
  chosen: number | null;
}

export type Route =
  | { name: 'home' }
  | { name: 'quiz'; seed: number }
  | { name: 'result'; logs: AnswerLog[] }
  | { name: 'book' }
  | { name: 'chapter'; no: number }
  | { name: 'root'; id: string }
  | { name: 'word'; w: string }
  | { name: 'group'; id: string }
  | { name: 'settings' }
  | { name: 'scope' }
  | { name: 'stats' };

export type Kind = 'push' | 'modal';

export interface Entry {
  id: number;
  route: Route;
  kind: Kind;
}

const PARALLAX = 0.28; // 下の画面が動く割合
const DIM = 0.12; // 下の画面を暗くする量

let seq = 0;

class Router {
  stack = $state<Entry[]>([{ id: seq++, route: { name: 'home' }, kind: 'push' }]);
  /** 遷移中・スワイプ中（下の画面も見せる） */
  revealing = $state(false);
  private els = new Map<number, HTMLElement>();
  private busy = false;

  get top() {
    return this.stack[this.stack.length - 1];
  }

  register(id: number, el: HTMLElement) {
    this.els.set(id, el);
    return () => this.els.delete(id);
  }

  private pair() {
    const n = this.stack.length;
    const top = this.els.get(this.stack[n - 1].id)!;
    const under = n > 1 ? this.els.get(this.stack[n - 2].id) ?? null : null;
    return { top, under };
  }

  async push(route: Route, kind: Kind = 'push') {
    if (this.busy) return;
    this.busy = true;
    this.revealing = true;
    this.stack.push({ id: seq++, route, kind });
    await tick();
    const { top, under } = this.pair();
    await animateTransition(top, under, kind, 0, 1);
    this.revealing = false;
    this.busy = false;
  }

  async pop(opts: { from?: number; velocity?: number } = {}) {
    if (this.busy && opts.from === undefined) return;
    if (this.stack.length < 2) return;
    this.busy = true;
    this.revealing = true;
    const { top, under } = this.pair();
    await animateTransition(top, under, this.top.kind, opts.from ?? 1, 0, opts.velocity);
    this.stack.pop();
    this.revealing = false;
    this.busy = false;
  }

  /** 今の画面を差し替える（クイズ → 結果 など）。下から差し替え先が現れる */
  async replace(route: Route) {
    if (this.busy) return;
    this.busy = true;
    const old = this.top;
    const oldEl = this.els.get(old.id);
    this.stack[this.stack.length - 1] = { id: seq++, route, kind: old.kind };
    await tick();
    const el = this.els.get(this.top.id);
    if (el) await fadeIn(el, oldEl);
    this.busy = false;
  }

  /** ホームまで戻る（間の画面はアニメーションなしで捨てる） */
  async popToRoot() {
    if (this.stack.length <= 1) return;
    if (this.stack.length > 2) this.stack.splice(1, this.stack.length - 2);
    await tick();
    await this.pop();
  }

  /** スワイプバックの開始（下の画面を見せる） */
  beginGesture(): boolean {
    if (this.busy || this.stack.length < 2 || this.top.kind !== 'push') return false;
    this.busy = true;
    this.revealing = true;
    return true;
  }

  /** スワイプ中の進み具合（0 = 戻りきった, 1 = 今の画面のまま） */
  dragTo(progress: number) {
    const { top, under } = this.pair();
    setFrame(top, under, 'push', progress);
  }

  async endGesture(progress: number, velocity: number, commit: boolean) {
    if (commit) {
      this.busy = false;
      await this.pop({ from: progress, velocity });
    } else {
      const { top, under } = this.pair();
      await animateTransition(top, under, 'push', progress, 1);
      this.revealing = false;
      this.busy = false;
    }
  }
}

/** progress: 1 = 上の画面が表示されている状態, 0 = 上の画面が外に出た状態 */
function frames(kind: Kind, p: number) {
  const w = typeof window !== 'undefined' ? window.innerWidth : 400;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  if (kind === 'modal')
    return {
      top: `translate3d(0, ${(1 - p) * h}px, 0)`,
      under: `translate3d(0, 0, 0)`,
      dim: DIM * 1.5 * p,
    };
  return {
    top: `translate3d(${(1 - p) * w}px, 0, 0)`,
    under: `translate3d(${-PARALLAX * w * p}px, 0, 0)`,
    dim: DIM * p,
  };
}

function setFrame(top: HTMLElement, under: HTMLElement | null, kind: Kind, p: number) {
  const f = frames(kind, p);
  top.getAnimations().forEach((a) => a.cancel());
  top.style.transform = f.top;
  if (under) {
    under.style.transform = f.under;
    const dim = under.querySelector<HTMLElement>(':scope > .dim');
    if (dim) dim.style.opacity = String(f.dim);
  }
}

async function animateTransition(
  top: HTMLElement,
  under: HTMLElement | null,
  kind: Kind,
  from: number,
  to: number,
  velocity = 0,
) {
  const a = frames(kind, from);
  const b = frames(kind, to);
  const dimEl = under?.querySelector<HTMLElement>(':scope > .dim') ?? null;
  const anims: Animation[] = [];
  if (reducedMotion()) {
    // 動きを控えめに: 位置は即座に、透明度だけ短く変える
    const o = { duration: 160, easing: 'ease-out' };
    anims.push(top.animate([{ transform: b.top, opacity: to ? 0 : 1 }, { transform: b.top, opacity: to ? 1 : 0 }], o));
  } else {
    const dist = Math.abs(to - from) || 1;
    const opt: SpringOptions = { ...(kind === 'modal' ? SPRINGS.card : SPRINGS.nav), velocity: velocity / dist };
    if (kind === 'modal') opt.damping = 1;
    const s = spring(opt);
    const o = { duration: s.duration, easing: s.easing };
    anims.push(top.animate([{ transform: a.top }, { transform: b.top }], o));
    if (under) anims.push(under.animate([{ transform: a.under }, { transform: b.under }], o));
    if (dimEl) anims.push(dimEl.animate([{ opacity: a.dim }, { opacity: b.dim }], o));
  }
  // アニメーション終了後の状態をスタイルに書いてからアニメーションを外す
  top.style.transform = b.top;
  if (under) under.style.transform = b.under;
  if (dimEl) dimEl.style.opacity = String(b.dim);
  await Promise.all(anims.map((x) => x.finished.catch(() => {})));
  anims.forEach((x) => x.cancel());
  // 表示中の画面は transform を外す（position: fixed 等の基準がずれないように）
  if (to === 1) top.style.transform = '';
}

async function fadeIn(el: HTMLElement, old: HTMLElement | undefined) {
  if (reducedMotion()) return;
  const s = spring(SPRINGS.card);
  const anim = el.animate(
    [
      { opacity: 0, transform: 'translate3d(0, 24px, 0) scale(0.98)' },
      { opacity: 1, transform: 'none' },
    ],
    { duration: s.duration, easing: s.easing },
  );
  void old;
  await anim.finished.catch(() => {});
}

export const router = new Router();

// ---- スワイプバック ---------------------------------------------------------

/** 画面のどこからでも右スワイプで戻れる（縦スクロールと区別するため、最初の動きで方向を決める） */
export function swipeBack(node: HTMLElement, enabled: boolean) {
  let on = enabled;
  let id: number | null = null;
  let x0 = 0, y0 = 0, w = 1;
  let mode: 'undecided' | 'drag' | 'none' = 'none';
  let hist: { t: number; x: number }[] = [];

  const down = (e: PointerEvent) => {
    if (!on || id !== null || e.pointerType === 'mouse' && e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, [data-noswipe]')) return;
    id = e.pointerId;
    x0 = e.clientX;
    y0 = e.clientY;
    w = window.innerWidth;
    mode = 'undecided';
    hist = [{ t: e.timeStamp, x: e.clientX }];
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (mode === 'undecided') {
      if (Math.hypot(dx, dy) < 10) return;
      if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.2 && router.beginGesture()) {
        mode = 'drag';
        try {
          node.setPointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      } else {
        mode = 'none';
        id = null;
        return;
      }
    }
    if (mode !== 'drag') return;
    hist.push({ t: e.timeStamp, x: e.clientX });
    if (hist.length > 6) hist.shift();
    router.dragTo(1 - Math.max(0, dx) / w);
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = null;
    if (mode !== 'drag') return;
    mode = 'none';
    const dx = Math.max(0, e.clientX - x0);
    const first = hist[0], last = hist[hist.length - 1];
    const vx = (last.x - first.x) / Math.max(1, last.t - first.t); // px/ms
    const p = 1 - dx / w;
    // 進み具合の変化速度（1/秒）。戻る方向が正
    const v = (vx * 1000) / w;
    const commit = e.type !== 'pointercancel' && (dx > w * 0.4 || vx > 0.45) && vx > -0.1;
    router.endGesture(p, Math.max(0, v), commit);
  };
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  return {
    update(v: boolean) {
      on = v;
    },
    destroy() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
    },
  };
}
