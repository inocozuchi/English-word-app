// Svelte のトランジション（CSS アニメーションに変換され、transform と opacity だけを動かす）
import { spring, SPRINGS, reducedMotion } from './spring.ts';

const fade = (duration = 140) => ({ duration, css: (t: number) => `opacity:${t}` });

/** 次の問題カード: 右から入る */
export function cardIn(_node: Element) {
  if (reducedMotion()) return fade();
  const s = spring(SPRINGS.card);
  return {
    duration: s.duration,
    easing: s.ease,
    css: (t: number, u: number) => `transform:translate3d(${u * 56}px,0,0);opacity:${Math.min(1, t * 1.8)}`,
  };
}

/** 前の問題カード: 左へ抜ける */
export function cardOut(_node: Element) {
  if (reducedMotion()) return fade(100);
  return {
    duration: 200,
    css: (t: number, u: number) => `transform:translate3d(${-u * u * 48}px,0,0) scale(${1 - u * 0.03});opacity:${t * t}`,
  };
}

/** 問題（回答前）: 少し上へ縮みながら消える */
export function promptOut(_node: Element) {
  if (reducedMotion()) return fade(100);
  return {
    duration: 180,
    css: (t: number, u: number) => `transform:translate3d(0,${-u * 16}px,0) scale(${1 - u * 0.04});opacity:${t * t}`,
  };
}

/** 解説: 下からふわっと入る（問題が消えるのを少し待つ） */
export function explainIn(_node: Element) {
  if (reducedMotion()) return { ...fade(160), delay: 80 };
  const s = spring(SPRINGS.card);
  return {
    delay: 120,
    duration: s.duration,
    easing: s.ease,
    css: (t: number, u: number) => `transform:translate3d(0,${u * 28}px,0);opacity:${Math.min(1, t * 1.6)}`,
  };
}

/** 正解の選択肢のポップ */
export function popScale(node: HTMLElement) {
  if (reducedMotion()) return;
  const s = spring(SPRINGS.pop);
  node.animate([{ transform: 'scale(0.94)' }, { transform: 'scale(1)' }], { duration: s.duration, easing: s.easing });
}

/** まちがえた選択肢の横揺れ */
export function shake(node: HTMLElement) {
  if (reducedMotion()) return;
  node.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-7px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(2px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 380, easing: 'ease-out' },
  );
}

/** 要素を下からふわっと出す（一覧の初回表示など） */
export function rise(_node: Element, { delay = 0 }: { delay?: number } = {}) {
  if (reducedMotion()) return { ...fade(160), delay };
  const s = spring(SPRINGS.card);
  return {
    delay,
    duration: s.duration,
    easing: s.ease,
    css: (t: number, u: number) => `transform:translate3d(0,${u * 18}px,0);opacity:${Math.min(1, t * 1.5)}`,
  };
}

/** 要素を順番に下からふわっと出す（起動時のホームなど）。fill: backwards で待ち時間中も隠れたまま */
export function stagger(els: Element[], { step = 60, distance = 18, delay = 0 } = {}) {
  const rm = reducedMotion();
  const s = spring(SPRINGS.card);
  els.forEach((el, k) => {
    const d = delay + k * (rm ? 30 : step);
    if (rm) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: d, fill: 'backwards' });
      return;
    }
    el.animate([{ transform: `translate3d(0,${distance}px,0)` }, { transform: 'none' }], {
      duration: s.duration,
      easing: s.easing,
      delay: d,
      fill: 'backwards',
    });
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out', delay: d, fill: 'backwards' });
  });
}

/** 小さな「ポン」: 値が変わった数字やバッジに */
export function bump(el: Element, scale = 1.18) {
  if (reducedMotion()) return;
  const s = spring(SPRINGS.pop);
  el.animate([{ transform: `scale(${scale})` }, { transform: 'scale(1)' }], { duration: s.duration, easing: s.easing });
}

/** 紙吹雪（結果がよかったとき）。アクセント色と黒の小さな図形が弾けて落ちる。transform と opacity だけ */
export function burst(origin: HTMLElement, count = 28) {
  if (reducedMotion()) return;
  const host = origin.ownerDocument.body;
  const r = origin.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let k = 0; k < count; k++) {
    const p = document.createElement('i');
    const size = 6 + Math.random() * 7;
    const kind = k % 3;
    p.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:${kind === 2 ? size * 0.45 : size}px;height:${size}px;` +
      `margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:${kind === 0 ? '50%' : '2px'};` +
      `background:${k % 2 ? 'var(--accent)' : 'var(--ink)'};pointer-events:none;z-index:200;will-change:transform,opacity`;
    host.appendChild(p);
    const ang = (Math.PI * 2 * k) / count + (Math.random() - 0.5) * 0.5;
    const dist = 70 + Math.random() * 90;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist * 0.8 - 30;
    const rot = (Math.random() - 0.5) * 720;
    const dur = 1300 + Math.random() * 500;
    // 全体は等速。区間ごとに「弾ける（減速）→ 落ちる（加速）→ 消える」
    const a = p.animate(
      [
        { transform: 'translate3d(0,0,0) rotate(0) scale(0.4)', opacity: 1, easing: 'cubic-bezier(.1,.8,.3,1)' },
        { transform: `translate3d(${dx}px,${dy}px,0) rotate(${rot * 0.4}deg) scale(1)`, opacity: 1, offset: 0.3, easing: 'cubic-bezier(.5,0,.9,.6)' },
        { transform: `translate3d(${dx * 1.1}px,${dy + 170}px,0) rotate(${rot * 0.8}deg) scale(0.95)`, opacity: 1, offset: 0.78 },
        { transform: `translate3d(${dx * 1.15}px,${dy + 240}px,0) rotate(${rot}deg) scale(0.9)`, opacity: 0 },
      ],
      { duration: dur, delay: Math.random() * 80 },
    );
    a.finished.finally(() => p.remove());
  }
}
