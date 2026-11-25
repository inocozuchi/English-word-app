import type { Dataset, Word, Root, Phrase } from './types.ts';
import { meaningTokens } from './distractors.ts';

/** 出題や検索で使う索引 */
export interface Index {
  ds: Dataset;
  root: Map<string, Root>;
  word: Map<string, Word>;
  /** 単語のすべての意味の語句 */
  wordTokens: Map<number, string[]>;
  /** 単語の最初の意味の語句 */
  wordFirstTokens: Map<number, string[]>;
  rootTokens: Map<string, string[]>;
  phraseTokens: Map<number, string[]>;
  wordsByChapter: Map<number, Word[]>;
  phrasesByChapter: Map<number, Phrase[]>;
  rootsByChapter: Map<number, Root[]>;
}

export function buildIndex(ds: Dataset): Index {
  const root = new Map(ds.roots.map((r) => [r.id, r]));
  const word = new Map(ds.words.map((w) => [w.w, w]));
  const wordTokens = new Map(ds.words.map((w) => [w.id, w.defs.flatMap((d) => meaningTokens(d.ja))]));
  const wordFirstTokens = new Map(ds.words.map((w) => [w.id, meaningTokens(w.defs[0]?.ja ?? '')]));
  const rootTokens = new Map(ds.roots.map((r) => [r.id, meaningTokens(r.meaning)]));
  const phraseTokens = new Map(ds.phrases.map((p) => [p.id, meaningTokens(p.ja)]));
  const wordsByChapter = new Map<number, Word[]>();
  const phrasesByChapter = new Map<number, Phrase[]>();
  const rootsByChapter = new Map<number, Root[]>();
  for (const c of ds.chapters) {
    const rs = c.roots.map((id) => root.get(id)!);
    rootsByChapter.set(c.no, rs);
    const ws = new Set<Word>();
    for (const r of rs) for (const id of r.words) ws.add(ds.words[id]);
    wordsByChapter.set(c.no, [...ws]);
    phrasesByChapter.set(c.no, rs.flatMap((r) => r.phrases.map((id) => ds.phrases[id])));
  }
  return { ds, root, word, wordTokens, wordFirstTokens, rootTokens, phraseTokens, wordsByChapter, phrasesByChapter, rootsByChapter };
}

/** 単語の主たる語源 */
export function primaryRoot(ix: Index, w: Word): Root {
  return ix.root.get(w.roots[0])!;
}
