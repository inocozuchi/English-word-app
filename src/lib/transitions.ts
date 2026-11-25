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

/** 解説シート: 下から入る */
export function sheetIn(_node: Element, { delay = 0 }: { delay?: number } = {}) {
  if (reducedMotion()) return { ...fade(160), delay };
  const s = spring(SPRINGS.card);
  return {
    delay,
    duration: s.duration,
    easing: s.ease,
    css: (t: number, u: number) => `transform:translate3d(0,${u * 110}%,0);opacity:${Math.min(1, 0.4 + t)}`,
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
