// 「この問題を報告」: 問題IDと理由を端末に保存する（モードごと）。設定画面から JSON で書き出せる。
// 保存先: eq.reports.<モードID>.v1
export const REPORT_REASONS = [
  { id: 'multi', label: '選択肢が複数正解になり得る' },
  { id: 'unnatural', label: '日本語が不自然' },
  { id: 'figure', label: '図が分かりにくい' },
  { id: 'other', label: 'その他' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['id'];

export interface Report {
  /** 問題ID（モードの保存キー） */
  key: string;
  reason: ReportReason;
  comment?: string;
  /** 報告した時刻（ISO） */
  at: string;
}

const storageKey = (modeId: string) => `eq.reports.${modeId}.v1`;

export function loadReports(modeId: string): Report[] {
  try {
    const v = JSON.parse(localStorage.getItem(storageKey(modeId)) ?? '[]');
    return Array.isArray(v) ? v.filter((r) => r && typeof r.key === 'string' && typeof r.reason === 'string') : [];
  } catch {
    return [];
  }
}

export function saveReports(modeId: string, list: Report[]) {
  try {
    localStorage.setItem(storageKey(modeId), JSON.stringify(list));
  } catch {
    /* 保存できなくても続ける */
  }
}

/** 報告を足す（同じ問題・同じ理由はまとめて最新に置き換える） */
export function addReport(list: Report[], r: Report): Report[] {
  return [...list.filter((x) => !(x.key === r.key && x.reason === r.reason)), r];
}

export function exportReports(modeId: string, list: Report[], describe?: (key: string) => Record<string, unknown> | null): string {
  return JSON.stringify(
    {
      app: 'eigo-loop',
      kind: 'reports',
      mode: modeId,
      exportedAt: new Date().toISOString(),
      reports: list.map((r) => ({ ...r, reasonLabel: REPORT_REASONS.find((x) => x.id === r.reason)?.label, ...(describe?.(r.key) ?? {}) })),
    },
    null,
    1,
  );
}
