import { describe, it, expect } from 'vitest';
import data from '../src/generated/words.json';
import type { Dataset } from '../src/modes/etymology/types.ts';
import { buildIndex } from '../src/modes/etymology/dataset.ts';
import { questionFor, buildSession, buildCandidates } from '../src/modes/etymology/quiz.ts';
import { meaningTokens, overlaps, pickDistractors } from '../src/core/distractors.ts';
import { createRng } from '../src/core/rng.ts';
import { review } from '../src/core/srs.ts';

const ix = buildIndex(data as Dataset);

describe('meaningTokens / overlaps', () => {
  it('（）や〜を除いて語句に分ける', () => {
    expect(meaningTokens('治療する、（悪い癖などを）直す')).toEqual(['治療する', '直す']);
    expect(meaningTokens('〜に関わっている、〜に巻き込まれている')).toEqual(['に関わっている', 'に巻き込まれている']);
    expect(meaningTokens('行く・譲る')).toEqual(['行く', '譲る']);
  });
  it('部分一致も重なりとみなす', () => {
    expect(overlaps(['治療'], ['治療する'])).toBe(true);
    expect(overlaps(['行く'], ['譲る'])).toBe(false);
  });
});

describe('pickDistractors', () => {
  it('前の段（紛らわしい候補）を優先し、正解と重なる候補を除く', () => {
    type T = { t: string };
    const c = { t: '走る' };
    const tier1 = [{ t: '走る' }, { t: '歩く' }, { t: '速く走る' }];
    const tier2 = [{ t: '泳ぐ' }, { t: '飛ぶ' }, { t: '投げる' }];
    const r = pickDistractors<T>(c, ['走る'], [tier1, tier2], {
      tokens: (x) => [x.t], text: (x) => x.t, rng: createRng(1), maxPerTier: [3, 3],
    });
    expect(r).toHaveLength(3);
    expect(r[0].t).toBe('歩く');
    expect(r.map((x) => x.t)).not.toContain('走る');
  });
});

describe('questionFor（実データ全件）', () => {
  const check = (key: string, seed: number) => {
    const q = questionFor(ix, key, createRng(seed));
    expect(q, key).not.toBeNull();
    expect(q!.choices, key).toHaveLength(4);
    expect(new Set(q!.choices.map((c) => c.text)).size, key).toBe(4);
    expect(q!.answer).toBeGreaterThanOrEqual(0);
    return q!;
  };
  it('すべての単語で 英→日・日→英 の4択が作れる', () => {
    for (const w of ix.ds.words) {
      const q = check('ej:' + w.w, w.id);
      expect(q.choices[q.answer].text).toBe(w.defs[0].ja);
      // まちがいの選択肢が正解の意味と重ならない
      const correct = ix.wordTokens.get(w.id)!;
      q.choices.forEach((c, i) => {
        if (i !== q.answer) expect(overlaps(meaningTokens(c.text), correct), `${w.w}: ${c.text}`).toBe(false);
      });
      const q2 = check('je:' + w.w, w.id);
      expect(q2.choices[q2.answer].text).toBe(w.w);
    }
  });
  it('すべての語源で 語源→意味 の4択が作れる', () => {
    for (const r of ix.ds.roots) check('rm:' + r.id, r.order);
  });
  it('すべての熟語で 熟語→意味 の4択が作れる', () => {
    for (const p of ix.ds.phrases) check('ph:' + p.en, p.id);
  });
  it('選択肢は同じ語源・同じ章から優先して選ぶ', () => {
    const w = ix.word.get('involve')!;
    const q = questionFor(ix, 'ej:involve', createRng(3))!;
    const chapterWords = new Set(ix.wordsByChapter.get(ix.root.get(w.roots[0])!.chapter)!.map((x) => x.defs[0].ja));
    const fromChapter = q.choices.filter((c) => chapterWords.has(c.text)).length;
    expect(fromChapter).toBe(4);
  });
});

describe('buildSession', () => {
  const scope = { formats: ['ej', 'je', 'rm', 'ph'] as const, excludedRoots: [] };
  it('指定した問題数で、重複なし', () => {
    const qs = buildSession(ix, { scope: { ...scope, formats: [...scope.formats] }, count: 10, items: {}, today: 100, rng: createRng(1) });
    expect(qs).toHaveLength(10);
    expect(new Set(qs.map((q) => q.base)).size).toBe(10);
  });
  it('最初は最初の章から出題する（未習は学習順）', () => {
    const qs = buildSession(ix, { scope: { formats: ['ej'], excludedRoots: [] }, count: 10, items: {}, today: 100, rng: createRng(1) });
    const ch1 = new Set(ix.wordsByChapter.get(ix.ds.chapters[0].no)!.map((w) => w.w));
    for (const q of qs) expect(ch1.has((q.data as any).word.w)).toBe(true);
  });
  it('出題範囲外の語源は出さない', () => {
    const keep = ix.ds.roots[5].id;
    const excluded = ix.ds.roots.filter((r) => r.id !== keep).map((r) => r.id);
    const cands = buildCandidates(ix, { formats: ['ej', 'rm'], excludedRoots: excluded });
    const r = ix.root.get(keep)!;
    expect(cands).toHaveLength(r.words.length + 1);
  });
  it('まちがえた語を次のセッションで優先する', () => {
    let items = {};
    const first = buildSession(ix, { scope: { formats: ['ej'], excludedRoots: [] }, count: 10, items, today: 100, rng: createRng(1) });
    for (const [i, q] of first.entries()) items = { ...items, [q.key]: review(undefined, i >= 3, 0, 100) };
    const wrong = new Set(first.slice(0, 3).map((q) => q.key));
    const second = buildSession(ix, { scope: { formats: ['ej'], excludedRoots: [] }, count: 10, items, today: 100, rng: createRng(2), lastBase: first[9].base });
    const keys = new Set(second.map((q) => q.key));
    for (const k of wrong) expect(keys.has(k)).toBe(true);
    // 正解した語は翌日まで出ない
    for (const q of first.slice(3)) expect(keys.has(q.key)).toBe(false);
    expect(second[0].base).not.toBe(first[9].base);
  });
});
