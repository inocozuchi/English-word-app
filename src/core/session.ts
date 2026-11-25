// 1セッション分の問題を組み立てる（デッキ共通）。
import type { Deck, Question } from './deck.ts';
import type { ItemState, Candidate } from './srs.ts';
import { selectItems, arrange } from './srs.ts';
import type { ReviewList } from './review.ts';
import { reviewOrder } from './review.ts';
import type { Rng } from './rng.ts';

export type SessionMode = 'normal' | 'review';

export interface SessionInput {
  deck: Deck;
  deckSettings: unknown;
  mode: SessionMode;
  count: number;
  items: Record<string, ItemState>;
  review: ReviewList;
  today: number;
  rng: Rng;
  lastBase?: string | null;
}

export function buildSession(i: SessionInput): Question[] {
  if (i.mode === 'review') return buildReview(i);
  const picked = selectItems(i.deck.candidates(i.deckSettings), i.items, {
    count: i.count,
    today: i.today,
    rng: i.rng,
    avoidFirst: i.lastBase,
  });
  return picked.map((c) => i.deck.question(c.key, i.rng)).filter((q): q is Question => !!q);
}

/** 復習モード: 復習リストの問題だけを出す（出題範囲・出題形式の設定には左右されない） */
function buildReview(i: SessionInput): Question[] {
  const qs: Question[] = [];
  const bases = new Set<string>();
  for (const e of reviewOrder(i.review, i.deck.id, i.rng)) {
    if (qs.length >= i.count) break;
    const q = i.deck.question(e.key, i.rng);
    if (!q || bases.has(q.base)) continue;
    bases.add(q.base);
    qs.push(q);
  }
  const byKey = new Map(qs.map((q) => [q.key, q]));
  const cands: Candidate[] = qs.map((q, n) => ({ key: q.key, base: q.base, group: q.group, newOrder: n }));
  return arrange(cands, i.rng, i.lastBase ?? null).map((c) => byKey.get(c.key)!);
}
