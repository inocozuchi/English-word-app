// 1回の学習（セッション）の状態と、回答の記録の仕方（UI に依存しない。tests/comprehensive.test.ts）
// 回答のたびにキュー・カーソル・採点・選択肢の順・会話のノードを保存し、閉じても途中から再開できる。
// 記録は「セッションID:タスクID」で1回だけ（再開しても二重に記録しない）。
import type { CompIndex, Task, Evidence, QRec } from './course.ts';
import { keysOf, evidenceKind, stageOf } from './course.ts';
import type { RecordEntry } from '../../core/store.svelte.ts';

export type Verdict =
  /** 自動採点で一致 */
  | 'correct'
  /** 一致せず、自己採点で「違った」 */
  | 'wrong'
  /** 自己採点で「合っていた」（自動で一致しなかった・自由回答） */
  | 'self-correct'
  /** 自己採点で「あやしい」 */
  | 'self-partial'
  /** わからない（答えを見た） */
  | 'skipped'
  /** 音声が使えなかった（聞き取りとしては記録しない。文字で確認） */
  | 'audio-unavailable'
  /** 学習カードを見た・会話を最後まで進めた */
  | 'seen';

export interface Result {
  v: Verdict;
  given?: string;
  hints: number;
  /** 回答までの時間（ms。一時停止・音声の読み込みは除く） */
  ms: number;
  /** 音声を再生した回数 */
  plays?: number;
}

export interface ConvState {
  taskId: string;
  node: string;
  /** 選んだ返答の履歴（ノードID → 返答の文） */
  path: { node: string; text: string }[];
}

export interface SessionState {
  v: 1;
  id: string;
  /** 始めた学習日（dayNumber）。日が変わったら新しいセッションにする */
  date: number;
  day: number;
  kind: 'normal' | 'review';
  minutes: number;
  tasks: Task[];
  cursor: number;
  results: Record<string, Result>;
  /** 一致しなかった入力（自己採点を待っている） */
  pending?: { taskId: string; given: string; hints: number; ms: number; plays?: number };
  /** 学習した時間（ms。画面を閉じていた間は数えない） */
  activeMs: number;
  /** 目安の時間を過ぎても続けると選んだ */
  overtime: boolean;
  conv?: ConvState;
  /** 選択肢の順（再開しても同じ順） */
  choiceOrder: Record<string, string[]>;
  finished: boolean;
}

export function newSession(p: { id: string; date: number; day: number; kind: 'normal' | 'review'; minutes: number; tasks: Task[] }): SessionState {
  return { v: 1, ...p, cursor: 0, results: {}, activeMs: 0, overtime: false, choiceOrder: {}, finished: p.tasks.length === 0 };
}

/** 再開する位置（まだ答えていない最初のタスク） */
export function resumeCursor(s: SessionState): number {
  const i = s.tasks.findIndex((t) => !s.results[t.id]);
  return i < 0 ? s.tasks.length : i;
}

export const isOk = (v: Verdict) => v === 'correct' || v === 'self-correct' || v === 'self-partial';

/**
 * 結果を書き込む（同じタスクに2回は書かない）。まちがえた問題は最後の「間違い直し」に1回だけ足す
 * （0日 = 当日の再挑戦）。カーソルはここでは進めない（解説を見せてから advance）
 */
export function applyResult(s: SessionState, taskId: string, r: Result): SessionState {
  if (s.results[taskId]) return s;
  const t = s.tasks.find((x) => x.id === taskId);
  const results = { ...s.results, [taskId]: r };
  let tasks = s.tasks;
  if (t && t.type === 'question' && !taskId.endsWith('#r') && (r.v === 'wrong' || r.v === 'skipped')) {
    const rid = taskId + '#r';
    if (!tasks.some((x) => x.id === rid)) tasks = [...tasks, { ...t, id: rid, stage: 'retry', reason: 'retry' }];
  }
  return { ...s, results, tasks, pending: s.pending?.taskId === taskId ? undefined : s.pending };
}

/** 次のタスクへ */
export function advance(s: SessionState): SessionState {
  const cursor = resumeCursor(s);
  return { ...s, cursor, conv: undefined, finished: cursor >= s.tasks.length };
}

/** 記録の内容（SRS に渡すもの・証拠・問題の記録）。音声が使えなかったときは SRS に入れない */
export interface RecordPlan {
  uid: string;
  entries: RecordEntry[];
  srs: boolean;
  tags: string[];
  ev: Record<string, Evidence>;
  qs: Record<string, QRec>;
  /** 音声が使えなかった問題 */
  audioNA?: string;
}

export function recordPlan(ix: CompIndex, s: SessionState, task: Task, r: Result, today: number, prev: { ev: Record<string, Evidence>; qs: Record<string, QRec> }): RecordPlan {
  const uid = `${s.id}:${task.id}`;
  const empty: RecordPlan = { uid, entries: [], srs: false, tags: [], ev: {}, qs: {} };
  if (task.type === 'learn' && task.itemId) {
    return { ...empty, ev: { [task.itemId]: { ...prev.ev[task.itemId], r: prev.ev[task.itemId]?.r ?? today } } };
  }
  if (task.type !== 'question' || !task.qid) return empty;
  const q = ix.q.get(task.qid)!;
  if (r.v === 'audio-unavailable') return { ...empty, audioNA: q.id };
  const ok = isOk(r.v);
  const low = r.v === 'self-partial' || (ok && r.hints > 0);
  const keys = keysOf(q);
  const entries: RecordEntry[] = keys.map((key) => ({ key, ok, conf: low ? 'low' : ok ? 'high' : undefined, rtMs: r.ms }));
  const ev: Record<string, Evidence> = {};
  const kind = evidenceKind(q);
  for (const key of keys) {
    const e: Evidence = { ...prev.ev[key] };
    if (ok && !low) {
      if (kind === 'recall') e.rc = e.rc ?? today;
      else e.u = e.u ?? today;
    }
    if (r.hints) e.h = (e.h ?? 0) + 1;
    if (r.v.startsWith('self')) e.s = (e.s ?? 0) + 1;
    if (!ok) e.w = (e.w ?? 0) + 1;
    ev[key] = e;
  }
  const pq = prev.qs[q.id];
  return {
    uid,
    entries,
    srs: true,
    tags: [`st:${stageOf(ix, q)}`, `kind:${q.kind}`, ...(r.v.startsWith('self') ? ['self'] : []), ...(r.hints ? ['hint'] : [])],
    ev,
    qs: { [q.id]: { n: (pq?.n ?? 0) + 1, c: (pq?.c ?? 0) + (ok ? 1 : 0), l: today, ok: ok ? 1 : 0 } },
  };
}
