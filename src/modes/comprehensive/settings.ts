// 総合英語モードの設定（settings.modes.comprehensive に保存。一度決めた学習時間は毎日聞かない）
export interface CompSettings {
  /** 1日の学習時間の目安（分）。20 / 60 / 90 / 120 */
  minutes: number;
  /** カタカナ発音を出す */
  kana: boolean;
  /** 日本語訳を出す */
  ja: boolean;
  /** 読み上げの速さ */
  rate: number;
  /** 聞き取りの問題で、最初に1回自動で読み上げる */
  autoPlay: boolean;
}
export const MINUTES = [20, 60, 90, 120] as const;
export const RATES = [0.75, 1, 1.25] as const;
export const VOICE_LANGS = ['en-NZ', 'en-GB', 'en'] as const;

export function normalizeCompSettings(raw: unknown): CompSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  return {
    minutes: (MINUTES as readonly number[]).includes(r.minutes) ? r.minutes : 60,
    kana: typeof r.kana === 'boolean' ? r.kana : true,
    ja: typeof r.ja === 'boolean' ? r.ja : true,
    rate: (RATES as readonly number[]).includes(r.rate) ? r.rate : 1,
    autoPlay: typeof r.autoPlay === 'boolean' ? r.autoPlay : true,
  };
}
