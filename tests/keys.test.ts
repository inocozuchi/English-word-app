import { describe, it, expect } from 'vitest';
import { choiceIndex, isNextKey, choiceCap } from '../src/core/keys.ts';

const ev = (code: string, key = '') => ({ code, key });
describe('キーボード', () => {
  it('A S D F で 1〜4 番目（日本語入力中・大文字でも位置で判定）', () => {
    const s = { choiceKeys: 'asdf' as const };
    expect(['KeyA', 'KeyS', 'KeyD', 'KeyF'].map((c) => choiceIndex(ev(c, 'Process'), s))).toEqual([0, 1, 2, 3]);
    expect(choiceIndex(ev('KeyJ', 'j'), s)).toBe(-1);
    expect(choiceIndex(ev('Digit3', '3'), s)).toBe(2);
    expect(choiceIndex(ev('Numpad2', '2'), s)).toBe(1);
    expect(choiceCap(0, s)).toBe('A');
  });
  it('ほかの並びに切り替えられる', () => {
    const s = { choiceKeys: 'jkl' as const };
    expect(choiceIndex(ev('Semicolon', ';'), s)).toBe(3);
    expect(choiceIndex(ev('KeyA', 'a'), s)).toBe(-1);
    expect(choiceCap(3, s)).toBe(';');
  });
  it('次へ: Enter・→、設定でスペース', () => {
    expect(isNextKey(ev('Enter', 'Enter'), { spaceNext: false })).toBe(true);
    expect(isNextKey(ev('ArrowRight', 'ArrowRight'), { spaceNext: false })).toBe(true);
    expect(isNextKey(ev('Space', ' '), { spaceNext: false })).toBe(false);
    expect(isNextKey(ev('Space', ' '), { spaceNext: true })).toBe(true);
  });
});
