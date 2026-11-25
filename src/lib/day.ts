/** 日付の区切り。深夜の学習を前日分として扱うため、午前4時で日を切り替える */
export const DAY_START_HOUR = 4;
const DAY_MS = 86_400_000;

/** ローカル時刻での「学習日」を通し番号にする（1970-01-01 = 0） */
export function dayNumber(ts: number): number {
  const d = new Date(ts - DAY_START_HOUR * 3_600_000);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

export function dayKey(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function keyToDay(key: string): number {
  return Math.round(Date.parse(key + 'T00:00:00Z') / DAY_MS);
}

/** 連続学習日数。今日まだ学習していなくても、昨日まで続いていれば途切れていない扱い */
export function streak(days: Record<string, { a: number }>, today: number): number {
  const has = (n: number) => (days[dayKey(n)]?.a ?? 0) > 0;
  let d = has(today) ? today : today - 1;
  let n = 0;
  while (has(d)) {
    n++;
    d--;
  }
  return n;
}
