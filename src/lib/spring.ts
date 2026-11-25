// スプリングを数値的に解き、CSS の linear() イージング（と JS 用のイージング関数）に変換する。
// アニメーション自体は WAAPI / CSS で transform・opacity だけを動かす。

export interface SpringOptions {
  /** 周期の目安（秒）。小さいほど速い（SwiftUI の response に相当） */
  response?: number;
  /** 減衰比。1 で跳ねない、小さいほど跳ねる */
  damping?: number;
  /** 初速（進む距離を1とした単位/秒）。スワイプの勢いを引き継ぐのに使う */
  velocity?: number;
}

export interface Spring {
  /** ミリ秒 */
  duration: number;
  /** CSS の linear() 文字列（非対応ブラウザでは cubic-bezier） */
  easing: string;
  /** 0〜1 の時刻 → 進み具合（行き過ぎることもある） */
  ease: (t: number) => number;
}

const FALLBACK = 'cubic-bezier(0.2, 0.9, 0.25, 1)';
let linearSupported: boolean | null = null;
function supportsLinear() {
  if (linearSupported === null)
    linearSupported = typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)');
  return linearSupported;
}

const cache = new Map<string, Spring>();

export function spring({ response = 0.42, damping = 0.86, velocity = 0 }: SpringOptions = {}): Spring {
  const key = `${response}|${damping}|${velocity.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const k = (2 * Math.PI / response) ** 2;
  const c = 4 * Math.PI * damping / response;
  // 半陰的オイラー法で 1ms 刻みに解く（位置0 → 目標1）
  const dt = 1 / 1000;
  let x = 0, v = velocity, t = 0;
  const samples: number[] = [0];
  const step = 1 / 120; // 120fps 相当で記録
  let next = step;
  while (t < 3) {
    v += (-k * (x - 1) - c * v) * dt;
    x += v * dt;
    t += dt;
    if (t >= next) {
      samples.push(x);
      next += step;
      if (Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.02) break;
    }
  }
  samples[samples.length - 1] = 1;
  const duration = Math.round((samples.length - 1) * step * 1000);
  // linear() は点が多すぎると重いので間引く（最大 60 点）
  const stride = Math.max(1, Math.ceil(samples.length / 60));
  const pts: number[] = [];
  for (let i = 0; i < samples.length; i += stride) pts.push(samples[i]);
  if (pts[pts.length - 1] !== 1) pts.push(1);
  const easing = supportsLinear() ? `linear(${pts.map((p) => +p.toFixed(4)).join(', ')})` : FALLBACK;
  const ease = (u: number) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    const f = u * (samples.length - 1);
    const i = Math.floor(f);
    return samples[i] + (samples[i + 1] - samples[i]) * (f - i);
  };
  const s = { duration, easing, ease };
  cache.set(key, s);
  return s;
}

/** よく使うスプリング */
export const SPRINGS = {
  /** 画面遷移（跳ねない・iOS のナビゲーションに近い） */
  nav: { response: 0.48, damping: 1 },
  /** カードの出入り（ほんの少し跳ねる） */
  card: { response: 0.42, damping: 0.82 },
  /** 正誤のポップ（よく跳ねる） */
  pop: { response: 0.32, damping: 0.55 },
  /** タップから戻る */
  press: { response: 0.3, damping: 0.6 },
} satisfies Record<string, SpringOptions>;

const rm = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reducedMotion = () => !!rm?.matches;

/** CSS で使うスプリングを CSS 変数として登録する */
export function installSpringVars(root: HTMLElement) {
  const set = (name: string, o: SpringOptions) => {
    const s = spring(o);
    root.style.setProperty(`--ease-${name}`, s.easing);
    root.style.setProperty(`--dur-${name}`, `${s.duration}ms`);
  };
  for (const [name, o] of Object.entries(SPRINGS)) set(name, o);
}
