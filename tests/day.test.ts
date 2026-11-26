import { describe, it, expect } from 'vitest';
import { dayNumber, dayKey, keyToDay, streak } from '../src/core/day.ts';

describe('day', () => {
  it('午前4時で日が切り替わる', () => {
    const a = new Date(2026, 10, 25, 3, 59).getTime();
    const b = new Date(2026, 10, 25, 4, 0).getTime();
    expect(dayNumber(b) - dayNumber(a)).toBe(1);
    expect(dayKey(dayNumber(b))).toBe('2026-11-25');
    expect(dayKey(dayNumber(a))).toBe('2026-11-24');
    expect(keyToDay('2026-11-25')).toBe(dayNumber(b));
  });
  it('連続日数を数える（今日未学習でも昨日まで続いていれば継続）', () => {
    const t = keyToDay('2026-11-25');
    const days = { '2026-11-22': { a: 3 }, '2026-11-23': { a: 1 }, '2026-11-24': { a: 10 } };
    expect(streak(days, t)).toBe(3);
    expect(streak({ ...days, '2026-11-25': { a: 1 } }, t)).toBe(4);
    expect(streak(days, t + 1)).toBe(0);
    expect(streak({}, t)).toBe(0);
  });
});
