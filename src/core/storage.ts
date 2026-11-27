// 設定と学習履歴を localStorage に保存する。読み書きの失敗（プライベートモード等）でも落ちないようにする。
//
// 保存先:
//   eq.settings.v2            共通設定 + モードごとの設定（modes[モードID]）
//   eq.progress.<モードID>.v1  モードごとの学習記録（間隔反復・日ごとの回答数・復習リスト・タグ別正答率）
// 旧形式（語源英単語だけだった頃の ety.settings.v1 / ety.progress.v1）は、最初の読み込み時に
// 語源英単語モードのデータとして移行する。旧データは消さずに残す（戻し用）。
import { touched } from '../sync/touch.ts';
import type { ItemState } from './srs.ts';
import type { ReviewList } from './review.ts';
import type { TagStats, Timing } from './mode.ts';
import { REVIEW_GOAL } from './review.ts';

export type Theme = 'system' | 'light' | 'dark';
export type TypingMode = 'on' | 'self' | 'skip';

export interface Settings {
  count: number;
  theme: Theme;
  haptics: boolean;
  /** 復習リストから外れるまでの連続正解数 */
  reviewGoal: number;
  /** 使っているモード */
  activeMode: string;
  /** 音声を使う（false: 聞き取りの問題を出さない・自動で読み上げない。イヤホンがないときなど） */
  audio: boolean;
  /** 文字入力の問題: on = 入力して答える / self = 入力せず頭の中で答えて自己採点 / skip = 出さない */
  typing: TypingMode;
  /** 自己採点の問題（英作文・言い換え・カードなど、自分で合否を決める問題）を出す */
  selfGrade: boolean;
  /** モードごとの設定（秒数 advanceOkSec / advanceNgSec / answerSec と、各モードの出題範囲など）。旧 advanceSec は両方の初期値として読む */
  modes: Record<string, any>;
}

/** 最初のモード。旧形式のデータはこのモードのものとして移行する */
export const LEGACY_MODE = 'etymology';

/** 実際の文字入力の出し方（「頭の中で」は自己採点なので、自己採点を出さない設定なら「出さない」と同じ） */
export const typingOf = (s: Pick<Settings, 'typing' | 'selfGrade'>): TypingMode => (s.typing === 'self' && s.selfGrade === false ? 'skip' : s.typing);

export const DEFAULT_SETTINGS: Settings = {
  count: 10,
  theme: 'system',
  haptics: true,
  reviewGoal: REVIEW_GOAL.default,
  activeMode: LEGACY_MODE,
  audio: true,
  typing: 'on',
  selfGrade: true,
  modes: {},
};

export const LIMITS = {
  advanceSec: [2, 15],
  answerSec: [5, 20],
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
  /** タグ（音声変化のルールなど）ごとの正答数 */
  tags: TagStats;
  /** モード固有の記録（反射版のベスト記録など）。書き出し・読み込みにも含まれる */
  extra?: Record<string, unknown>;
}

const K_SETTINGS = 'eq.settings.v2';
const progressKey = (modeId: string) => `eq.progress.${modeId}.v1`;
const K_LEGACY_SETTINGS = 'ety.settings.v1';
const K_LEGACY_PROGRESS = 'ety.progress.v1';

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
    touched(key);
  } catch {
    /* 容量不足・保存不可でもアプリは続ける */
  }
}

export const clamp = (n: unknown, [lo, hi]: readonly [number, number], d: number) =>
  typeof n === 'number' && isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;

/** モードの秒数。正解・不正解で分ける前の advanceSec は両方の値として引き継ぐ。範囲外は丸める */
export function resolveTiming(raw: any, defaults: Timing): Timing {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    advanceOkSec: clamp(r.advanceOkSec ?? r.advanceSec, LIMITS.advanceSec, defaults.advanceOkSec),
    advanceNgSec: clamp(r.advanceNgSec ?? r.advanceSec, LIMITS.advanceSec, defaults.advanceNgSec),
    answerSec: clamp(r.answerSec, LIMITS.answerSec, defaults.answerSec),
  };
}

const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);

/** 設定を正規化する。旧形式（v1: 秒数が直下、語源の範囲が formats / excludedRoots / decks）も受け付ける */
export function normalizeSettings(raw: any): Settings {
  const d = DEFAULT_SETTINGS;
  const s = isObj(raw) ? raw : {};
  let modes: Record<string, any>;
  if (isObj(s.modes)) {
    modes = { ...s.modes };
  } else {
    // 旧形式 → 語源英単語モードの設定へ
    const ety: Record<string, any> = isObj(s.decks?.[LEGACY_MODE])
      ? { ...s.decks[LEGACY_MODE] }
      : { formats: s.formats, excludedRoots: s.excludedRoots };
    if (s.advanceSec !== undefined) ety.advanceSec = s.advanceSec;
    if (s.answerSec !== undefined) ety.answerSec = s.answerSec;
    for (const k of Object.keys(ety)) if (ety[k] === undefined) delete ety[k];
    modes = Object.keys(ety).length ? { [LEGACY_MODE]: ety } : {};
  }
  return {
    count: clamp(s.count, LIMITS.count, d.count),
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
    haptics: typeof s.haptics === 'boolean' ? s.haptics : d.haptics,
    reviewGoal: clamp(s.reviewGoal, LIMITS.reviewGoal, d.reviewGoal),
    activeMode: typeof s.activeMode === 'string' ? s.activeMode : typeof s.activeDeck === 'string' ? s.activeDeck : d.activeMode,
    audio: typeof s.audio === 'boolean' ? s.audio : d.audio,
    typing: s.typing === 'self' || s.typing === 'skip' ? s.typing : 'on',
    selfGrade: typeof s.selfGrade === 'boolean' ? s.selfGrade : d.selfGrade,
    modes,
  };
}

export function loadSettings(): Settings {
  const v2 = read(K_SETTINGS);
  if (v2) return normalizeSettings(v2);
  const s = normalizeSettings(read(K_LEGACY_SETTINGS));
  saveSettings(s);
  return s;
}
export const saveSettings = (s: Settings) => write(K_SETTINGS, s);

export function emptyProgress(): Progress {
  return { items: {}, days: {}, lastBase: null, review: {}, tags: {} };
}

export function normalizeProgress(p: any): Progress {
  const items: Record<string, ItemState> = isObj(p?.items) ? p.items : {};
  let review: ReviewList | null = isObj(p?.review) ? p.review : null;
  if (!review) {
    // 旧形式: 復習リストが無かった → 前回まちがえた問題で作る
    review = {};
    for (const [key, s] of Object.entries(items))
      if (s && s.lastOk === false) review[key] = { key, added: s.last, misses: Math.max(1, s.wrong), streak: 0, last: s.last };
  }
  return {
    items,
    days: isObj(p?.days) ? p.days : {},
    lastBase: typeof p?.lastBase === 'string' ? p.lastBase : null,
    review,
    tags: isObj(p?.tags) ? p.tags : {},
    ...(isObj(p?.extra) ? { extra: p.extra } : {}),
  };
}

export function loadProgress(modeId: string): Progress {
  const cur = read(progressKey(modeId));
  if (cur) return normalizeProgress(cur);
  if (modeId === LEGACY_MODE) {
    const legacy = read(K_LEGACY_PROGRESS);
    if (legacy) {
      const p = normalizeProgress(legacy);
      saveProgress(modeId, p);
      return p;
    }
  }
  return emptyProgress();
}
export const saveProgress = (modeId: string, p: Progress) => write(progressKey(modeId), p);

/** バックアップ用（設定＋全モードの履歴を1つのJSONに） */
export function exportData(s: Settings, progress: Record<string, Progress>): string {
  return JSON.stringify({ app: 'eigo-loop', version: 3, exportedAt: new Date().toISOString(), settings: s, progress });
}

/** バックアップを読む。旧形式（語源英単語だけのころの書き出し）も語源英単語モードとして読む */
export function parseImport(text: string): { settings: Settings; progress: Record<string, Progress> } | null {
  try {
    const o = JSON.parse(text);
    if (o?.app === 'eigo-loop' && isObj(o.progress)) {
      const progress: Record<string, Progress> = {};
      for (const [id, p] of Object.entries(o.progress)) progress[id] = normalizeProgress(p);
      return { settings: normalizeSettings(o.settings), progress };
    }
    if (o?.app === 'etymology-quiz' && isObj(o.progress?.items)) {
      return { settings: normalizeSettings(o.settings), progress: { [LEGACY_MODE]: normalizeProgress(o.progress) } };
    }
    return null;
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
