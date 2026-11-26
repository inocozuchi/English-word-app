// 1行表示（復習リスト・結果）
import type { ItemLabel } from '../../core/mode.ts';
import { qById, cardById, rx } from './state.svelte.ts';

const TYPE_TAG: Record<string, string> = {
  r_word2image: '語→イメージ',
  r_image2word: 'イメージ→語',
  r_prep_icon: 'アイコン→前置詞',
  r_prep_word2icon: '前置詞→アイコン',
  r_fig2word: '図→語',
  r_word2fig: '語→図',
};
export const typeTag = (t: string) => TYPE_TAG[t] ?? t;

export function itemLabel(key: string): ItemLabel | null {
  void rx.questions; // 読み込んだら表示し直す
  const q = qById.get(key);
  if (q) {
    const tag = typeTag(q.type);
    switch (q.type) {
      case 'r_word2image':
        return { title: q.prompt_en ?? '', sub: q.answer ?? '', latin: true, tag };
      case 'r_image2word':
        return { title: q.answer ?? '', sub: q.prompt_ja ?? '', latin: true, tag };
      case 'r_prep_icon':
        return { title: q.answer ?? '', sub: 'アイコン → 前置詞', latin: true, tag };
      case 'r_prep_word2icon':
        return { title: q.prompt_en ?? '', sub: '前置詞 → アイコン', latin: true, tag };
      case 'r_fig2word':
        return { title: q.answer ?? '', sub: '図を見て語を選ぶ', latin: /^[\x00-\x7F・ と]+$/.test(q.answer ?? ''), tag };
      default:
        return { title: q.prompt_ja ?? '', sub: '語に合う図を選ぶ', latin: /^[\x00-\x7F・ と]+$/.test(q.prompt_ja ?? ''), tag };
    }
  }
  const c = cardById.get(key);
  return c ? { title: c.word, sub: c.image, latin: true, tag: 'カード' } : null;
}
