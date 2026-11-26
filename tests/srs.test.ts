import { describe, it, expect } from 'vitest';
import { review, selectItems, INTERVALS, MAX_BOX, arrange } from '../src/core/srs.ts';
import type { Candidate, ItemState } from '../src/core/srs.ts';
import { createRng } from '../src/core/rng.ts';

const T = 20000;
const cand = (i: number, group = 'g' + i, extra: Partial<Candidate> = {}): Candidate => ({
  key: 'ej:w' + i, base: 'w:w' + i, group, newOrder: i, ...extra,
});
const st = (p: Partial<ItemState>): ItemState => ({
  box: 1, due: T, seen: 1, correct: 1, wrong: 0, last: 1, lastOk: true, ...p,
});

describe('review', () => {
  it('正解で箱が上がり、間隔があく', () => {
    let s = review(undefined, true, 1, T);
    expect(s.box).toBe(1);
    expect(s.due).toBe(T + INTERVALS[1]);
    s = review(s, true, 2, T + 1);
    expect(s.box).toBe(2);
    expect(s.due).toBe(T + 1 + INTERVALS[2]);
  });
  it('まちがえると箱0に戻り、その日のうちに再出題対象になる', () => {
    const s = review(st({ box: 4 }), false, 5, T);
    expect(s).toMatchObject({ box: 0, due: T, wrong: 1, lastOk: false, seen: 2 });
  });
  it('箱は上限を超えない', () => {
    expect(review(st({ box: MAX_BOX }), true, 1, T).box).toBe(MAX_BOX);
  });
});

describe('selectItems', () => {
  const rng = () => createRng(42);
  it('まちがえた語 → 期限切れ → 未習 → 期限前 の順に優先する', () => {
    const cands = [0, 1, 2, 3, 4, 5].map((i) => cand(i));
    const items: Record<string, ItemState> = {
      'ej:w0': st({ due: T + 5 }), // 期限前
      'ej:w1': st({ due: T - 1 }), // 期限切れ（正解済み）
      'ej:w2': st({ box: 0, due: T, lastOk: false }), // まちがえた
      // w3, w4, w5 は未習
    };
    const keys = (n: number) => new Set(selectItems(cands, items, { count: n, today: T, rng: rng() }).map((c) => c.key));
    expect(keys(1)).toEqual(new Set(['ej:w2']));
    expect(keys(2)).toEqual(new Set(['ej:w2', 'ej:w1']));
    expect(keys(4)).toEqual(new Set(['ej:w2', 'ej:w1', 'ej:w3', 'ej:w4']));
    expect(keys(6).has('ej:w0')).toBe(true);
  });
  it('覚えた語（期限前）は未習の語より後回し', () => {
    const cands = [0, 1, 2].map((i) => cand(i));
    const items = { 'ej:w0': st({ box: 4, due: T + 10 }) };
    const r = selectItems(cands, items, { count: 2, today: T, rng: rng() }).map((c) => c.key);
    expect(r.sort()).toEqual(['ej:w1', 'ej:w2']);
  });
  it('未習は学習順（newOrder）で出す', () => {
    const cands = [5, 3, 9, 1].map((i) => cand(i));
    const r = selectItems(cands, {}, { count: 2, today: T, rng: rng() }).map((c) => c.key);
    expect(r.sort()).toEqual(['ej:w1', 'ej:w3']);
  });
  it('同じ対象（base）は1セッションに1回だけ', () => {
    const cands = [cand(1), { ...cand(1), key: 'je:w1', newOrder: 2 }, cand(3)];
    const r = selectItems(cands, {}, { count: 3, today: T, rng: rng() });
    expect(r.map((c) => c.base).sort()).toEqual(['w:w1', 'w:w3']);
  });
  it('前提（requires）を満たさない未習は後回し', () => {
    const cands = [cand(1, 'a', { key: 'je:w1', requires: 'ej:w1' }), cand(2)];
    const r = selectItems(cands, {}, { count: 1, today: T, rng: rng() });
    expect(r[0].key).toBe('ej:w2');
  });
  it('前回の最後の問題を最初に出さない', () => {
    const cands = [0, 1, 2, 3].map((i) => cand(i));
    for (let seed = 0; seed < 50; seed++) {
      const r = selectItems(cands, {}, { count: 4, today: T, rng: createRng(seed), avoidFirst: 'w:w0' });
      expect(r[0].base).not.toBe('w:w0');
    }
  });
  it('問題が重複せず、指定数だけ返す', () => {
    const cands = Array.from({ length: 50 }, (_, i) => cand(i, 'g' + (i % 5)));
    const r = selectItems(cands, {}, { count: 10, today: T, rng: rng() });
    expect(r).toHaveLength(10);
    expect(new Set(r.map((c) => c.key)).size).toBe(10);
  });
});

describe('arrange', () => {
  it('できるだけ同じ語源が隣り合わない', () => {
    const list = [cand(0, 'a'), cand(1, 'a'), cand(2, 'b'), cand(3, 'b'), cand(4, 'c'), cand(5, 'c')];
    for (let seed = 0; seed < 30; seed++) {
      const r = arrange(list, createRng(seed), null);
      let adj = 0;
      for (let i = 1; i < r.length; i++) if (r[i].group === r[i - 1].group) adj++;
      expect(adj).toBeLessThanOrEqual(1);
    }
  });
});
