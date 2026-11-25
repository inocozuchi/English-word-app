import { describe, it, expect } from 'vitest';
import { updateReview, reviewOrder, reviewCount } from '../src/core/review.ts';
import type { ReviewList } from '../src/core/review.ts';
import { normalizeSettings, normalizeProgress } from '../src/core/storage.ts';
import { buildSession } from '../src/core/session.ts';
import type { Deck, Question } from '../src/core/deck.ts';
import { createRng } from '../src/core/rng.ts';

describe('updateReview（復習リスト）', () => {
  it('まちがえると追加され、連続で goal 回正解すると外れる', () => {
    let list: ReviewList = {};
    let r = updateReview(list, 'd', 'k', false, 1, 3);
    expect(r.event).toBe('added');
    list = r.list;
    r = updateReview(list, 'd', 'k', true, 2, 3);
    expect(r.event).toBe('progress');
    expect(r.list.k.streak).toBe(1);
    r = updateReview(r.list, 'd', 'k', true, 3, 3);
    expect(r.list.k.streak).toBe(2);
    r = updateReview(r.list, 'd', 'k', true, 4, 3);
    expect(r.event).toBe('cleared');
    expect(r.list.k).toBeUndefined();
  });
  it('途中でまちがえると連続正解は 0 に戻る', () => {
    let r = updateReview({}, 'd', 'k', false, 1, 2);
    r = updateReview(r.list, 'd', 'k', true, 2, 2);
    r = updateReview(r.list, 'd', 'k', false, 3, 2);
    expect(r.event).toBe('missed');
    expect(r.list.k).toMatchObject({ streak: 0, misses: 2 });
    r = updateReview(r.list, 'd', 'k', true, 4, 2);
    expect(r.event).toBe('progress');
  });
  it('リストにない問題に正解しても何も起きない', () => {
    const r = updateReview({}, 'd', 'k', true, 1, 3);
    expect(r.event).toBeNull();
    expect(r.list).toEqual({});
  });
  it('連続正解が少なく、まちがえが多い順に並べ、デッキで絞る', () => {
    const e = (key: string, streak: number, misses: number, deck = 'd') => ({ deck, key, added: 0, misses, streak, last: 0 });
    const list = { a: e('a', 2, 1), b: e('b', 0, 1), c: e('c', 0, 4), x: e('x', 0, 9, 'other') };
    expect(reviewOrder(list, 'd', createRng(1)).map((x) => x.key)).toEqual(['c', 'b', 'a']);
    expect(reviewCount(list, 'd')).toBe(3);
  });
});

describe('旧形式のデータの移行', () => {
  it('設定: formats / excludedRoots を語源デッキの設定へ移す', () => {
    const s = normalizeSettings({ advanceSec: 4, formats: ['ej', 'rm'], excludedRoots: ['volve'] });
    expect(s.decks.etymology).toEqual({ formats: ['ej', 'rm'], excludedRoots: ['volve'] });
    expect(s.advanceSec).toBe(4);
    expect(s.reviewGoal).toBe(3);
  });
  it('履歴: 前回まちがえた問題で復習リストを作る', () => {
    const p = normalizeProgress({
      items: {
        'ej:a': { box: 0, due: 1, seen: 2, correct: 1, wrong: 1, last: 5, lastOk: false },
        'ej:b': { box: 2, due: 9, seen: 2, correct: 2, wrong: 0, last: 5, lastOk: true },
      },
      days: {},
    });
    expect(Object.keys(p.review)).toEqual(['ej:a']);
    expect(p.review['ej:a'].deck).toBe('etymology');
  });
});

describe('buildSession（復習モード）', () => {
  // 最小のデッキ（キー = 'q:<n>'、base = n）
  const q = (key: string): Question => ({ deck: 'd', key, base: key, group: key, mode: 'm', modeLabel: '', choices: [], answer: 0, data: null });
  const deck = { id: 'd', candidates: () => [], question: (k: string) => (k === 'gone' ? null : q(k)) } as unknown as Deck;
  const entry = (key: string) => ({ deck: 'd', key, added: 0, misses: 1, streak: 0, last: 0 });
  it('復習リストの問題だけを、指定数まで出す（消えたデータは飛ばす）', () => {
    const review = { a: entry('a'), b: entry('b'), gone: entry('gone'), c: entry('c') };
    const qs = buildSession({ deck, deckSettings: {}, mode: 'review', count: 2, items: {}, review, today: 0, rng: createRng(1) });
    expect(qs).toHaveLength(2);
    expect(qs.every((x) => ['a', 'b', 'c'].includes(x.key))).toBe(true);
    const all = buildSession({ deck, deckSettings: {}, mode: 'review', count: 10, items: {}, review, today: 0, rng: createRng(1) });
    expect(all.map((x) => x.key).sort()).toEqual(['a', 'b', 'c']);
  });
});
