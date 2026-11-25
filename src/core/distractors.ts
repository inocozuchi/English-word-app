// 4択の「まちがいの選択肢」を選ぶ汎用ロジック。
import type { Rng } from './rng.ts';
import { shuffle } from './rng.ts';

/** 意味の文字列を比較用の語句に分ける。（）内・〜・記号を除く */
export function meaningTokens(s: string): string[] {
  return s
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[〜~…「」『』]/g, '')
    .split(/[、，,・；;／/。\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** 語句の重なり: 同じ語句、または2文字以上の語句がもう一方に含まれる */
export function overlaps(a: readonly string[], b: readonly string[]): boolean {
  for (const x of a)
    for (const y of b) {
      if (x === y) return true;
      const [s, l] = x.length <= y.length ? [x, y] : [y, x];
      if (s.length >= 2 && l.includes(s)) return true;
    }
  return false;
}

export interface PickOptions<T> {
  /** 比較用の語句（正解と、選んだ選択肢どうしが重ならないようにする） */
  tokens: (t: T) => string[];
  /** 表示文字列（完全一致の重複を避ける） */
  text: (t: T) => string;
  /** 優先したい候補（同じ品詞など） */
  prefer?: (t: T) => boolean;
  /** 各段から取る最大数 */
  maxPerTier?: number[];
  n?: number;
  rng: Rng;
}

/**
 * tiers: 紛らわしい順に並べた候補の段（例: [同じ語源, 同じ章, 全体]）。
 * correctTokens: 正解の語句（正解のすべての意味）。これと重なる候補は除外する。
 */
export function pickDistractors<T>(
  correct: T,
  correctTokens: string[],
  tiers: readonly (readonly T[])[],
  o: PickOptions<T>,
): T[] {
  const n = o.n ?? 3;
  const out: T[] = [];
  const usedText = new Set([o.text(correct)]);
  const usedTokens: string[][] = [];
  const seen = new Set<T>([correct]);
  const ok = (t: T) => {
    if (seen.has(t) || usedText.has(o.text(t))) return false;
    const tk = o.tokens(t);
    if (tk.length === 0 || overlaps(tk, correctTokens)) return false;
    return !usedTokens.some((u) => overlaps(u, tk));
  };
  tiers.forEach((tier, ti) => {
    const max = o.maxPerTier?.[ti] ?? n;
    let taken = 0;
    let list = shuffle(tier, o.rng);
    if (o.prefer) list = [...list.filter(o.prefer), ...list.filter((t) => !o.prefer!(t))];
    for (const t of list) {
      if (out.length >= n || taken >= max) break;
      if (!ok(t)) {
        seen.add(t);
        continue;
      }
      seen.add(t);
      usedText.add(o.text(t));
      usedTokens.push(o.tokens(t));
      out.push(t);
      taken++;
    }
  });
  return out;
}
