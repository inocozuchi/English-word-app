// 例文の中の見出し語（とその活用形）を探して強調するための分割。
// 語幹の前方一致だと cure → curious のような別語まで拾うので、活用形を列挙して単語単位で照合する。

/** 見出し語の活用形（複数形・三単現・過去形・進行形・比較級など）を列挙する */
export function inflections(word: string): string[] {
  const w = word.toLowerCase();
  const out = new Set([w, w + 's', w + 'es', w + 'ed', w + 'd', w + 'ing', w + 'er', w + 'est', w + 'ly']);
  if (w.endsWith('e')) {
    const s = w.slice(0, -1);
    out.add(s + 'ing').add(s + 'ed').add(s + 'er').add(s + 'est');
  }
  if (/[^aeiou]y$/.test(w)) {
    const s = w.slice(0, -1);
    out.add(s + 'ies').add(s + 'ied').add(s + 'ier').add(s + 'iest').add(s + 'ily');
  }
  // 子音字を重ねる（stop → stopped, refer → referred）
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(w)) {
    const c = w[w.length - 1];
    out.add(w + c + 'ed').add(w + c + 'ing').add(w + c + 'er');
  }
  return [...out];
}

export interface Seg {
  t: string;
  hit: boolean;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** text を見出し語に当たる部分とそれ以外に分ける。熟語（空白を含む）はそのまま照合する */
export function splitHighlight(text: string, word: string): Seg[] {
  if (!word) return [{ t: text, hit: false }];
  const forms = word.includes(' ') ? [word.toLowerCase()] : inflections(word);
  forms.sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![A-Za-z])(${forms.map(escape).join('|')})(?![A-Za-z])`, 'gi');
  const out: Seg[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ t: text.slice(last, m.index), hit: false });
    out.push({ t: m[0], hit: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), hit: false });
  return out;
}
