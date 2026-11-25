// 設定と学習履歴を localStorage に保存する。読み書きの失敗（プライベートモード等）でも落ちないようにする。
import type { ItemState } from './srs.ts';
import type { ReviewList } from './review.ts';
import { REVIEW_GOAL } from './review.ts';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  /** 解説を見せてから自動で次へ進むまでの秒数 */
  advanceSec: number;
  /** 回答の制限時間（秒） */
  answerSec: number;
  count: number;
  theme: Theme;
  haptics: boolean;
  /** 復習リストから外れるまでの連続正解数 */
  reviewGoal: number;
  /** 使っているデッキ */
  activeDeck: string;
  /** デッキごとの設定（中身は各デッキの normalizeSettings が解釈する） */
  decks: Record<string, unknown>;
}

/** 最初のデッキ。旧形式（デッキ分け前）のデータはこのデッキのものとして移行する */
export const LEGACY_DECK = 'etymology';

export const DEFAULT_SETTINGS: Settings = {
  advanceSec: 5,
  answerSec: 8,
  count: 10,
  theme: 'system',
  haptics: true,
  reviewGoal: REVIEW_GOAL.default,
  activeDeck: LEGACY_DECK,
  decks: {},
};

export const LIMITS = {
  advanceSec: [3, 10],
  answerSec: [5, 15],
  count: [5, 30],
  reviewGoal: [REVIEW_GOAL.min, REVIEW_GOAL.max],
} as const;

export interface DayLog {
  a: number;
  c: number;
}

export interface Progress {
  items: Record<string, ItemState>;
  days: Record<string, DayLog>;
  /** 直前のセッションの最後の問題（base） */
  lastBase: string | null;
  review: ReviewList;
}

const K_SETTINGS = 'ety.settings.v1';
const K_PROGRESS = 'ety.progress.v1';

function read<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 容量不足・保存不可でもアプリは続ける */
  }
}

const clamp = (n: unknown, [lo, hi]: readonly [number, number], d: number) =>
  typeof n === 'number' && isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;

export function normalizeSettings(raw: any): Settings {
  const d = DEFAULT_SETTINGS;
  const s = raw && typeof raw === 'object' ? raw : {};
  const decks: Record<string, unknown> = s.decks && typeof s.decks === 'object' ? { ...s.decks } : {};
  // 旧形式: formats / excludedRoots が直下にあった
  if (!decks[LEGACY_DECK] && (s.formats || s.excludedRoots)) {
    decks[LEGACY_DECK] = { formats: s.formats, excludedRoots: s.excludedRoots };
  }
  return {
    advanceSec: clamp(s.advanceSec, LIMITS.advanceSec, d.advanceSec),
    answerSec: clamp(s.answerSec, LIMITS.answerSec, d.answerSec),
    count: clamp(s.count, LIMITS.count, d.count),
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
    haptics: typeof s.haptics === 'boolean' ? s.haptics : d.haptics,
    reviewGoal: clamp(s.reviewGoal, LIMITS.reviewGoal, d.reviewGoal),
    activeDeck: typeof s.activeDeck === 'string' ? s.activeDeck : d.activeDeck,
    decks,
  };
}

export const loadSettings = () => normalizeSettings(read(K_SETTINGS));
export const saveSettings = (s: Settings) => write(K_SETTINGS, s);

export function normalizeProgress(p: any): Progress {
  const items: Record<string, ItemState> = p?.items && typeof p.items === 'object' ? p.items : {};
  let review: ReviewList = p?.review && typeof p.review === 'object' ? p.review : (null as any);
  if (!review) {
    // 旧形式: 復習リストが無かった → 前回まちがえた問題で作る
    review = {};
    for (const [key, s] of Object.entries(items))
      if (s && s.lastOk === false)
        review[key] = { deck: LEGACY_DECK, key, added: s.last, misses: Math.max(1, s.wrong), streak: 0, last: s.last };
  }
  return { items, days: p?.days ?? {}, lastBase: p?.lastBase ?? null, review };
}

export const loadProgress = () => normalizeProgress(read(K_PROGRESS));
export const saveProgress = (p: Progress) => write(K_PROGRESS, p);

/** バックアップ用（設定＋履歴を1つのJSONに） */
export function exportData(s: Settings, p: Progress): string {
  return JSON.stringify({ app: 'etymology-quiz', version: 2, exportedAt: new Date().toISOString(), settings: s, progress: p });
}

export function parseImport(text: string): { settings: Settings; progress: Progress } | null {
  try {
    const o = JSON.parse(text);
    if (o?.app !== 'etymology-quiz' || typeof o.progress?.items !== 'object') return null;
    return { settings: normalizeSettings(o.settings), progress: normalizeProgress(o.progress) };
  } catch {
    return null;
  }
}

/** iOS でデータが消されにくくなるよう永続化を要求（対応時のみ） */
export function requestPersist() {
  try {
    navigator.storage?.persist?.();
  } catch {
    /* noop */
  }
}
