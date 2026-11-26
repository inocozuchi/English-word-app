// 中断したクイズ（共通のクイズ画面）。一時停止・アプリを離れた・✕で閉じたときに保存し、ホームから続きを再開できる。
// 乗り換えなどで途中でやめても、アプリが iOS に閉じられても失われない。保存先: eq.quiz.suspend.v1（1つだけ）
import type { Question } from './mode.ts';
import type { AnswerLog } from './router.svelte.ts';

export interface Suspended {
  v: 1;
  modeId: string;
  kind: 'normal' | 'review';
  seed: number;
  override?: Record<string, unknown>;
  qs: Question[];
  /** 次に出す問題の位置（答えた問題の数） */
  i: number;
  logs: AnswerLog[];
  marks: ('ok' | 'ng')[];
  combo: number;
  savedAt: number;
}

const KEY = 'eq.quiz.suspend.v1';

export function loadSuspend(modeId?: string): Suspended | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Suspended | null;
    if (!s || s.v !== 1 || !Array.isArray(s.qs) || s.i >= s.qs.length) return null;
    if (modeId && s.modeId !== modeId) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSuspend(s: Suspended) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 保存できなくても続ける */
  }
}

export function clearSuspend() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
