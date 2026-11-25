import { describe, it, expect } from 'vitest';
import data from '../src/generated/chunks.json';
import type { ChunkData, Entry } from '../src/modes/chunks/types.ts';
import {
  buildChunkIndex,
  chunkQuestion,
  chunkCandidates,
  chunkPick,
  normalizeChunkSettings,
  unlockedPriorities,
  eligible,
  fillOf,
  allocate,
} from '../src/modes/chunks/quiz.ts';
import type { ChunkQuestion } from '../src/modes/chunks/quiz.ts';
import { createRng } from '../src/core/rng.ts';
import type { ItemState } from '../src/core/srs.ts';

const ix = buildChunkIndex(data as unknown as ChunkData);
const all = normalizeChunkSettings(undefined);
const E = ix.d.entries;

/** 4択の基本: 4つ・同じ文字列なし・正解が含まれる */
function check(q: ChunkQuestion | null, key: string) {
  expect(q, key).not.toBeNull();
  expect(q!.choices, key).toHaveLength(4);
  expect(new Set(q!.choices.map((c) => c.text)).size, key).toBe(4);
  expect(q!.answer, key).toBeGreaterThanOrEqual(0);
  expect(q!.answer, key).toBeLessThan(4);
  return q!;
}
/** 意味が重なる表現（どちら側に書かれていても） */
const overlapNums = (e: Entry) => new Set([...e.sameMeaning, ...e.similarMeaning, ...E.filter((x) => x.sameMeaning.includes(e.num) || x.similarMeaning.includes(e.num)).map((x) => x.num)]);

describe('①〜④ の問題生成（実データ全件・シードを変えて3回）', () => {
  for (const seed of [1, 2, 3]) {
    it(`① 英→和: 正解は meaning、誤答に意味の重なる表現なし（seed ${seed}）`, () => {
      for (const e of E) {
        const q = check(chunkQuestion(ix, `c1:${e.id}`, createRng(seed)), e.id);
        expect(q.pattern).toBe('c1');
        expect(q.choices[q.answer].text).toBe(e.meaning);
        const bad = overlapNums(e);
        for (const [k, c] of q.choices.entries()) {
          if (k === q.answer) continue;
          const src = E.filter((x) => x.meaning === c.text);
          // 誤答の文字列が、意味の重なる表現の意味と一致しない
          expect(src.some((x) => bad.has(x.num)), `${e.id}: ${c.text}`).toBe(false);
        }
      }
    });
    it(`② 和→英: 正解は bare、ambiguous は出さない（seed ${seed}）`, () => {
      for (const e of E) {
        const q = chunkQuestion(ix, `c2:${e.id}`, createRng(seed));
        if (e.ambiguous) {
          expect(q?.pattern, e.id).not.toBe('c2'); // ② は作らず、ほかのパターンで出す
          continue;
        }
        check(q, e.id);
        expect(q!.pattern).toBe('c2');
        expect(q!.choices[q!.answer].text).toBe(e.bare);
        const bad = overlapNums(e);
        for (const [k, c] of q!.choices.entries()) if (k !== q!.answer) expect(E.some((x) => x.bare === c.text && bad.has(x.num)), `${e.id}: ${c.text}`).toBe(false);
      }
    });
    it(`③ 穴埋め: blank が null なら出さない・正解は穴に入る形（seed ${seed}）`, () => {
      for (const e of E) {
        const q = chunkQuestion(ix, `c3:${e.id}`, createRng(seed));
        if (!e.blank) {
          expect(q?.pattern, e.id).not.toBe('c3');
          continue;
        }
        check(q, e.id);
        expect(q!.pattern).toBe('c3');
        expect(q!.choices[q!.answer].text.toLowerCase()).toBe(e.blank.answer.toLowerCase());
        const bad = overlapNums(e);
        for (const [k, c] of q!.choices.entries()) if (k !== q!.answer) expect(E.some((x) => fillOf(x).toLowerCase() === c.text.toLowerCase() && bad.has(x.num) && x.num !== e.num), `${e.id}: ${c.text}`).toBe(false);
      }
    });
    it(`④ 使い分け: 正解と組の相手を含む（seed ${seed}）`, () => {
      for (const p of ix.d.pairs)
        for (const side of ['a', 'b'] as const) {
          const q = check(chunkQuestion(ix, `${p.id}#${side}`, createRng(seed)), p.id + side);
          expect(q.choices[q.answer].text).toBe(p[side].en);
          expect(q.choices.map((c) => c.text)).toContain(p[side === 'a' ? 'b' : 'a'].en);
        }
    });
  }
  it('復習リストの形（パターン未指定）でも、使えるパターンで問題になる', () => {
    for (const e of E) {
      const q = check(chunkQuestion(ix, e.id, createRng(5)), e.id);
      expect(q.key).toBe(e.id);
      if (q.pattern === 'c2') expect(e.ambiguous).toBe(false);
      if (q.pattern === 'c3') expect(e.blank).not.toBeNull();
    }
  });
  it('③ は穴の位置に合わせて先頭の大文字・小文字をそろえる', () => {
    const e = E.find((x) => x.blank && x.blank.text.startsWith('＿＿＿＿'))!;
    const q = chunkQuestion(ix, `c3:${e.id}`, createRng(1))!;
    for (const c of q.choices) expect(c.text[0], c.text).toBe(c.text[0].toUpperCase());
  });
  it('③ は頭の単語と語数が同じ候補（文に入れても成り立ちやすいもの）を後回しにする', () => {
    const e = ix.byId.get('ch-001')!; // How often → How long / How far などを避ける
    const q = chunkQuestion(ix, `c3:${e.id}`, createRng(1))!;
    const wrong = q.choices.filter((_, k) => k !== q.answer).map((c) => c.text.toLowerCase().split(' '));
    for (const w of wrong) expect(w[0] === 'how' && w.length === 2, w.join(' ')).toBe(false);
  });
  it('記録のキーは表現の id（パターンに関係なく同じ）', () => {
    expect(chunkQuestion(ix, 'c1:ch-001', createRng(1))!.key).toBe('ch-001');
    expect(chunkQuestion(ix, 'c3:ch-001', createRng(1))!.key).toBe('ch-001');
    expect(chunkQuestion(ix, 'c4:pr-01#a', createRng(1))!.key).toBe('pr-01#a');
  });
});

describe('出題範囲と段階的な解放', () => {
  const mastered = (p: string, rate: number): Record<string, ItemState> => {
    const items: Record<string, ItemState> = {};
    const list = E.filter((e) => e.priority === p);
    list.slice(0, Math.ceil(list.length * rate)).forEach((e) => (items[e.id] = { box: 3, due: 99999, seen: 3, correct: 3, wrong: 0, last: 1, lastOk: true }));
    return items;
  };
  it('最初は A だけ。A の7割を習得すると B、B の7割で C', () => {
    expect(unlockedPriorities(ix, {}, all)).toEqual(['A']);
    expect(unlockedPriorities(ix, mastered('A', 0.69), all)).toEqual(['A']);
    const a = mastered('A', 0.7);
    expect(unlockedPriorities(ix, a, all)).toEqual(['A', 'B']);
    expect(unlockedPriorities(ix, { ...a, ...mastered('B', 0.7) }, all)).toEqual(['A', 'B', 'C']);
  });
  it('自動で解放しない設定では、選んだ優先度だけ', () => {
    expect(unlockedPriorities(ix, {}, { ...all, autoUnlock: false, priorities: ['B', 'C'] })).toEqual(['B', 'C']);
  });
  it('pick は解放されていない優先度を出さない', () => {
    const cands = chunkCandidates(ix, all);
    const p = chunkPick(ix, { cands, items: {}, tags: {}, answered: 0, count: 10, today: 100, rng: createRng(1) }, all);
    for (const c of p) {
      const id = c.key.replace(/^c[1-4]:/, '');
      if (!id.includes('#')) expect(ix.byId.get(id)!.priority).toBe('A');
    }
  });
  it('章と「NZ・英の表現を含める」で絞れる', () => {
    const cs = chunkCandidates(ix, { ...all, sections: [19], regional: false });
    for (const c of cs) {
      if (c.key.includes('#')) continue;
      const e = ix.byId.get(c.key)!;
      expect(e.section).toBe(19);
      expect(e.region.includes('nz') || e.region.includes('uk')).toBe(false);
    }
    expect(chunkCandidates(ix, { ...all, sections: [19] }).length).toBeGreaterThan(cs.length);
  });
  it('穴埋めだけにすると blank が null の表現は候補にならない', () => {
    for (const c of chunkCandidates(ix, { ...all, patterns: ['c3'] })) expect(ix.byId.get(c.key)!.blank).not.toBeNull();
  });
  it('eligible: ambiguous は ② なし、blank null は ③ なし', () => {
    for (const e of E) {
      const el = eligible(e, ['c1', 'c2', 'c3', 'c4']);
      expect(el.includes('c2')).toBe(!e.ambiguous);
      expect(el.includes('c3')).toBe(!!e.blank);
    }
  });
});

describe('出題の選び方', () => {
  const cands = chunkCandidates(ix, all);
  const seen = (ids: string[], lastOk = true, due = 50): Record<string, ItemState> =>
    Object.fromEntries(ids.map((id) => [id, { box: lastOk ? 1 : 0, due, seen: 1, correct: lastOk ? 1 : 0, wrong: lastOk ? 0 : 1, last: 1, lastOk }]));
  const pick = (items: Record<string, ItemState>, seed = 1) => chunkPick(ix, { cands, items, tags: {}, answered: 0, count: 10, today: 100, rng: createRng(seed) }, all);
  const entryIds = (p: ReturnType<typeof pick>) => p.filter((c) => !c.key.includes('#')).map((c) => c.key.replace(/^c[1-4]:/, ''));

  it('同じ表現・同じ組は1回だけで、10問そろう', () => {
    for (const seed of [1, 2, 3]) {
      const p = pick({}, seed);
      expect(p).toHaveLength(10);
      expect(new Set(p.map((c) => c.base)).size).toBe(10);
    }
  });
  it('復習するものが十分あれば、新しい表現は最大5件（章の順）', () => {
    const A = E.filter((e) => e.priority === 'A');
    const items = seen(A.slice(100, 140).map((e) => e.id)); // 期限切れの既習 40件
    const p = pick(items);
    const fresh = entryIds(p).filter((id) => !items[id]);
    expect(fresh.length).toBeLessThanOrEqual(5);
    // 新しい表現は章の順（最初の A から）
    const order = A.map((e) => e.id);
    for (const id of fresh) expect(order.indexOf(id)).toBeLessThan(10);
  });
  it('まちがえた表現を先に出す', () => {
    const wrongIds = E.filter((e) => e.priority === 'A').slice(50, 53).map((e) => e.id);
    const p = pick({ ...seen(E.filter((e) => e.priority === 'A').slice(60, 100).map((e) => e.id)), ...seen(wrongIds, false) });
    for (const id of wrongIds) expect(entryIds(p)).toContain(id);
  });
  it('最初のセッション（復習するものがない）は新しい表現で10問を埋める', () => {
    expect(pick({})).toHaveLength(10);
  });
  it('①②③④ の比率は 25:25:35:15（10問なら 3:2:3:2 など合計10）', () => {
    const a = allocate(10, { c1: 25, c2: 25, c3: 35, c4: 15 });
    expect(Object.values(a).reduce((x, y) => x + y, 0)).toBe(10);
    expect(a.c3).toBeGreaterThanOrEqual(3);
    expect(a.c4).toBeGreaterThanOrEqual(1);
    const p = pick({});
    const by = (pp: string) => p.filter((c) => c.key.startsWith(pp + ':')).length;
    expect(by('c3')).toBeGreaterThanOrEqual(3);
    expect(by('c4')).toBeGreaterThanOrEqual(1);
  });
  it('割り当てたパターンはその表現で使えるもの', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const items = seen(E.filter((e) => e.priority === 'A').map((e) => e.id).slice(0, 200));
      for (const c of pick(items, seed)) {
        const m = c.key.match(/^(c[1-3]):(.+)$/);
        if (!m) continue;
        expect(eligible(ix.byId.get(m[2])!, all.patterns)).toContain(m[1]);
        check(chunkQuestion(ix, c.key, createRng(seed)), c.key);
      }
    }
  });
});
