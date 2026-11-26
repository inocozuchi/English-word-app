// イメージリンクのデータの読み込み。起動時には読まず、使う部の JSON だけを fetch してメモリに置く
// （part2 は約3MB）。一度読んだ部はキャッシュし、二度と取りに行かない。
// オフラインでは Service Worker のプリキャッシュから返る。
import type { IlRaw, IlIndexFile, IlChapter } from './types.ts';

const BASE = './data/imagelink/';

class IlState {
  index = $state.raw<IlIndexFile | null>(null);
  /** 読み込み済みの部（部番号 → 問題） */
  parts = $state.raw<ReadonlyMap<number, IlRaw[]>>(new Map());
  /** 読み込みの失敗（オフラインで未取得など） */
  error = $state('');
}
export const il = new IlState();

/** 問題ID → 問題（読み込み済みの部だけ） */
const byId = new Map<string, IlRaw>();
let chapterMap = new Map<number, IlChapter>();

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json() as Promise<T>;
}

let indexP: Promise<IlIndexFile> | null = null;
export function loadIndex(): Promise<IlIndexFile> {
  return (indexP ??= getJson<IlIndexFile>('index.json').then(
    (ix) => {
      chapterMap = new Map(ix.chapters.map((c) => [c.no, c]));
      il.index = ix;
      return ix;
    },
    (e) => {
      indexP = null; // 次の機会にもう一度
      il.error = '問題データを読み込めませんでした（通信を確認してください）';
      throw e;
    },
  ));
}

const partP = new Map<number, Promise<IlRaw[]>>();
export function loadPart(n: number): Promise<IlRaw[]> {
  let p = partP.get(n);
  if (!p) {
    p = loadIndex()
      .then((ix) => {
        const file = ix.parts.find((x) => x.part === n)?.file;
        if (!file) throw new Error(`part ${n} がありません`);
        return getJson<IlRaw[]>(file);
      })
      .then(
        (qs) => {
          for (const q of qs) byId.set(q.id, q);
          const next = new Map(il.parts);
          next.set(n, qs);
          il.parts = next;
          il.error = '';
          return qs;
        },
        (e) => {
          partP.delete(n);
          il.error = '問題データを読み込めませんでした（通信を確認してください）';
          throw e;
        },
      );
    partP.set(n, p);
  }
  return p;
}

/** 必要な部をまとめて読む（失敗しても読めた分で続ける） */
export async function loadParts(parts: Iterable<number>): Promise<void> {
  await Promise.allSettled([...new Set(parts)].map(loadPart));
}

export const questionById = (id: string) => byId.get(id);
export const chapterInfo = (no: number) => chapterMap.get(no);
export const partOfChapter = (no: number) => chapterMap.get(no)?.part;

/** 読み込み済みの問題を部の順に */
export function loadedQuestions(parts?: readonly number[]): IlRaw[] {
  const out: IlRaw[] = [];
  for (const n of [1, 2, 3, 4]) {
    if (parts && !parts.includes(n)) continue;
    const qs = il.parts.get(n);
    if (qs) for (const q of qs) out.push(q);
  }
  return out;
}
