import { describe, it, expect } from 'vitest';
import { updateReview, reviewOrder, reviewCount } from '../src/core/review.ts';
import type { ReviewList } from '../src/core/review.ts';
import { normalizeSettings, normalizeProgress, parseImport, exportData, emptyProgress } from '../src/core/storage.ts';
import { buildSession } from '../src/core/session.ts';
import type { QuizMode, Question } from '../src/core/mode.ts';
import { createRng } from '../src/core/rng.ts';

describe('updateReview（復習リスト）', () => {
  it('まちがえると追加され、連続で goal 回正解すると外れる', () => {
    let list: ReviewList = {};
    let r = updateReview(list, 'k', false, 1, 3);
    expect(r.event).toBe('added');
    list = r.list;
    r = updateReview(list, 'k', true, 2, 3);
    expect(r.event).toBe('progress');
    expect(r.list.k.streak).toBe(1);
    r = updateReview(r.list, 'k', true, 3, 3);
    expect(r.list.k.streak).toBe(2);
    r = updateReview(r.list, 'k', true, 4, 3);
    expect(r.event).toBe('cleared');
    expect(r.list.k).toBeUndefined();
  });
  it('途中でまちがえると連続正解は 0 に戻る', () => {
    let r = updateReview({}, 'k', false, 1, 2);
    r = updateReview(r.list, 'k', true, 2, 2);
    r = updateReview(r.list, 'k', false, 3, 2);
    expect(r.event).toBe('missed');
    expect(r.list.k).toMatchObject({ streak: 0, misses: 2 });
    r = updateReview(r.list, 'k', true, 4, 2);
    expect(r.event).toBe('progress');
  });
  it('リストにない問題に正解しても何も起きない', () => {
    const r = updateReview({}, 'k', true, 1, 3);
    expect(r.event).toBeNull();
    expect(r.list).toEqual({});
  });
  it('連続正解が少なく、まちがえが多い順に並べる', () => {
    const e = (key: string, streak: number, misses: number) => ({ key, added: 0, misses, streak, last: 0 });
    const list = { a: e('a', 2, 1), b: e('b', 0, 1), c: e('c', 0, 4) };
    expect(reviewOrder(list, createRng(1)).map((x) => x.key)).toEqual(['c', 'b', 'a']);
    expect(reviewCount(list)).toBe(3);
  });
});

describe('保存形式の移行（語源英単語だけだった頃のデータ → モード別）', () => {
  it('旧設定: 秒数と出題範囲を語源英単語モードの設定へ移す', () => {
    const s = normalizeSettings({ advanceSec: 4, answerSec: 9, count: 15, formats: ['ej', 'rm'], excludedRoots: ['volve'] });
    expect(s.modes.etymology).toEqual({ formats: ['ej', 'rm'], excludedRoots: ['volve'], advanceSec: 4, answerSec: 9 });
    expect(s.count).toBe(15);
    expect(s.activeMode).toBe('etymology');
    expect(s.reviewGoal).toBe(3);
  });
  it('旧設定（デッキ分け後）: decks.etymology と activeDeck を引き継ぐ', () => {
    const s = normalizeSettings({ advanceSec: 6, activeDeck: 'etymology', decks: { etymology: { formats: ['je'], excludedRoots: [] } } });
    expect(s.modes.etymology).toEqual({ formats: ['je'], excludedRoots: [], advanceSec: 6 });
    expect(s.activeMode).toBe('etymology');
  });
  it('新しい形式の設定はそのまま読む', () => {
    const s = normalizeSettings({ activeMode: 'sound', modes: { sound: { advanceSec: 8 } }, count: 10 });
    expect(s.activeMode).toBe('sound');
    expect(s.modes.sound.advanceSec).toBe(8);
  });
  it('旧履歴: 前回まちがえた問題で復習リストを作る', () => {
    const p = normalizeProgress({
      items: {
        'ej:a': { box: 0, due: 1, seen: 2, correct: 1, wrong: 1, last: 5, lastOk: false },
        'ej:b': { box: 2, due: 9, seen: 2, correct: 2, wrong: 0, last: 5, lastOk: true },
      },
      days: { '2026-11-24': { a: 2, c: 1 } },
    });
    expect(Object.keys(p.review)).toEqual(['ej:a']);
    expect(p.days['2026-11-24'].a).toBe(2);
    expect(p.tags).toEqual({});
  });
  it('旧形式のバックアップは語源英単語モードとして読む', () => {
    const old = JSON.stringify({ app: 'etymology-quiz', version: 2, settings: { advanceSec: 7 }, progress: { items: { 'ej:x': { box: 1, due: 1, seen: 1, correct: 1, wrong: 0, last: 1, lastOk: true } }, days: {} } });
    const r = parseImport(old)!;
    expect(r.progress.etymology.items['ej:x'].box).toBe(1);
    expect(r.settings.modes.etymology.advanceSec).toBe(7);
  });
  it('新しい形式のバックアップは全モードを往復できる', () => {
    const s = normalizeSettings({ activeMode: 'sound', modes: {} });
    const json = exportData(s, { etymology: emptyProgress(), sound: { ...emptyProgress(), tags: { link: { seen: 3, correct: 1 } } } });
    const r = parseImport(json)!;
    expect(r.progress.sound.tags.link).toEqual({ seen: 3, correct: 1 });
    expect(r.settings.activeMode).toBe('sound');
  });
});

describe('buildSession（復習モード）', () => {
  // 最小のモード（キー = base）
  const q = (key: string): Question => ({ modeId: 'd', key, base: key, group: key, pattern: 'm', patternLabel: '', choices: [], answer: 0, data: null });
  const mode = { id: 'd', candidates: () => [], question: (k: string) => (k === 'gone' ? null : q(k)) } as unknown as QuizMode;
  const entry = (key: string) => ({ key, added: 0, misses: 1, streak: 0, last: 0 });
  it('復習リストの問題だけを、指定数まで出す（消えたデータは飛ばす）', () => {
    const review = { a: entry('a'), b: entry('b'), gone: entry('gone'), c: entry('c') };
    const qs = buildSession({ mode, modeSettings: {}, kind: 'review', count: 2, items: {}, review, today: 0, rng: createRng(1) });
    expect(qs).toHaveLength(2);
    expect(qs.every((x) => ['a', 'b', 'c'].includes(x.key))).toBe(true);
    const all = buildSession({ mode, modeSettings: {}, kind: 'review', count: 10, items: {}, review, today: 0, rng: createRng(1) });
    expect(all.map((x) => x.key).sort()).toEqual(['a', 'b', 'c']);
  });
  it('モードが pick を持つときは、出題の選び方をモードに任せる', () => {
    const picked = { ...mode, candidates: () => [{ key: 'a', base: 'a', group: 'a', newOrder: 0 }, { key: 'b', base: 'b', group: 'b', newOrder: 1 }], pick: () => [{ key: 'b', base: 'b', group: 'b', newOrder: 1 }] } as unknown as QuizMode;
    const qs = buildSession({ mode: picked, modeSettings: {}, kind: 'normal', count: 5, items: {}, review: {}, today: 0, rng: createRng(1) });
    expect(qs.map((x) => x.key)).toEqual(['b']);
  });
});

import { resolveTiming } from '../src/core/storage.ts';
describe('秒数（正解・不正解で別）', () => {
  const d = { advanceOkSec: 4, advanceNgSec: 7, answerSec: 8 };
  it('未設定ならモードの初期値', () => {
    expect(resolveTiming(undefined, d)).toEqual(d);
  });
  it('旧形式の advanceSec は正解・不正解の両方に引き継ぐ', () => {
    expect(resolveTiming({ advanceSec: 5 }, d)).toEqual({ advanceOkSec: 5, advanceNgSec: 5, answerSec: 8 });
  });
  it('新しい値があればそちらを使い、範囲外は丸める', () => {
    expect(resolveTiming({ advanceSec: 5, advanceOkSec: 3, advanceNgSec: 99, answerSec: 1 }, d)).toEqual({ advanceOkSec: 3, advanceNgSec: 15, answerSec: 5 });
  });
});
