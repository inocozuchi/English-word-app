// 設定と学習履歴を localStorage に保存する。読み書きの失敗（プライベートモード等）でも落ちないようにする。
import type { Format } from './types.ts';
import type { ItemState } from './srs.ts';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  /** 解説を見せてから自動で次へ進むまでの秒数 */
  advanceSec: number;
  /** 回答の制限時間（秒） */
  answerSec: number;
  count: number;
  formats: Format[];
  excludedRoots: string[];
  theme: Theme;
  haptics: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  advanceSec: 5,
  answerSec: 8,
  count: 10,
  formats: ['ej'],
  excludedRoots: [],
  theme: 'system',
  haptics: true,
};

export const LIMITS = {
  advanceSec: [3, 10],
  answerSec: [5, 15],
  count: [5, 30],
} as const;

export interface DayLog { a: number; c: number }

export interface Progress {
  items: Record<string, ItemState>;
  days: Record<string, DayLog>;
  /** 直前のセッションの最後の問題（base） */
  lastBase: string | null;
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

export function normalizeSettings(s: Partial<Settings> | null): Settings {
  const d = DEFAULT_SETTINGS;
  const formats = (s?.formats ?? d.formats).filter((f): f is Format => ['ej', 'je', 'rm', 'ph'].includes(f));
  return {
    advanceSec: clamp(s?.advanceSec, LIMITS.advanceSec, d.advanceSec),
    answerSec: clamp(s?.answerSec, LIMITS.answerSec, d.answerSec),
    count: clamp(s?.count, LIMITS.count, d.count),
    formats: formats.length ? formats : d.formats,
    excludedRoots: Array.isArray(s?.excludedRoots) ? s!.excludedRoots.filter((x) => typeof x === 'string') : [],
    theme: s?.theme === 'light' || s?.theme === 'dark' ? s.theme : 'system',
    haptics: typeof s?.haptics === 'boolean' ? s.haptics : d.haptics,
  };
}

export const loadSettings = () => normalizeSettings(read<Partial<Settings>>(K_SETTINGS));
export const saveSettings = (s: Settings) => write(K_SETTINGS, s);

export function loadProgress(): Progress {
  const p = read<Partial<Progress>>(K_PROGRESS);
  return { items: p?.items ?? {}, days: p?.days ?? {}, lastBase: p?.lastBase ?? null };
}
export const saveProgress = (p: Progress) => write(K_PROGRESS, p);

/** バックアップ用（設定＋履歴を1つのJSONに） */
export function exportData(s: Settings, p: Progress): string {
  return JSON.stringify({ app: 'etymology-quiz', version: 1, exportedAt: new Date().toISOString(), settings: s, progress: p });
}

export function parseImport(text: string): { settings: Settings; progress: Progress } | null {
  try {
    const o = JSON.parse(text);
    if (o?.app !== 'etymology-quiz' || typeof o.progress?.items !== 'object') return null;
    return {
      settings: normalizeSettings(o.settings),
      progress: { items: o.progress.items, days: o.progress.days ?? {}, lastBase: o.progress.lastBase ?? null },
    };
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
