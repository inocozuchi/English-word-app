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
    const title = q.prompt_en ?? q.prompt_ja ?? q.answer ?? q.question;
    const sub = q.answer ?? (q.prompt_ja ? `「${q.prompt_ja}」の図` : '');
    return { title, sub: sub === title ? q.question : sub, latin: !!q.prompt_en || (!q.prompt_ja && /^[\x00-\x7F]+$/.test(title)), tag: typeTag(q.type) };
  }
  const c = cardById.get(key);
  return c ? { title: c.word, sub: c.image, latin: true, tag: 'カード' } : null;
}
