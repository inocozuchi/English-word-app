// 「デッキ」= クイズの種類（語源英単語、将来は文法クイズなど）。
// クイズ画面・結果・復習リスト・設定・学習記録は共通で、デッキは次を提供する:
//   - 出題候補と問題の作り方（candidates / question）
//   - 問題文と解説の表示（Prompt / Explain コンポーネント）
//   - 一覧などデッキ固有の画面（screens）と、設定・記録の追加セクション
// 進捗のキーはデッキごとに重ならない接頭辞を使うこと（語源デッキは ej: je: rm: ph:）。
import type { Component } from 'svelte';
import type { Candidate } from './srs.ts';
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
}

export interface Question<D = unknown> {
  deck: string;
  /** 進捗の保存キー */
  key: string;
  /** 1セッションで同じ対象を2回出さないためのキー */
  base: string;
  /** なるべく隣り合わせないまとまり */
  group: string;
  /** 出題形式のID と表示名 */
  mode: string;
  modeLabel: string;
  choices: Choice[];
  answer: number;
  /** デッキ固有の中身（Prompt / Explain が使う） */
  data: D;
}

export interface DeckMode {
  id: string;
  label: string;
  desc: string;
}

/** 復習リストや結果画面での1行表示 */
export interface ItemLabel {
  title: string;
  sub: string;
  latin?: boolean;
  /** 出題形式などの小さなラベル */
  tag?: string;
}

export interface Deck<S = any> {
  id: string;
  /** 日本語の名前（例: 語源英単語） */
  title: string;
  /** ホームの大見出し。改行は \n、アクセント色にする語は *語* */
  hero: string;
  tagline: string;
  modes: DeckMode[];
  normalizeSettings(raw: unknown): S;
  /** データの読み込み（別チャンク） */
  load(): Promise<void>;
  /** 読み込み済みか（リアクティブに読めること） */
  ready(): boolean;
  /** 出題範囲の候補 */
  candidates(s: S): Candidate[];
  question(key: string, rng: Rng): Question | null;
  label(key: string): ItemLabel | null;
  /** 詳細画面（なければ null） */
  detailRoute(key: string): Route | null;
  /** ホームのスタートに出す設定の要約 */
  summary(s: S): string;
  /** 件数などの一言（例: 1,136語） */
  stat(): string;
  Prompt: Component<{ q: Question<any> }>;
  Explain: Component<{ q: Question<any> }>;
  SettingsSection?: Component<{}>;
  StatsSection?: Component<{}>;
  /** 一覧画面（ホームのナビに出す） */
  browse?: { route: Route; label: string };
  screens: Record<string, Component<any>>;
}
