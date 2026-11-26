// 図の中の「答えそのもの」の文字を伏せる（データは編集しない。表示のときだけ）。
// 反射版の図→語・語→図では、図の見出しに答えの語（例: 冠詞の図の「無冠詞」「a / an」「the」）が書いてあり、
// 読めば答えられてしまう。そこで、その図が表す語（図→語の answer・語→図の prompt_ja）と同じ文字を含む
// <text> を「？」にする。誤答の図も同じように伏せるので、名前を読んで消去法で選ぶこともできない。
import type { RQuestion } from './types.ts';

const isLatin = (s: string) => /^[A-Za-z][A-Za-z'-]*$/.test(s);

/** 語のラベルを伏せる単位に分ける（例: 「冠詞（無冠詞・a・the）」→ 冠詞・無冠詞・a・the） */
export function figureTerms(label: string): string[] {
  const parts = label
    .split(/[（）()・、,/／：:「」\s]+|(?<=[^\x00-\x7f])と(?=[^\x00-\x7f])/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out = new Set<string>();
  for (const p of parts) {
    if (isLatin(p)) out.add(p.toLowerCase());
    else if (p.length >= 2 && p !== 'と') {
      out.add(p);
      // 「五文型」の図は「第一文型…」と書いてあるので、頭の1字を除いた形（文型）も伏せる
      if (p.length >= 3 && !/^[A-Za-z]/.test(p)) out.add(p.slice(1));
      // 「to不定詞」のように英語が付いた語は、日本語の部分も
      const ja = p.replace(/^[A-Za-z-]+/, '');
      if (ja !== p && ja.length >= 2) out.add(ja);
    }
  }
  return [...out];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 文字列がどれかの語を含むか（英語は単語として、日本語は部分一致） */
export function hasTerm(text: string, terms: readonly string[]): boolean {
  const t = text.toLowerCase();
  const compact = t.replace(/\s+/g, ''); // 「to 不定詞」と「to不定詞」を同じに扱う
  return terms.some((k) => (isLatin(k) ? new RegExp(`(^|[^a-z])${escapeRe(k)}([^a-z]|$)`).test(t) : compact.includes(k.toLowerCase().replace(/\s+/g, ''))));
}

const decode = (s: string) =>
  s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** 「名前：説明」の名前とみなす長さ（例: 数えられる：輪郭がある → 「数えられる」を伏せ、「輪郭がある」は残す） */
export const LABEL_MAX = 8;

/**
 * SVG の <text> を伏せる。伏せた数も返す。
 *  - 語を含む <text> は中身を「？」に
 *  - 「名前：説明」の形（名前が短い）は、名前だけを「？」にして説明（コアイメージ）は残す
 */
export function maskSvg(svg: string, terms: readonly string[], { labels = true } = {}): { svg: string; masked: number } {
  let masked = 0;
  const out = svg.replace(/(<text\b[^>]*>)([\s\S]*?)(<\/text>)/g, (all, open: string, inner: string, close: string) => {
    if (terms.length && hasTerm(decode(inner), terms)) {
      masked++;
      return `${open}？${close}`;
    }
    if (labels && !inner.includes('<')) {
      const m = /^([^：]{1,8})：(.+)$/s.exec(inner);
      if (m && m[1].length <= LABEL_MAX) {
        masked++;
        return `${open}？：${m[2]}${close}`;
      }
    }
    return all;
  });
  return { svg: out, masked };
}

/** 図ごとの「その図が表す語」（同じ図に複数あればすべて） */
export function figureLabels(questions: readonly RQuestion[]): Map<string, string[]> {
  const m = new Map<string, Set<string>>();
  const add = (f: string | undefined, label: string | undefined) => {
    if (!f || !label) return;
    if (!m.has(f)) m.set(f, new Set());
    m.get(f)!.add(label);
  };
  for (const q of questions) {
    if (q.type === 'r_fig2word') add(q.figure, q.answer);
    if (q.type === 'r_word2fig') add(q.answer_figure, q.prompt_ja);
  }
  return new Map([...m].map(([f, s]) => [f, [...s]]));
}

/** viewBox の横 / 縦（わからなければ null） */
export function svgAspect(svg: string): number | null {
  const vb = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg);
  if (vb) return +vb[1] / +vb[2];
  const w = /<svg[^>]*\swidth="([\d.]+)"/.exec(svg), h = /<svg[^>]*\sheight="([\d.]+)"/.exec(svg);
  return w && h ? +w[1] / +h[1] : null;
}
