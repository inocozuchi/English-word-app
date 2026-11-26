// 「モード」= クイズの種類（語源英単語・音声変化…）。src/modes/index.ts に並べたものが設定で選べる。
// クイズ画面・タイマー・結果・間隔反復・復習リスト・記録は共通で、モードは次を提供する:
//   - 出題候補と問題の作り方（candidates / question、必要なら pick で選び方を上書き）
//   - 問題文と解説の表示（Prompt / Explain コンポーネント）
//   - 一覧などモード固有の画面（screens）と、設定・記録・結果の追加セクション
// 進捗はモードごとに別に保存される（core/storage.ts）。キーはモードの中で一意であればよい。
import type { Component, Snippet } from 'svelte';
import type { Candidate, ItemState, SrsConfig } from './srs.ts';
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
  /** 画像の選択肢（すべての選択肢が画像なら 2×2 に並べる）。text は読み上げ用の代替テキスト */
  image?: string;
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
  /**
   * 4択ではなく、モードの Interact が回答の操作（並べ替え・入力・自己採点など）を描く。
   * そのとき choices は空でよく、正誤は Interact が onanswer で知らせる
   */
  interactive?: boolean;
  /** 回答の制限時間を使わない（入力・自己採点など） */
  untimed?: boolean;
  /** 回答後に自動で次へ進むまでの秒数（モードの設定より優先。自己採点のあとなど） */
  advanceSec?: number;
}

/** Interact からの回答 */
export interface InteractResult {
  ok: boolean;
  /** 自分の答え（結果画面の表示用） */
  given?: string;
  /** 自己申告の自信 */
  conf?: 'low' | 'high';
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
  /** Interact で答えた問題の正誤と自分の答え */
  ok?: boolean;
  given?: string;
}

/** 1問の記録が正解か（4択は選んだ番号、Interact は ok） */
export const isCorrect = (l: { q: Question; chosen: number | null; ok?: boolean }) => l.ok ?? l.chosen === l.q.answer;

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
  /** データの読み込み（別チャンク）。s を渡すと、その出題範囲に要るデータも読む */
  load(s?: S): Promise<void>;
  /** 読み込み済みか（リアクティブに読めること） */
  ready(): boolean;
  /** 出題範囲の候補 */
  candidates(s: S): Candidate[];
  /** 出題の選び方を上書きする（省略時は間隔反復の優先順: core/srs.ts の selectItems） */
  pick?(input: PickInput, s: S): Candidate[];
  question(key: string, rng: Rng): Question | null;
  /** 1セッションの問題数（共通設定の問題数より優先。null なら共通設定） */
  sessionCount?(s: S): number | null;
  /** 間隔反復の箱の決まり（省略時は core/srs.ts の DEFAULT_SRS） */
  srs?: SrsConfig;
  /** 4択以外の回答の操作（Question.interactive のとき、カード全体を描く。status は正誤の行） */
  Interact?: Component<{ q: Question<any>; phase: 'ask' | 'reveal'; onanswer: (r: InteractResult) => void; status: Snippet }>;
  /** ホームのスタートの要約に共通の問題数（10問 など）を付けない（問題数をモードが決める） */
  hideCount?: boolean;
  /** ホームのスタートの文言（例: 今日の学習を始める / 続きから再開する）。省略時は「スタート」 */
  startLabel?(): string;
  /** スタート・復習で開く画面（省略時は共通のクイズ画面 { name: 'quiz' }） */
  quizRoute?(kind: 'normal' | 'review'): Route;
  /** 設定画面の秒数（自動で次へ・制限時間）を出さない（問題ごとに秒数が決まっているモード） */
  hideTiming?: boolean;
  /** クイズ画面に「この問題を報告」ボタンを出す（core/reports.ts に保存） */
  reportable?: boolean;
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
