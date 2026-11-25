// 「モード」= クイズの種類（語源英単語・音声変化…）。src/modes/index.ts に並べたものが設定で選べる。
// クイズ画面・タイマー・結果・間隔反復・復習リスト・記録は共通で、モードは次を提供する:
//   - 出題候補と問題の作り方（candidates / question、必要なら pick で選び方を上書き）
//   - 問題文と解説の表示（Prompt / Explain コンポーネント）
//   - 一覧などモード固有の画面（screens）と、設定・記録・結果の追加セクション
// 進捗はモードごとに別に保存される（core/storage.ts）。キーはモードの中で一意であればよい。
import type { Component } from 'svelte';
import type { Candidate, ItemState } from './srs.ts';
import type { Rng } from './rng.ts';

export interface Route {
  name: string;
  params?: Record<string, any>;
}

export interface Choice {
  text: string;
  /** 品詞などの小さな補足 */
  tag?: string;
  /** 欧文として表示する */
  latin?: boolean;
  /** 左に小さな色の印を付ける（音声変化のルール色など） */
  color?: string;
}

export interface Question<D = unknown> {
  modeId: string;
  /** 進捗の保存キー */
  key: string;
  /** 1セッションで同じ対象を2回出さないためのキー */
  base: string;
  /** なるべく隣り合わせないまとまり */
  group: string;
  /** 出題パターンの ID と表示名 */
  pattern: string;
  patternLabel: string;
  choices: Choice[];
  answer: number;
  /** 正答率を別に集計するタグ（音声変化のルールなど） */
  tags?: string[];
  /** モード固有の中身（Prompt / Explain が使う） */
  data: D;
}

export interface ModePattern {
  id: string;
  label: string;
  desc: string;
}

/** 復習リストや結果画面での1行表示 */
export interface ItemLabel {
  title: string;
  sub: string;
  latin?: boolean;
  /** 出題パターンなどの小さなラベル */
  tag?: string;
}

/** 秒数（モードごとに設定できる） */
export interface Timing {
  /** 解説を見せてから自動で次へ進むまで（正解のとき） */
  advanceOkSec: number;
  /** 同（不正解・時間切れのとき。解説を読む時間を長めに） */
  advanceNgSec: number;
  /** 回答の制限時間 */
  answerSec: number;
}

export type TagStats = Record<string, { seen: number; correct: number }>;

export interface PickInput {
  cands: Candidate[];
  items: Record<string, ItemState>;
  tags: TagStats;
  /** このモードでの回答数の合計 */
  answered: number;
  count: number;
  today: number;
  rng: Rng;
  avoidFirst?: string | null;
}

/** 結果画面に渡す、1問分の記録 */
export interface AnswerRecord {
  q: Question;
  chosen: number | null;
  review: 'added' | 'missed' | 'progress' | 'cleared' | null;
}

export interface QuizMode<S = any> {
  id: string;
  /** 日本語の名前（例: 語源英単語） */
  title: string;
  /** ホームの大見出し。改行は \n、アクセント色にする語は *語* */
  hero: string;
  tagline: string;
  patterns: ModePattern[];
  /** 秒数の初期値 */
  timing: Timing;
  normalizeSettings(raw: unknown): S;
  /** データの読み込み（別チャンク） */
  load(): Promise<void>;
  /** 読み込み済みか（リアクティブに読めること） */
  ready(): boolean;
  /** 出題範囲の候補 */
  candidates(s: S): Candidate[];
  /** 出題の選び方を上書きする（省略時は間隔反復の優先順: core/srs.ts の selectItems） */
  pick?(input: PickInput, s: S): Candidate[];
  question(key: string, rng: Rng): Question | null;
  label(key: string): ItemLabel | null;
  /** 詳細画面（なければ null） */
  detailRoute(key: string): Route | null;
  /** ホームのスタートに出す設定の要約 */
  summary(s: S): string;
  /** 件数などの一言（例: 1,136語） */
  stat(): string;
  /**
   * 問題文。inlineExplain のときは回答後も表示したまま（phase で解説まで描く）。
   * そうでなければ回答後は Explain に入れ替わる。
   */
  Prompt: Component<{ q: Question<any>; phase: 'ask' | 'reveal' }>;
  Explain?: Component<{ q: Question<any> }>;
  inlineExplain?: boolean;
  /** 解説の下に小さく出す注意書き（問題ごとに変えるなら関数。null で出さない） */
  note?: string | ((q: Question<any>) => string | null);
  SettingsSection?: Component<{}>;
  StatsSection?: Component<{}>;
  ResultSection?: Component<{ logs: AnswerRecord[] }>;
  /** 一覧画面（ホームのナビに出す） */
  browse?: { route: Route; label: string };
  screens: Record<string, Component<any>>;
}
