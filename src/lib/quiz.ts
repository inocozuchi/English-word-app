// 1セッション分の問題を組み立てる。
import type { Format, Word, Root, Phrase } from './types.ts';
import type { Index } from './dataset.ts';
import type { Candidate, ItemState } from './srs.ts';
import { selectItems } from './srs.ts';
import { pickDistractors } from './distractors.ts';
import type { Rng } from './rng.ts';
import { shuffle } from './rng.ts';

export interface Choice {
  text: string;
  /** 品詞などの小さな補足 */
  tag?: string;
  /** 欧文（英単語・熟語）として表示する */
  latin?: boolean;
}

export type Subject =
  | { kind: 'word'; word: Word }
  | { kind: 'root'; root: Root }
  | { kind: 'phrase'; phrase: Phrase };

export interface Question {
  key: string;
  base: string;
  format: Format;
  subject: Subject;
  choices: Choice[];
  answer: number;
}

export const FORMAT_LABEL: Record<Format, string> = {
  ej: '英 → 日',
  je: '日 → 英',
  rm: '語源の意味',
  ph: '熟語の意味',
};

export interface Scope {
  formats: Format[];
  /** 出題しない語源ID */
  excludedRoots: string[];
}

/** 出題範囲から候補を作る */
export function buildCandidates(ix: Index, scope: Scope): Candidate[] {
  const ex = new Set(scope.excludedRoots);
  const fm = new Set(scope.formats);
  const out: Candidate[] = [];
  const seenWord = new Set<number>();
  for (const r of ix.ds.roots) {
    if (ex.has(r.id)) continue;
    const base = r.order * 1000;
    if (fm.has('rm')) out.push({ key: 'rm:' + r.id, base: 'r:' + r.id, group: r.id, newOrder: base });
    r.words.forEach((id, i) => {
      if (seenWord.has(id)) return;
      seenWord.add(id);
      const w = ix.ds.words[id];
      // 共有語は主たる語源の順番で出す（主たる語源が範囲外ならこの語源の順番）
      const pr = ix.root.get(w.roots[0])!;
      const order = (ex.has(pr.id) ? base : pr.order * 1000) + 10 + i * 2;
      const group = w.roots[0];
      if (fm.has('ej')) out.push({ key: 'ej:' + w.w, base: 'w:' + w.w, group, newOrder: order });
      if (fm.has('je'))
        out.push({
          key: 'je:' + w.w,
          base: 'w:' + w.w,
          group,
          newOrder: order + 1,
          requires: fm.has('ej') ? 'ej:' + w.w : undefined,
        });
    });
    if (fm.has('ph'))
      r.phrases.forEach((id, i) => {
        const p = ix.ds.phrases[id];
        out.push({ key: 'ph:' + p.en, base: 'p:' + p.en, group: r.id, newOrder: base + 600 + i });
      });
  }
  return out;
}

function chaptersOf(ix: Index, w: Word): number[] {
  return [...new Set(w.roots.map((id) => ix.root.get(id)!.chapter))];
}

function wordQuestion(ix: Index, w: Word, format: 'ej' | 'je', rng: Rng): Question {
  const sameRoot = new Set<Word>();
  for (const rid of w.roots) for (const id of ix.root.get(rid)!.words) sameRoot.add(ix.ds.words[id]);
  const sameChapter = chaptersOf(ix, w).flatMap((c) => ix.wordsByChapter.get(c)!);
  const pos = w.defs[0]?.pos;
  const firstText = (x: Word) => x.defs[0]?.ja ?? '';
  const ds = pickDistractors(w, ix.wordTokens.get(w.id)!, [[...sameRoot], sameChapter, ix.ds.words], {
    // まちがいの選択肢の「全ての意味」が正解と重ならないこと（2つ正解がある状態を防ぐ）
    tokens: (x) => (format === 'ej' ? ix.wordFirstTokens.get(x.id)! : ix.wordTokens.get(x.id)!),
    text: format === 'ej' ? firstText : (x) => x.w,
    prefer: (x) => x.defs[0]?.pos === pos,
    maxPerTier: [2, 3, 3],
    rng,
  });
  const opts = shuffle([w, ...ds], rng);
  return {
    key: `${format}:${w.w}`,
    base: 'w:' + w.w,
    format,
    subject: { kind: 'word', word: w },
    choices: opts.map((x) =>
      format === 'ej' ? { text: firstText(x), tag: x.defs[0]?.pos } : { text: x.w, latin: true },
    ),
    answer: opts.indexOf(w),
  };
}

function rootQuestion(ix: Index, r: Root, rng: Rng): Question {
  const ds = pickDistractors(r, ix.rootTokens.get(r.id)!, [ix.rootsByChapter.get(r.chapter)!, ix.ds.roots], {
    tokens: (x) => ix.rootTokens.get(x.id)!,
    text: (x) => x.meaning,
    prefer: (x) => x.category === r.category,
    maxPerTier: [3, 3],
    rng,
  });
  const opts = shuffle([r, ...ds], rng);
  return {
    key: 'rm:' + r.id,
    base: 'r:' + r.id,
    format: 'rm',
    subject: { kind: 'root', root: r },
    choices: opts.map((x) => ({ text: x.meaning })),
    answer: opts.indexOf(r),
  };
}

function phraseQuestion(ix: Index, p: Phrase, rng: Rng): Question {
  const r = ix.root.get(p.root)!;
  const sameRoot = r.phrases.map((id) => ix.ds.phrases[id]);
  const ds = pickDistractors(p, ix.phraseTokens.get(p.id)!, [sameRoot, ix.phrasesByChapter.get(r.chapter)!, ix.ds.phrases], {
    tokens: (x) => ix.phraseTokens.get(x.id)!,
    text: (x) => x.ja,
    maxPerTier: [2, 3, 3],
    rng,
  });
  const opts = shuffle([p, ...ds], rng);
  return {
    key: 'ph:' + p.en,
    base: 'p:' + p.en,
    format: 'ph',
    subject: { kind: 'phrase', phrase: p },
    choices: opts.map((x) => ({ text: x.ja })),
    answer: opts.indexOf(p),
  };
}

const phraseByEn = new WeakMap<Index, Map<string, Phrase>>();

export function questionFor(ix: Index, key: string, rng: Rng): Question | null {
  const i = key.indexOf(':');
  const f = key.slice(0, i) as Format;
  const id = key.slice(i + 1);
  if (f === 'ej' || f === 'je') {
    const w = ix.word.get(id);
    return w ? wordQuestion(ix, w, f, rng) : null;
  }
  if (f === 'rm') {
    const r = ix.root.get(id);
    return r ? rootQuestion(ix, r, rng) : null;
  }
  if (f === 'ph') {
    let m = phraseByEn.get(ix);
    if (!m) phraseByEn.set(ix, (m = new Map(ix.ds.phrases.map((p) => [p.en, p]))));
    const p = m.get(id);
    return p ? phraseQuestion(ix, p, rng) : null;
  }
  return null;
}

export interface SessionInput {
  scope: Scope;
  count: number;
  items: Record<string, ItemState>;
  today: number;
  rng: Rng;
  lastBase?: string | null;
}

export function buildSession(ix: Index, input: SessionInput): Question[] {
  const cands = buildCandidates(ix, input.scope);
  const picked = selectItems(cands, input.items, {
    count: input.count,
    today: input.today,
    rng: input.rng,
    avoidFirst: input.lastBase,
  });
  return picked.map((c) => questionFor(ix, c.key, input.rng)).filter((q): q is Question => !!q);
}
