// 語源デッキのデータ（読み込み後にリアクティブに参照できるように）
import type { Dataset } from './types.ts';
import type { Index } from './dataset.ts';
import { buildIndex } from './dataset.ts';

class EtyState {
  index = $state.raw<Index | null>(null);
}
export const ety = new EtyState();

let loading: Promise<Index> | null = null;
/** 単語データを読み込む（別チャンク。起動直後に並行して読み込み始める） */
export function loadEty(): Promise<Index> {
  return (loading ??= import('../../generated/words.json').then((m) => {
    const ix = buildIndex(m.default as unknown as Dataset);
    ety.index = ix;
    return ix;
  }));
}
