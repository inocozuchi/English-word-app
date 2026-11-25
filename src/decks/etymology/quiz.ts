// 1セッション分の問題を組み立てる。
import type { Format, Word, Root, Phrase } from './types.ts';
import type { Index } from './dataset.ts';
import type { Candidate, ItemState } from '../../core/srs.ts';
import { selectItems } from '../../core/srs.ts';
import { pickDistractors } from '../../core/distractors.ts';
import type { Rng } from '../../core/rng.ts';
import { shuffle } from '../../core/rng.ts';
import type { Question as CoreQuestion } from '../../core/deck.ts';

export const DECK_ID = 'etymology';

export type Subject =
  | { kind: 'word'; word: Word }
  | { kind: 'root'; root: Root }
  | { kind: 'phrase'; phrase: Phrase };

/** 語源デッキの問題。data に出題対象（単語・語源・熟語）が入る */
export type Question = CoreQuestion<Subject>;

function make(format: Format, key: string, base: string, group: string, subject: Subject, choices: Question['choices'], answer: number): Question {
  return { deck: DECK_ID, key, base, group, mode: format, modeLabel: FORMAT_LABEL[format], data: subject, choices, answer };
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
  return make(
    format,
    `${format}:${w.w}`,
    'w:' + w.w,
    w.roots[0],
    { kind: 'word', word: w },
    opts.map((x) => (format === 'ej' ? { text: firstText(x), tag: x.defs[0]?.pos } : { text: x.w, latin: true })),
    opts.indexOf(w),
  );
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
  return make('rm', 'rm:' + r.id, 'r:' + r.id, r.id, { kind: 'root', root: r }, opts.map((x) => ({ text: x.meaning })), opts.indexOf(r));
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
  return make('ph', 'ph:' + p.en, 'p:' + p.en, p.root, { kind: 'phrase', phrase: p }, opts.map((x) => ({ text: x.ja })), opts.indexOf(p));
}

const phraseByEn = new WeakMap<Index, Map<string, Phrase>>();

export function phraseOf(ix: Index, en: string): Phrase | undefined {
  let m = phraseByEn.get(ix);
  if (!m) phraseByEn.set(ix, (m = new Map(ix.ds.phrases.map((p) => [p.en, p]))));
  return m.get(en);
}

/** 保存キー → 出題対象 */
export function subjectOf(ix: Index, key: string): Subject | null {
  const i = key.indexOf(':');
  const f = key.slice(0, i);
  const id = key.slice(i + 1);
  if (f === 'ej' || f === 'je') {
    const w = ix.word.get(id);
    return w ? { kind: 'word', word: w } : null;
  }
  if (f === 'rm') {
    const r = ix.root.get(id);
    return r ? { kind: 'root', root: r } : null;
  }
  if (f === 'ph') {
    const p = phraseOf(ix, id);
    return p ? { kind: 'phrase', phrase: p } : null;
  }
  return null;
}

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
    const p = phraseOf(ix, id);
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
