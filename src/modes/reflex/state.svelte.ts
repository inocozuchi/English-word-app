// 反射版のデータの読み込み（小さいので一度に読む。読んだらメモリに置く）
import type { RQuestion, RCard, RIndexFile } from './types.ts';

const BASE = './data/imagelink-reflex/';

class ReflexState {
  questions = $state.raw<RQuestion[] | null>(null);
  cards = $state.raw<RCard[]>([]);
  error = $state('');
}
export const rx = new ReflexState();
export const qById = new Map<string, RQuestion>();
export const cardById = new Map<string, RCard>();

let p: Promise<void> | null = null;
export function loadReflex(): Promise<void> {
  return (p ??= (async () => {
    const get = async <T,>(f: string): Promise<T> => {
      const r = await fetch(BASE + f);
      if (!r.ok) throw new Error(`${f}: ${r.status}`);
      return r.json();
    };
    const ix = await get<RIndexFile>('index.json');
    const [qs, cs] = await Promise.all([get<RQuestion[]>(ix.question_file), get<RCard[]>(ix.cards_file)]);
    for (const q of qs) qById.set(q.id, q);
    for (const c of cs) cardById.set(c.id, c);
    rx.cards = cs;
    rx.questions = qs;
    rx.error = '';
  })().catch((e) => {
    p = null;
    rx.error = '問題データを読み込めませんでした（通信を確認してください）';
    throw e;
  }));
}
