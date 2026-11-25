// 復習リスト: まちがえた（時間切れを含む）問題を自動で入れ、
// 連続で goal 回正解したら自動で外す。
import type { Rng } from './rng.ts';

export interface ReviewEntry {
  deck: string;
  key: string;
  /** 入った時刻 */
  added: number;
  /** リストに入ってからまちがえた回数 */
  misses: number;
  /** 連続正解数（まちがえると 0） */
  streak: number;
  /** 最後に答えた時刻 */
  last: number;
}

export type ReviewList = Record<string, ReviewEntry>;

export type ReviewEvent = 'added' | 'missed' | 'progress' | 'cleared' | null;

export const REVIEW_GOAL = { min: 2, max: 5, default: 3 } as const;

export function updateReview(
  list: ReviewList,
  deck: string,
  key: string,
  ok: boolean,
  now: number,
  goal: number,
): { list: ReviewList; event: ReviewEvent } {
  const cur = list[key];
  if (!ok) {
    const next: ReviewEntry = cur
      ? { ...cur, misses: cur.misses + 1, streak: 0, last: now }
      : { deck, key, added: now, misses: 1, streak: 0, last: now };
    return { list: { ...list, [key]: next }, event: cur ? 'missed' : 'added' };
  }
  if (!cur) return { list, event: null };
  const streak = cur.streak + 1;
  if (streak >= goal) {
    const { [key]: _, ...rest } = list;
    return { list: rest, event: 'cleared' };
  }
  return { list: { ...list, [key]: { ...cur, streak, last: now } }, event: 'progress' };
}

/** 復習で出す順: 連続正解が少ない → まちがえた回数が多い → 長く答えていない */
export function reviewOrder(list: ReviewList, deck: string, rng: Rng): ReviewEntry[] {
  const jitter = new Map<string, number>();
  const es = Object.values(list).filter((e) => e.deck === deck);
  for (const e of es) jitter.set(e.key, rng());
  return es.sort(
    (a, b) => a.streak - b.streak || b.misses - a.misses || a.last - b.last || jitter.get(a.key)! - jitter.get(b.key)!,
  );
}

export function reviewCount(list: ReviewList, deck: string): number {
  let n = 0;
  for (const k in list) if (list[k].deck === deck) n++;
  return n;
}
