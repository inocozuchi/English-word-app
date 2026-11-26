// 1セッション分の問題を組み立てる（モード共通）。
import type { QuizMode, Question, TagStats } from './mode.ts';
import type { ItemState, Candidate } from './srs.ts';
import { selectItems, arrange } from './srs.ts';
import type { ReviewList } from './review.ts';
import { reviewOrder } from './review.ts';
import type { Rng } from './rng.ts';

export type SessionKind = 'normal' | 'review';

export interface SessionInput {
  mode: QuizMode;
  modeSettings: unknown;
  kind: SessionKind;
  count: number;
  items: Record<string, ItemState>;
  review: ReviewList;
  tags?: TagStats;
  /** このモードでの回答数の合計 */
  answered?: number;
  today: number;
  rng: Rng;
  lastBase?: string | null;
}

export function buildSession(i: SessionInput): Question[] {
  if (i.kind === 'review') return buildReview(i);
  const cands = i.mode.candidates(i.modeSettings);
  const picked = i.mode.pick
    ? i.mode.pick(
        { cands, items: i.items, tags: i.tags ?? {}, answered: i.answered ?? 0, count: i.count, today: i.today, rng: i.rng, avoidFirst: i.lastBase },
        i.modeSettings,
      )
    : selectItems(cands, i.items, { count: i.count, today: i.today, rng: i.rng, avoidFirst: i.lastBase });
  return picked.map((c) => i.mode.question(c.key, i.rng)).filter((q): q is Question => !!q);
}

/** 復習モード: 復習リストの問題だけを出す（出題範囲・出題パターンの設定には左右されない） */
function buildReview(i: SessionInput): Question[] {
  const qs: Question[] = [];
  const bases = new Set<string>();
  for (const e of reviewOrder(i.review, i.rng)) {
    if (qs.length >= i.count) break;
    const q = i.mode.question(e.key, i.rng);
    if (!q || bases.has(q.base)) continue;
    bases.add(q.base);
    qs.push(q);
  }
  const byKey = new Map(qs.map((q) => [q.key, q]));
  const cands: Candidate[] = qs.map((q, n) => ({ key: q.key, base: q.base, group: q.group, newOrder: n }));
  return arrange(cands, i.rng, i.lastBase ?? null).map((c) => byKey.get(c.key)!);
}
