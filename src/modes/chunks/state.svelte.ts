// 会話チャンクモードのデータ（読み込み後にリアクティブに参照できるように）
import type { ChunkData } from './types.ts';
import type { ChunkIndex } from './quiz.ts';
import { buildChunkIndex } from './quiz.ts';

class ChunkState {
  index = $state.raw<ChunkIndex | null>(null);
}
export const chk = new ChunkState();

let loading: Promise<ChunkIndex> | null = null;
export function loadChunks(): Promise<ChunkIndex> {
  return (loading ??= import('../../generated/chunks.json').then((m) => {
    const ix = buildChunkIndex(m.default as unknown as ChunkData);
    chk.index = ix;
    return ix;
  }));
}
