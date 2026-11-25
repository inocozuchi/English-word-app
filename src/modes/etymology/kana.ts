import type { KanaVariant } from './types.ts';

/**
 * "^プロ^グレス（名）／プロ^グレ^ス（動）" → バリアントの配列。
 * ^ で囲まれた部分が強く読む部分。split('^') の奇数番目が強勢部分になる。
 */
export function parseKana(raw: string): KanaVariant[] {
  return raw.split('／').map((v) => {
    let label: string | null = null;
    const m = v.match(/（([^）]+)）\s*$/);
    if (m) {
      label = m[1];
      v = v.slice(0, m.index);
    }
    const parts = v.trim().split('^');
    // 末尾の空文字は不要（"^リ^" のような場合）
    while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
    return { label, parts };
  });
}

/** ^ の数が偶数か（データ検証用） */
export function isValidKana(raw: string): boolean {
  return raw.split('／').every((v) => (v.match(/\^/g)?.length ?? 0) % 2 === 0);
}
