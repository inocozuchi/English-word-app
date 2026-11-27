import { describe, it, expect } from 'vitest';
import { mergeProgress, mergeSettings, mergeKey } from '../src/sync/merge.ts';
import { syncOnce, hashText, type Remote, type Local, type Meta, type MetaEntry } from '../src/sync/engine.ts';
import { emptyProgress, type Progress } from '../src/core/storage.ts';

const st = (last: number, seen = 1, box = 1) => ({ box, due: 0, seen, correct: seen, wrong: 0, last, lastOk: true });
const prog = (p: Partial<Progress>): Progress => ({ ...emptyProgress(), ...p });

describe('同期: まとめ方', () => {
  it('学習記録は問題ごとに最後に答えた方・日ごとは多い方', () => {
    const a = prog({ items: { x: st(100, 3, 3), y: st(50) }, days: { '2026-11-27': { a: 10, c: 8 } } });
    const b = prog({ items: { x: st(200, 1, 0), z: st(70) }, days: { '2026-11-27': { a: 4, c: 4 }, '2026-11-26': { a: 2, c: 1 } } });
    const m = mergeProgress(a, b, true);
    expect(m.items.x.last).toBe(200);
    expect(Object.keys(m.items).sort()).toEqual(['x', 'y', 'z']);
    expect(m.days['2026-11-27'].a).toBe(10);
    expect(m.days['2026-11-26'].a).toBe(2);
    // どちらから見ても同じ
    expect(mergeProgress(b, a, false)).toEqual(m);
  });
  it('復習リスト: 片方で外れた（その後に答えた）ものは戻さない', () => {
    const entry = (last: number) => ({ key: 'x', added: 1, misses: 1, streak: 0, last });
    const a = prog({ items: { x: st(100) }, review: { x: entry(100) } }); // まちがえてリストに入った
    const b = prog({ items: { x: st(300) }, review: {} }); // ほかの端末で正解を続けて外れた
    expect(mergeProgress(a, b, false).review.x).toBeUndefined();
    const c = prog({ items: { y: st(50) }, review: {} });
    expect(mergeProgress(a, c, true).review.x).toBeTruthy(); // 知らない端末とは合わせて残す
  });
  it('モード固有の記録は中まで合わせる', () => {
    const a = prog({ extra: { rec: { s1: 1 }, cd: { day: 3 } } });
    const b = prog({ extra: { rec: { s2: 1 }, cd: { day: 5 } } });
    expect(mergeProgress(a, b, false).extra).toEqual({ rec: { s1: 1, s2: 1 }, cd: { day: 5 } });
  });
  it('設定: 新しい方。ただし音声・文字入力・自己採点・テーマはこの端末のまま', () => {
    const local = { count: 10, audio: false, typing: 'skip', selfGrade: false, theme: 'dark', activeMode: 'custom', modes: { etymology: { formats: ['ej'] } } };
    const remote = { count: 20, audio: true, typing: 'on', selfGrade: true, theme: 'light', activeMode: 'etymology', modes: { sound: { level: 2 } } };
    const m = mergeSettings(local, remote, false);
    expect(m.count).toBe(20);
    expect(m.activeMode).toBe('etymology');
    expect([m.audio, m.typing, m.selfGrade, m.theme]).toEqual([false, 'skip', false, 'dark']);
    expect(m.modes).toEqual({ etymology: { formats: ['ej'] }, sound: { level: 2 } });
  });
  it('自由英単語: 両方の単語を合わせ、消した単語は戻さない', () => {
    const w = (id: string, ja = id) => ({ id, en: id, ja, added: 1 });
    const local = { modes: { custom: { words: [w('a'), w('b', 'B2')], patterns: ['ej'] } } };
    const remote = { modes: { custom: { words: [w('b'), w('c')], gone: { a: 5 }, patterns: ['ej', 'je'] } } };
    const m = mergeSettings(local, remote, true);
    expect(m.modes.custom.words.map((x: any) => x.id).sort()).toEqual(['b', 'c']);
    expect(m.modes.custom.words.find((x: any) => x.id === 'b').ja).toBe('B2');
    expect(m.modes.custom.patterns).toEqual(['ej']);
  });
  it('報告は合わせ、セッションは新しい方、消したものは新しい方が消していれば消す', () => {
    expect(mergeKey('eq.reports.x.v1', [{ key: 'a' }], [{ key: 'a' }, { key: 'b' }], true)).toEqual([{ key: 'a' }, { key: 'b' }]);
    expect(mergeKey('eq.comp.session.v1', { d: 1 }, { d: 2 }, true)).toEqual({ d: 1 });
    expect(mergeKey('eq.comp.session.v1', null, { d: 2 }, true)).toBeNull();
    expect(mergeKey('eq.comp.session.v1', null, { d: 2 }, false)).toEqual({ d: 2 });
    expect(mergeKey('eq.progress.x.v1', null, prog({}), true)).toEqual(prog({}));
  });
});

// ---- メモリの置き場と端末 ----
function memRemote() {
  let meta: Meta | null = null;
  const blobs = new Map<string, string>();
  let reads = 0;
  const r: Remote & { reads: () => number; meta: () => Meta | null; race?: () => void } = {
    async getMeta() {
      reads++;
      return meta && structuredClone(meta);
    },
    async getBlob(key: string, e: MetaEntry) {
      reads++;
      return blobs.get(key + e.h)!;
    },
    async putBlob(key: string, h: string, text: string) {
      blobs.set(key + h, text);
      return 1;
    },
    async commitMeta(v: number, m: Meta) {
      r.race?.();
      r.race = undefined;
      if ((meta?.ver ?? 0) !== v) return false;
      meta = structuredClone(m);
      return true;
    },
    reads: () => reads,
    meta: () => meta,
  };
  return r;
}
function memLocal(init: Record<string, unknown> = {}, t0 = 1000) {
  const data = new Map<string, string>(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  const at = new Map<string, number>([...data.keys()].map((k) => [k, t0]));
  const l: Local & { val: (k: string) => any; write: (k: string, v: unknown, t: number) => void } = {
    keys: () => [...data.keys()],
    get: (k) => data.get(k) ?? null,
    set: (k, text, t) => {
      data.set(k, text);
      at.set(k, t);
    },
    at: (k) => at.get(k) ?? 0,
    val: (k) => JSON.parse(data.get(k) ?? 'null'),
    write: (k, v, t) => {
      data.set(k, JSON.stringify(v));
      at.set(k, t);
    },
  };
  return l;
}

describe('同期: 手順', () => {
  const P = 'eq.progress.etymology.v1';
  it('2台で別々に学習してもどちらの記録も残り、2回目以降は何も書かない', async () => {
    const remote = memRemote();
    const a = memLocal({ [P]: prog({ items: { x: st(100) } }) });
    const b = memLocal({ [P]: prog({ items: { y: st(200) } }) });
    expect((await syncOnce(remote, a, 5000)).pushed).toEqual([P]);
    const rb = await syncOnce(remote, b, 6000);
    expect(rb.pulled).toEqual([P]);
    expect(Object.keys(b.val(P).items).sort()).toEqual(['x', 'y']);
    const ra = await syncOnce(remote, a, 7000);
    expect(Object.keys(a.val(P).items).sort()).toEqual(['x', 'y']);
    expect(ra.pushed).toEqual([]);
    expect(hashText(a.get(P)!)).toBe(hashText(b.get(P)!));
    const again = await syncOnce(remote, b, 8000);
    expect(again).toEqual({ pulled: [], pushed: [] });
  });
  it('ほかの端末と同時に書いたら読み直してやり直す', async () => {
    const remote = memRemote();
    const a = memLocal({ [P]: prog({ items: { x: st(100) } }) });
    const b = memLocal({ [P]: prog({ items: { y: st(200) } }) });
    remote.race = () => void syncOnce(remote, b, 5500); // a が目次を書く直前に b が書く
    await syncOnce(remote, a, 5000);
    await new Promise((r) => setTimeout(r, 0));
    await syncOnce(remote, a, 6000);
    await syncOnce(remote, b, 7000);
    expect(Object.keys(a.val(P).items).sort()).toEqual(['x', 'y']);
    expect(Object.keys(b.val(P).items).sort()).toEqual(['x', 'y']);
  });
  it('この端末で消したセッションは、置き場からも消える', async () => {
    const S = 'eq.comp.session.v1';
    const remote = memRemote();
    const a = memLocal({ [S]: { d: 1 } });
    await syncOnce(remote, a, 5000);
    a.write(S, null, 9000);
    await syncOnce(remote, a, 9100);
    const b = memLocal({});
    await syncOnce(remote, b, 9200);
    expect(b.val(S)).toBeNull();
  });
});

describe('同期コード', async () => {
  const { newCode, normalizeCode, isValidCode, formatCode, parseConfig } = await import('../src/sync/sync.svelte.ts');
  it('20文字で、空白・ハイフン・小文字を入れてもよい', () => {
    const c = newCode();
    expect(isValidCode(c)).toBe(true);
    expect(normalizeCode(formatCode(c).toLowerCase().replace(/-/g, ' '))).toBe(c);
    expect(isValidCode('ABC')).toBe(false);
  });
  it('Firebase コンソールの firebaseConfig を読める', () => {
    expect(parseConfig('const firebaseConfig = {\n apiKey: "k1",\n authDomain: "p.firebaseapp.com",\n projectId: "p",\n appId: "1:2:web:3"\n};')).toEqual({ apiKey: 'k1', authDomain: 'p.firebaseapp.com', projectId: 'p', appId: '1:2:web:3' });
    expect(parseConfig('hello')).toBeNull();
  });
});
