// 自由英単語: 自分で登録した英単語と日本語訳だけで出題する（UI に依存しない。tests/custom.test.ts）
//   出題パターン: 英→日（4択）/ 日→英（4択）/ つづり（日本語を見て英語を入力）
//   4択の誤答は、ほかの登録語から（同じ文字列・正解と同じ意味は入れない）。4語以上で4択が出せる
import type { Question, Choice } from '../../core/mode.ts';
import type { Candidate } from '../../core/srs.ts';
import type { Rng } from '../../core/rng.ts';
import { shuffle } from '../../core/rng.ts';

export const MODE_ID = 'custom';
export type Pattern = 'ej' | 'je' | 'sp';
export const PATTERNS: { id: Pattern; label: string; desc: string }[] = [
  { id: 'ej', label: '英→日', desc: '英単語を見て意味を選ぶ' },
  { id: 'je', label: '日→英', desc: '意味を見て英単語を選ぶ' },
  { id: 'sp', label: 'つづり', desc: '意味を見て英単語を入力する' },
];
/** 4択に必要な語数 */
export const MIN_WORDS = 4;

export interface CWord {
  id: string;
  en: string;
  ja: string;
  /** 例文（任意） */
  ex?: string;
  /** メモ（任意） */
  note?: string;
  /** 追加した時刻 */
  added: number;
}

export interface CustomSettings {
  words: CWord[];
  patterns: Pattern[];
}

const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');

export function normalizeCustomSettings(raw: unknown): CustomSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const seen = new Set<string>();
  const words: CWord[] = [];
  for (const w of Array.isArray(r.words) ? r.words : []) {
    const id = str(w?.id), en = str(w?.en), ja = str(w?.ja);
    if (!id || !en || !ja || seen.has(id)) continue;
    seen.add(id);
    words.push({ id, en, ja, ...(str(w.ex) ? { ex: str(w.ex) } : {}), ...(str(w.note) ? { note: str(w.note) } : {}), added: typeof w.added === 'number' ? w.added : 0 });
  }
  const ps = (Array.isArray(r.patterns) ? r.patterns : []).filter((p: unknown): p is Pattern => PATTERNS.some((x) => x.id === p));
  return { words, patterns: ps.length ? [...new Set<Pattern>(ps)] : ['ej', 'je'] };
}

/** 照合用（大文字小文字・前後の空白・文末の句読点・連続する空白は無視） */
export const normWord = (s: string) => s.normalize('NFKC').trim().toLowerCase().replace(/[.!?。！？]+$/, '').replace(/\s+/g, ' ');

/** 新しい語の ID（時刻＋乱数） */
export const newId = (now = Date.now(), rnd = Math.random()) => `w${now.toString(36)}${Math.floor(rnd * 1e6).toString(36)}`;

/**
 * 「英語, 日本語」の行をまとめて読む（区切り: タブ・カンマ・「 - 」・「：」）。読めなかった行も返す
 * 例: "apple, りんご" / "take off\t離陸する"
 */
export function parseBulk(text: string): { words: { en: string; ja: string }[]; bad: string[] } {
  const words: { en: string; ja: string }[] = [];
  const bad: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = /^(.+?)\s*(?:\t|,|，|、|\s-\s|：|:)\s*(.+)$/.exec(t);
    if (m && /[A-Za-z]/.test(m[1]) && m[2].trim()) words.push({ en: m[1].trim(), ja: m[2].trim() });
    else bad.push(t);
  }
  return { words, bad };
}

export function customCandidates(s: CustomSettings, typing: 'on' | 'self' | 'skip'): Candidate[] {
  const out: Candidate[] = [];
  const four = s.words.length >= MIN_WORDS;
  // 新しく登録した語から先に覚える
  const ordered = [...s.words].sort((a, b) => b.added - a.added);
  ordered.forEach((w, n) => {
    for (const p of s.patterns) {
      if ((p === 'ej' || p === 'je') && !four) continue;
      if (p === 'sp' && typing === 'skip') continue;
      out.push({ key: `${p}:${w.id}`, base: `w:${w.id}`, group: w.id, newOrder: n * 3 + ['ej', 'je', 'sp'].indexOf(p), ...(p !== 'ej' && s.patterns.includes('ej') && four ? { requires: `ej:${w.id}` } : {}) });
    }
  });
  return out;
}

export interface CData {
  word: CWord;
  pattern: Pattern;
}
export type CQuestion = Question<CData>;

/** 誤答（ほかの語から重複なく。正解と同じ文字列は入れない） */
export function distractors(words: readonly CWord[], w: CWord, field: 'en' | 'ja', rng: Rng, n = 3): string[] {
  const used = new Set([normWord(w[field])]);
  const out: string[] = [];
  for (const o of shuffle(words.filter((x) => x.id !== w.id), rng)) {
    const k = normWord(o[field]);
    if (used.has(k) || normWord(o.en) === normWord(w.en)) continue;
    used.add(k);
    out.push(o[field]);
    if (out.length >= n) break;
  }
  return out;
}

export function customQuestion(words: readonly CWord[], key: string, rng: Rng): CQuestion | null {
  const m = /^(ej|je|sp):(.+)$/.exec(key);
  const id = m ? m[2] : key;
  const pattern = (m ? m[1] : 'ej') as Pattern;
  const w = words.find((x) => x.id === id);
  if (!w) return null;
  const base = { modeId: MODE_ID, key: `${pattern}:${w.id}`, base: `w:${w.id}`, group: w.id, pattern, patternLabel: PATTERNS.find((p) => p.id === pattern)!.label, data: { word: w, pattern } };
  if (pattern === 'sp') return { ...base, choices: [], answer: 0, interactive: true, untimed: true };
  const field = pattern === 'ej' ? 'ja' : 'en';
  const ds = distractors(words, w, field, rng);
  if (ds.length < 3) return null;
  const texts = shuffle([w[field], ...ds], rng);
  const choices: Choice[] = texts.map((text) => ({ text, latin: field === 'en' }));
  return { ...base, choices, answer: texts.indexOf(w[field]) };
}
