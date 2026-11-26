// 採点（UI に依存しない。tests/comprehensive.test.ts）
// 正規化するのは「意味の変わらない違い」だけ:
//   大文字小文字・空白・文末の句読点（. ? ! 。）・前後の引用符・語中のカンマ・カーリー引用符・明示的な短縮形（I'm = I am など）
// 否定・時制・単数複数・冠詞などの違いは正規化しない（違えば「一致しない」→ 模範解答と比べて自己採点）。
// 一致しないことは「不正解」と同じではない。自由に書く問題（言い換えなど）は必ず自己採点にする。

const N_T: Record<string, string> = {
  "can't": 'can not',
  cannot: 'can not',
  "won't": 'will not',
  "shan't": 'shall not',
};
const PRONOUN_S = new Set(['he', 'she', 'it', 'that', 'what', 'there', 'here', 'who', 'where', 'how', 'when', 'why', 'this']);

/** 英語の短縮形を展開する（両方の答えに同じ展開をしてから比べる） */
export function expandContractions(s: string): string {
  return s
    .split(' ')
    .map((w) => {
      if (w in N_T) return N_T[w];
      if (w === "let's") return 'let us';
      if (w === "i'm") return 'i am';
      let m = /^([a-z]+)n't$/.exec(w);
      if (m) return `${m[1]} not`;
      m = /^([a-z]+)'(re|ve|ll|d)$/.exec(w);
      if (m) return `${m[1]} ${{ re: 'are', ve: 'have', ll: 'will', d: 'would' }[m[2] as 're']}`;
      m = /^([a-z]+)'s$/.exec(w);
      if (m && PRONOUN_S.has(m[1])) return `${m[1]} is`;
      return w;
    })
    .join(' ');
}

/** 英語の答えの正規化 */
export function normEn(s: string): string {
  let t = s
    .normalize('NFKC')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .trim();
  t = t.replace(/^["'(\s]+|["')\s]+$/g, '');
  t = t.replace(/[.?!。？！]+$/g, '').trim();
  t = t.replace(/\s*,\s*/g, ' ').replace(/\s+([.?!;:])/g, '$1').replace(/\s+/g, ' ').trim();
  return expandContractions(t);
}

const hasJa = (s: string) => /[぀-ヿ㐀-鿿]/.test(s);

/** 日本語を含む答えの正規化（全角半角・空白・句読点） */
export function normJa(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[。、．，・「」『』（）()!！?？.,]/g, '');
}

export const normalize = (s: string) => (hasJa(s) ? normJa(s) : normEn(s));

export type AutoVerdict = 'correct' | 'mismatch' | 'empty';

/** 入力が登録された答えのどれかに一致するか */
export function autoGrade(input: string, accepted: readonly string[]): { verdict: AutoVerdict; matched?: string } {
  if (!input.trim()) return { verdict: 'empty' };
  const n = normalize(input);
  for (const a of accepted) if (normalize(a) === n) return { verdict: 'correct', matched: a };
  // 日本語で答える問題に英語で答えた・その逆は、それぞれの正規化でもう一度比べる
  const en = normEn(input), ja = normJa(input);
  for (const a of accepted) if (normEn(a) === en || normJa(a) === ja) return { verdict: 'correct', matched: a };
  return { verdict: 'mismatch' };
}

/** 自由に書く問題（自動の不一致を誤答にしない）。言い換え・会話の返答・自己採点の診断 */
export const isOpenKind = (kind: string, subtype?: string) => kind === 'paraphrase' || subtype === 'response';

/** 語単位の違い（模範解答と比べて表示する）。same = 一致した語 */
export function wordDiff(input: string, model: string): { w: string; same: boolean }[] {
  const a = normEn(input).split(' ').filter(Boolean);
  const b = normEn(model).split(' ').filter(Boolean);
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { w: string; same: boolean }[] = [];
  let i = 0, j = 0;
  while (i < a.length) {
    if (j < b.length && a[i] === b[j]) {
      out.push({ w: a[i], same: true });
      i++;
      j++;
    } else if (j < b.length && dp[i][j + 1] >= dp[i + 1][j]) j++;
    else out.push({ w: a[i++], same: false });
  }
  return out;
}

/** 「聞こえた語を選ぶ：right / light」のような問題の選択肢（なければ null） */
export function choicesFromPrompt(prompt: string, accepted: readonly string[]): string[] | null {
  const m = /選ぶ\s*[：:]\s*(.+)$/.exec(prompt.trim());
  if (!m) return null;
  const opts = m[1].split(/\s*\/\s*/).map((x) => x.trim()).filter(Boolean);
  if (opts.length < 2 || !accepted.some((a) => opts.some((o) => normalize(o) === normalize(a)))) return null;
  return opts;
}

/** ヒント（最初の文字と文字数） */
export function hintFor(answer: string): string {
  return answer
    .split(' ')
    .map((w) => (w.length <= 1 ? w : w[0] + '・'.repeat(Math.min(w.length - 1, 12))))
    .join(' ');
}
