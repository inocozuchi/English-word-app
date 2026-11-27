// パソコンのキーボード操作（クイズで選ぶキー・次へ進むキー。設定で選べる）。
// e.code（キーの位置）で見るので、日本語入力がオンでも・大文字でも同じように効く。数字の 1〜9 はいつでも使える。
import type { Settings } from './storage.ts';

export type ChoiceKeys = 'asdf' | 'jkl' | 'qwer' | 'num';
export const CHOICE_KEYS: { id: ChoiceKeys; label: string; codes: string[]; caps: string[] }[] = [
  { id: 'asdf', label: 'A S D F', codes: ['KeyA', 'KeyS', 'KeyD', 'KeyF'], caps: ['A', 'S', 'D', 'F'] },
  { id: 'jkl', label: 'J K L ;', codes: ['KeyJ', 'KeyK', 'KeyL', 'Semicolon'], caps: ['J', 'K', 'L', ';'] },
  { id: 'qwer', label: 'Q W E R', codes: ['KeyQ', 'KeyW', 'KeyE', 'KeyR'], caps: ['Q', 'W', 'E', 'R'] },
  { id: 'num', label: '1 2 3 4', codes: ['Digit1', 'Digit2', 'Digit3', 'Digit4'], caps: ['1', '2', '3', '4'] },
];
const preset = (s: Pick<Settings, 'choiceKeys'>) => CHOICE_KEYS.find((p) => p.id === s.choiceKeys) ?? CHOICE_KEYS[0];

/** 押したキーが何番目の選択肢か（設定のキー、または数字 1〜9）。違えば -1 */
export function choiceIndex(e: Pick<KeyboardEvent, 'code' | 'key'>, s: Pick<Settings, 'choiceKeys'>): number {
  const i = preset(s).codes.indexOf(e.code);
  if (i >= 0) return i;
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code) ?? (/^[1-9]$/.test(e.key) ? [e.key, e.key] : null);
  return m ? +m[1] - 1 : -1;
}
/** 次へ進むキー（Enter・→、設定でスペース） */
export const isNextKey = (e: Pick<KeyboardEvent, 'code' | 'key'>, s: Pick<Settings, 'spaceNext'>) =>
  e.key === 'Enter' || e.code === 'NumpadEnter' || e.key === 'ArrowRight' || (s.spaceNext && (e.code === 'Space' || e.key === ' '));
/** 選択肢の印（A / S / D / F など） */
export const choiceCap = (k: number, s: Pick<Settings, 'choiceKeys'>) => preset(s).caps[k] ?? String(k + 1);
/** 入力欄の中か（入力の問題は今まで通り。キーで選ばない） */
export const inField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};
