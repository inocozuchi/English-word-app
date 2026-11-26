// 総合英語モードの状態（教材の読み込み・記録の読み書き・セッションの保存）
//   教材: src/generated/comprehensive.json を、このモードを使うときだけ読む（別チャンク。オフラインは SW のキャッシュ）
//   記録: 共通の eq.progress.comprehensive.v1（間隔反復・日ごとの回答数・復習リスト・タグ）＋ extra（下の CompExtra）
//   セッション: eq.comp.session.v1（キュー・カーソル・結果・会話のノード。回答のたびに保存）
import type { CompData } from './types.ts';
import { buildIndex, MODE_ID, type CompIndex, type Evidence, type QRec, type CourseDayState, INITIAL_DAY } from './course.ts';
import type { SessionState, Result } from './session.ts';
import { recordPlan } from './session.ts';
import type { DiagState } from './diag.ts';
import { store, recordMany } from '../../core/store.svelte.ts';
import { dayNumber } from '../../core/day.ts';

class CompState {
  index = $state.raw<CompIndex | null>(null);
  error = $state('');
  /** 保存中のセッション（画面の表示用。正は localStorage） */
  session = $state.raw<SessionState | null>(null);
}
export const comp = new CompState();

let loading: Promise<CompIndex> | null = null;
export function loadComp(): Promise<CompIndex> {
  return (loading ??= import('../../generated/comprehensive.json').then(
    (m) => {
      const ix = buildIndex(m.default as unknown as CompData);
      comp.index = ix;
      comp.session = loadSession();
      return ix;
    },
    (e) => {
      loading = null;
      comp.error = '教材を読み込めませんでした';
      throw e;
    },
  ));
}

// ---- extra（Progress.extra。バックアップにも含まれる） ----
export interface CompExtra {
  /** 記録の単位ごとの証拠（習熟度） */
  ev?: Record<string, Evidence>;
  /** 問題ごとの記録 */
  qs?: Record<string, QRec>;
  /** 日程 */
  cd?: CourseDayState;
  /** お気に入り（項目ID・図解ID・文法ID） */
  fav?: string[];
  /** 診断 */
  diag?: Partial<Record<'baseline' | 'final', DiagState>>;
  /** 会話を最後まで進めた場面（学習日） */
  conv?: Record<string, number>;
  /** 音声が使えなかった問題の数（聞き取りとしては記録しない） */
  audioNA?: number;
  /** 記録済みの回答（セッションID:タスクID。最近の分だけ。再開で二重に記録しない） */
  rec?: string[];
  /** 種類ごとの回答時間（最近20回。目安の時間に使う） */
  ms?: Record<string, number[]>;
}
const REC_KEEP = 400;

export const extra = (): CompExtra => (store.settings.activeMode === MODE_ID ? ((store.progress.extra ?? {}) as CompExtra) : {});

// ---- セッション ----
const SESSION_KEY = 'eq.comp.session.v1';
export function loadSession(): SessionState | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    return s && s.v === 1 && Array.isArray(s.tasks) ? (s as SessionState) : null;
  } catch {
    return null;
  }
}
export function saveSession(s: SessionState | null) {
  comp.session = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* 保存できなくても続ける */
  }
}
/** 今日の続きがあるか（日が変わったら新しく始める） */
export function hasTodaySession(today = dayNumber(Date.now())): boolean {
  const s = comp.session ?? loadSession();
  return !!s && !s.finished && s.date === today && s.kind === 'normal';
}

/**
 * 1つの結果を記録する（間隔反復・証拠・問題の記録・回答時間）。同じ「セッションID:タスクID」は2回記録しない。
 * 記録したら true
 */
export function commitResult(ix: CompIndex, s: SessionState, taskId: string, r: Result): boolean {
  const task = s.tasks.find((t) => t.id === taskId);
  if (!task) return false;
  const ex = extra();
  const uid = `${s.id}:${taskId}`;
  if (ex.rec?.includes(uid)) return false;
  const today = dayNumber(Date.now());
  const plan = recordPlan(ix, s, task, r, today, { ev: ex.ev ?? {}, qs: ex.qs ?? {} });
  const kind = task.type === 'question' ? ix.q.get(task.qid!)!.kind : task.type;
  const patch = (e: Record<string, unknown>) => {
    const x = e as CompExtra;
    const ms = { ...(x.ms ?? {}) };
    if (r.ms > 0 && r.v !== 'audio-unavailable') ms[kind] = [...(ms[kind] ?? []), Math.round(r.ms)].slice(-20);
    return {
      ...x,
      ev: { ...(x.ev ?? {}), ...plan.ev },
      qs: { ...(x.qs ?? {}), ...plan.qs },
      rec: [...(x.rec ?? []), uid].slice(-REC_KEEP),
      audioNA: (x.audioNA ?? 0) + (plan.audioNA ? 1 : 0),
      ms,
      // 新しい内容（学習カード・演習）に答えたら、その日は日程を進めたことにする
      cd: s.kind === 'normal' && task.reason !== 'due' && task.reason !== 'prev' ? { ...(x.cd ?? INITIAL_DAY), progressed: true } : x.cd,
    } satisfies CompExtra;
  };
  recordMany(plan.srs ? plan.entries : [], plan.tags, patch, plan.srs);
  return true;
}

/** extra の一部を書き換える（お気に入り・診断・会話・日程） */
export function patchExtra(f: (x: CompExtra) => CompExtra) {
  recordMany([], [], (e) => f(e as CompExtra) as Record<string, unknown>, false);
}

/** 自分の回答時間の中央値（5回以上あれば） */
export function medians(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, xs] of Object.entries(extra().ms ?? {})) {
    if (xs.length < 5) continue;
    const s = [...xs].sort((a, b) => a - b);
    out[k] = s[Math.floor(s.length / 2)] / 1000;
  }
  return out;
}

export const isFav = (id: string) => (extra().fav ?? []).includes(id);
export function toggleFav(id: string) {
  patchExtra((x) => {
    const f = x.fav ?? [];
    return { ...x, fav: f.includes(id) ? f.filter((y) => y !== id) : [...f, id] };
  });
}

export const nowDay = () => dayNumber(Date.now());
void store;
