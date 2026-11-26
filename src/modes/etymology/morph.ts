// 語の成り立ちを「接頭辞・語根・接尾辞」に分ける（データの breakdown を使い、編集はしない）。
// scripts/build-data.ts がビルド時に使い、words.json の各パーツに kind を付ける。tests/morph.test.ts。
//
// 決め方:
//   1. その語が載っている語源（語根）の綴りに合うパーツ = 語根（語源が「接頭辞」の章のものは除く）
//   2. 見つからなければ、先頭から接頭辞を飛ばした最初のパーツ = 語根
//   3. 語根より前 = 接頭辞（よく知られた接頭辞でなければ、もう1つの語根: manu + cure など）
//      語根より後 = 接尾辞（よく知られた接尾辞でなければ、もう1つの語根）
//   4. パーツをつなげても単語の終わりが余るとき（例: alternative = alter + na + tive）、余りが接尾辞なら足す
//   接尾辞の意味がデータで空のときは、接尾辞の働き（名詞化・〜できる など）を入れる
export type PartKind = 'pre' | 'root' | 'suf' | 'link';
export interface MorphPart {
  part: string;
  meaning: string;
  kind: PartKind;
  /** データにない（単語の余りから足した・意味を補った） */
  added?: boolean;
}

export const KIND_LABEL: Record<PartKind, string> = { pre: '接頭辞', root: '語根', suf: '接尾辞', link: 'つなぎ' };

export const PREFIXES = new Set(
  (
    'a ab abs ac ad af ag al an ana ante anti ap ar as at auto bene bi circum co col com con contra cor counter de di dia dif dis dys ' +
    'e ec ef em en epi ex extra fore hyper hypo il im in inter intro ir mal micro mis mono multi ne non ob oc of op out over par para per ' +
    'peri post pre pro pur re retro se semi sub suc suf sug sum sup sur sus sym syn tele trans tri ultra un uni up with'
  ).split(' '),
);

/** 接尾辞と、その働き（データに意味がないときに使う） */
export const SUFFIXES: Record<string, string> = {
  ation: '名詞化', ition: '名詞化', tion: '名詞化', sion: '名詞化', ion: '名詞化', ment: '名詞化', ness: '名詞化',
  ity: '名詞化（状態）', ty: '名詞化（状態）', ance: '名詞化', ence: '名詞化', ancy: '名詞化', ency: '名詞化',
  ure: '名詞化', age: '名詞化', y: '名詞化', ice: '名詞化', ism: '〜主義', ist: '〜する人', ee: '〜される人',
  er: '〜する人・もの', or: '〜する人・もの', ar: '〜の', ant: '〜する（人）', ent: '〜している', ient: '〜している',
  ate: '動詞化（〜にする）', uate: '動詞化（〜にする）', ify: '動詞化（〜にする）', fy: '動詞化（〜にする）',
  ize: '動詞化（〜にする）', ise: '動詞化', ish: '動詞化', en: '動詞化',
  al: '〜の（形容詞化）', ial: '〜の（形容詞化）', ual: '〜の（形容詞化）', ical: '〜の（形容詞化）', ic: '〜の（形容詞化）',
  ous: '〜に満ちた（形容詞化）', ious: '〜に満ちた（形容詞化）', eous: '〜の性質の', uous: '〜の性質の', aneous: '〜の性質の',
  ive: '〜の性質の（形容詞化）', tive: '〜の性質の（形容詞化）', ative: '〜の性質の（形容詞化）',
  able: '〜できる', ible: '〜できる', ble: '〜できる', ile: '〜できる・〜の', id: '〜の状態の',
  ary: '〜に関する（もの）', ory: '〜に関する（もの・場所）', ery: '〜の場所・もの', um: 'もの',
  ful: '〜に満ちた', less: '〜のない', ly: '〜のように（副詞化）', ward: '〜の方へ', some: '〜しがちな',
  logy: '〜学', cle: '小さいもの', cule: '小さいもの', ule: '小さいもの', let: '小さいもの', ling: '小さいもの',
  ute: '〜された', ite: '〜された', ing: '〜すること', ed: '〜された', est: '最も',
  ator: '〜する人・もの', itor: '〜する人・もの', ster: '〜する人', ture: '名詞化', ature: '名詞化',
  ics: '〜学', etics: '〜学', tic: '〜の（形容詞化）', etic: '〜の（形容詞化）', istic: '〜の（形容詞化）',
  ility: '名詞化（できること）', acity: '名詞化（性質）', itude: '名詞化（状態）', ium: 'もの・場所', orium: '場所',
  atory: '〜する場所・〜の', ulum: 'もの', ula: '小さいもの', icle: '小さいもの', us: '語尾', ue: '語尾',
  ain: '語尾', an: '〜の（人）', ian: '〜の（人）', ine: '〜の', ably: '〜できるように', ibly: '〜できるように',
};

/** 接頭辞の意味によくある言い方（語根より前のパーツが、知らない接頭辞でもこれなら接頭辞とみなす） */
const PREFIX_MEANING = /^(〜に|〜へ|ない|否定|反対|逆|上|下|前|後|外|中|内|共|一緒|離|越|超|周|間|の間|再|繰り返|そば|向こう|すっかり|完全|強意|十分|悪|悪く|分離|除|半|多|全|自ら)/;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
const isSuffix = (p: string) => p in SUFFIXES;
/** 接尾辞の意味によくある言い方（語根より後のパーツ） */
const SUFFIX_MEANING = /^〜?(人|もの|こと|場所|学|状態|性質の?|最も|の|する|にする|される|できる|できること|できるように|しやすい|している|された|ように|小さい|小さいもの|に関する(もの)?|形容詞語尾|語尾)$/;

/** 語根より前のパーツが接頭辞か（よく知られた接頭辞・「=ex 外に」のような注記・接頭辞らしい意味） */
function looksPrefix(part: string, meaning: string): boolean {
  if (PREFIXES.has(part)) return true;
  const ref = /^=\s*([a-z]+)/i.exec(meaning.trim());
  if (ref) return PREFIXES.has(ref[1].toLowerCase());
  return PREFIX_MEANING.test(meaning.trim().replace(/^[…〜]+/, ''));
}
/** 語根より後のパーツが接尾辞か（よく知られた接尾辞・意味が空・接尾辞らしい意味） */
function looksSuffix(part: string, meaning: string): boolean {
  const m = meaning.trim();
  return isSuffix(part) || !m || SUFFIX_MEANING.test(m);
}

/** 語根の綴りに合うか（「cede / ceed / cess」のような書き方・語形の揺れも少し許す） */
function matchesRoot(part: string, spellings: readonly string[]): boolean {
  if (!part) return false;
  return spellings.some((r) => r === part || (r.length >= 3 && part.length >= 3 && (part.startsWith(r) || r.startsWith(part) || part.includes(r))));
}

export interface RootInfo {
  /** 語根の綴り（"cede / ceed / cess" は分けて渡す） */
  spellings: string[];
  /** 語源の章が「接頭辞」（trans など）。そのときは語源に合うパーツは接頭辞 */
  isPrefix: boolean;
}

/** パーツに接頭辞・語根・接尾辞を付ける */
export function classify(word: string, parts: readonly { part: string; meaning: string }[], root: RootInfo): MorphPart[] {
  const ps = parts.map((p) => norm(p.part));
  const n = ps.length;
  if (!n) return [];
  const spell = root.spellings.map(norm).filter(Boolean);
  // 語源そのものが接頭辞（trans・de・ex など）なら、語源に合うパーツは接頭辞
  const prefixEntry = root.isPrefix || (n > 1 && spell.some((r) => PREFIXES.has(r)));
  let rootIdx = prefixEntry ? -1 : ps.findIndex((p) => matchesRoot(p, spell));
  if (rootIdx < 0) {
    // 先頭の接頭辞を飛ばした最初のパーツ（語源が接頭辞の章なら、その接頭辞のパーツも飛ばす）
    rootIdx = ps.findIndex((p, i) => !(looksPrefix(p, parts[i].meaning ?? '') || (prefixEntry && matchesRoot(p, spell))) && !(i > 0 && isSuffix(p) && i === n - 1 && n > 2));
    if (rootIdx < 0) rootIdx = n - 1;
  }
  const out: MorphPart[] = parts.map((p, i) => {
    const q = ps[i];
    let kind: PartKind;
    if (i === rootIdx) kind = 'root';
    // 語と語の間の1文字（sign + i + fic の i）はつなぎ
    else if (i > 0 && i < n - 1 && q.length === 1 && !(p.meaning ?? '').trim()) kind = 'link';
    else if (i < rootIdx) kind = looksPrefix(q, p.meaning ?? '') || (prefixEntry && matchesRoot(q, spell)) ? 'pre' : 'root';
    // 語根より後: 最後のパーツは接尾辞らしければ接尾辞。途中のパーツはよく知られた接尾辞だけ
    else kind = (i === n - 1 ? looksSuffix(q, p.meaning ?? '') : isSuffix(q) && looksSuffix(q, p.meaning ?? '')) ? 'suf' : 'root';
    const meaning = p.meaning?.trim() ?? '';
    if (kind === 'suf' && !meaning) return { part: p.part, meaning: SUFFIXES[q] ?? '語尾', kind, added: true };
    return { part: p.part, meaning, kind };
  });
  // 単語の終わりが余る（パーツに書かれていない接尾辞）
  const joined = ps.join('');
  const w = norm(word);
  if (joined && w.startsWith(joined) && w.length > joined.length) {
    const rest = w.slice(joined.length);
    if (rest.length >= 2 && isSuffix(rest)) out.push({ part: rest, meaning: SUFFIXES[rest], kind: 'suf', added: true });
  }
  return out;
}

/** 単語の綴りをパーツごとに色分けするための区切り（合わせられなければ null） */
export function segments(word: string, parts: readonly MorphPart[]): { text: string; kind: PartKind }[] | null {
  const lower = word.toLowerCase();
  const out: { text: string; kind: PartKind }[] = [];
  let pos = 0;
  for (const p of parts) {
    // 「(s)pect」→ spect / pect、「=ex 外に」のような書き方は文字だけ
    const raw = p.part.toLowerCase();
    const cands = [norm(raw), norm(raw.replace(/\([^)]*\)/g, ''))].filter(Boolean);
    const c = cands.find((x) => lower.startsWith(x, pos));
    if (!c) return null;
    out.push({ text: word.slice(pos, pos + c.length), kind: p.kind });
    pos += c.length;
  }
  if (pos < word.length) {
    const rest = word.slice(pos);
    if (rest.length > 2) return null;
    // 1〜2文字の余り（語末の e など）は直前のパーツに含める
    out[out.length - 1].text += rest;
  }
  return out;
}
