// Day0 / Day60 の診断（通常の学習とは別。間隔反復に入れない。終わるまで答えを見せない）
// 採点: 自動で一致・自己採点・未回答（スキップ）・音声不可を分けて数える。音声不可は分母から外し、カバー率を出す。
// 比べるのは「両方で答えた分野」だけ。2つの診断は等化されていないので、TOEIC への換算や進級の判定はしない。
import type { DiagForm, Domain } from './types.ts';
import { autoGrade } from './grade.ts';

export type DiagVerdict = 'auto' | 'mismatch' | 'self' | 'skipped' | 'audio-unavailable';
export interface DiagAnswer {
  v: DiagVerdict;
  given?: string;
  ms: number;
  /** 終わったあとの自己採点（mismatch / self の問題だけ）。true = 合っていた */
  selfOk?: boolean;
}
export interface DiagState {
  form: 'baseline' | 'final';
  startedAt: number;
  cursor: number;
  answers: Record<string, DiagAnswer>;
  finishedAt?: number;
}

export const DOMAIN_LABEL: Record<Domain, string> = {
  vocabulary: '英単語',
  grammar: '英文法',
  chunks: 'チャンク・質問理解',
  listening: 'リスニング',
  paraphrase: '言い換え',
  reading: '読解',
  academic: 'アカデミック英語',
};
export const DOMAINS: Domain[] = ['vocabulary', 'grammar', 'chunks', 'listening', 'paraphrase', 'reading', 'academic'];

/** 1問の答え（自動で一致したか。自己採点の問題は一致を見ない） */
export function diagAnswer(q: DiagForm['questions'][number], given: string, ms: number): DiagAnswer {
  if (!given.trim()) return { v: 'skipped', ms };
  if (q.scoring === 'self') return { v: 'self', given, ms };
  return { v: autoGrade(given, q.acceptedAnswers).verdict === 'correct' ? 'auto' : 'mismatch', given, ms };
}

export interface DomainScore {
  domain: Domain;
  total: number;
  auto: number;
  /** 自己採点で合っていた */
  self: number;
  /** 自己採点の対象（mismatch・self の数） */
  selfRated: number;
  skipped: number;
  audioNA: number;
  /** 正答率（自動＋自己採点の正解 / 音声不可を除いた数）。0〜1。対象がなければ null */
  rate: number | null;
  /** 音声不可を除いて答えられた割合 */
  coverage: number;
  /** 最初の回答の時間の中央値（ms） */
  medianMs: number | null;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export function scoreDiag(form: DiagForm, st: DiagState): DomainScore[] {
  return DOMAINS.map((domain) => {
    const qs = form.questions.filter((q) => q.domain === domain);
    const as = qs.map((q) => st.answers[q.id]);
    const auto = as.filter((a) => a?.v === 'auto').length;
    const rated = as.filter((a) => a && (a.v === 'mismatch' || a.v === 'self'));
    const self = rated.filter((a) => a.selfOk).length;
    const skipped = as.filter((a) => !a || a.v === 'skipped').length;
    const audioNA = as.filter((a) => a?.v === 'audio-unavailable').length;
    const denom = qs.length - audioNA;
    return {
      domain,
      total: qs.length,
      auto,
      self,
      selfRated: rated.length,
      skipped,
      audioNA,
      rate: denom > 0 ? (auto + self) / denom : null,
      coverage: qs.length ? denom / qs.length : 0,
      medianMs: median(as.filter((a) => a && a.v !== 'skipped' && a.v !== 'audio-unavailable').map((a) => a.ms)),
    };
  }).filter((s) => s.total > 0);
}

/** 2つの診断を分野ごとに比べる。両方で答えた（音声不可でなく対象がある）分野だけ */
export function compareDiag(a: DomainScore[], b: DomainScore[]): { domain: Domain; before: number; after: number }[] {
  return a
    .map((x) => {
      const y = b.find((s) => s.domain === x.domain);
      if (!y || x.rate === null || y.rate === null || x.audioNA !== y.audioNA) return null;
      return { domain: x.domain, before: x.rate, after: y.rate };
    })
    .filter((x): x is { domain: Domain; before: number; after: number } => !!x);
}

/** 診断の分野 → 学習の段階（苦手な分野を自動の復習で先に出す） */
export const DOMAIN_STAGES: Record<Domain, string[]> = {
  vocabulary: ['vocabulary'],
  grammar: ['grammar'],
  chunks: ['chunk', 'idiom', 'scenario'],
  listening: ['listening'],
  paraphrase: ['paraphrase', 'translation'],
  reading: ['reading'],
  academic: ['reading', 'vocabulary'],
};
