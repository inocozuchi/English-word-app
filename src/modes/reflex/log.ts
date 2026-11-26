// 反射版の1回分の記録（結果画面に渡す）
export interface ReflexLog {
  key: string;
  ok: boolean;
  timeout: boolean;
  /** 正解だが遅い・カードで「あやしい」 */
  slow: boolean;
  ms: number;
  /** そのセッションで初めての回答（成績に記録したもの） */
  first: boolean;
  /** 再出題 */
  again: boolean;
  card: boolean;
}

export interface Summary {
  firstTotal: number;
  firstCorrect: number;
  /** 正解（初回）の平均反応時間 */
  avgMs: number;
  missed: string[];
  slow: string[];
}

export function summarize(logs: readonly ReflexLog[]): Summary {
  const first = logs.filter((l) => l.first);
  const okQ = first.filter((l) => l.ok && !l.card);
  return {
    firstTotal: first.length,
    firstCorrect: first.filter((l) => l.ok).length,
    avgMs: okQ.length ? Math.round(okQ.reduce((n, l) => n + l.ms, 0) / okQ.length) : 0,
    missed: [...new Set(first.filter((l) => !l.ok).map((l) => l.key))],
    slow: [...new Set(first.filter((l) => l.ok && l.slow).map((l) => l.key))],
  };
}
