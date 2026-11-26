// data/etymology_words.json（マスター、編集しない）を読み込み、
// アプリで使いやすい形に変換して src/generated/words.json に書き出す。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKana, isValidKana } from '../src/modes/etymology/kana.ts';
import { classify } from '../src/modes/etymology/morph.ts';
import type { Dataset, Word, Root, Phrase, Chapter, Group } from '../src/modes/etymology/types.ts';

/** 語源の分解に接頭辞・語根・接尾辞を付ける（src/modes/etymology/morph.ts） */
function morph(w: any, r: any) {
  return classify(w.word, w.breakdown ?? [], { spellings: String(r.root || r.id).split(/\s*\/\s*/), isPrefix: r.category === '接頭辞' });
}
const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../data/etymology_words.json');
const OUT = resolve(here, '../src/generated/words.json');

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const warnings: string[] = [];

const chapterNos: number[] = raw.chapters.map((c: any) => c.no);
// 学習順: 章番号順 → 章内はJSON内の登場順
const rawRoots: any[] = [...raw.roots].sort(
  (a, b) => chapterNos.indexOf(a.chapter) - chapterNos.indexOf(b.chapter),
);

/** note に「語源的には〜」「別系統」とある掲載は、覚え方として併記されているだけの参考語 */
const isRefNote = (note: unknown) => typeof note === 'string' && /語源的には|別系統|別語源/.test(note);

const words: Word[] = [];
const wordByText = new Map<string, Word>();
const phrases: Phrase[] = [];
const roots: Root[] = [];

for (const r of rawRoots) {
  const root: Root = {
    id: r.id,
    root: r.root,
    meaning: r.meaning,
    meaningEn: r.meaningEn ?? '',
    chapter: r.chapter,
    category: r.category,
    intro: r.intro ?? '',
    memo: r.memo ?? '',
    note: r.note ?? null,
    words: [],
    refs: [],
    phrases: [],
    order: roots.length,
  };
  for (const w of r.words) {
    if (!isValidKana(w.kana)) warnings.push(`kana の ^ が対になっていない: ${w.word} ${w.kana}`);
    if (!w.defs?.length) warnings.push(`defs が空: ${w.word}`);
    const ref = isRefNote(w.note);
    const existing = wordByText.get(w.word);
    if (existing) {
      // 同じ単語が複数の語源に載っている → 1語として扱い、語源を追加
      if (!existing.roots.includes(root.id)) existing.roots.push(root.id);
      root.words.push(existing.id);
      if (ref) {
        existing.refIn.push(root.id);
        root.refs.push(existing.id);
      } else if (existing.refIn.includes(existing.roots[0])) {
        // 先に参考語として出てきた単語 → 本来の語源の内容（分解・意味など）を主にする
        existing.roots = [root.id, ...existing.roots.filter((id) => id !== root.id)];
        existing.breakdown = morph(w, r);
        existing.core = w.core ?? null;
        existing.defs = w.defs.map((d: any) => ({ pos: d.pos, ja: d.ja }));
        existing.examples = (w.examples ?? []).map((e: any) => ({ en: e.en, ja: e.ja }));
        existing.derivatives = (w.derivatives ?? []).map((d: any) => ({ word: d.word, pos: d.pos, ja: d.ja }));
      }
      continue;
    }
    const word: Word = {
      id: words.length,
      w: w.word,
      kana: parseKana(w.kana),
      roots: [root.id],
      breakdown: morph(w, r),
      core: w.core ?? null,
      defs: w.defs.map((d: any) => ({ pos: d.pos, ja: d.ja })),
      examples: (w.examples ?? []).map((e: any) => ({ en: e.en, ja: e.ja })),
      derivatives: (w.derivatives ?? []).map((d: any) => ({ word: d.word, pos: d.pos, ja: d.ja })),
      note: w.note ?? null,
      refIn: ref ? [root.id] : [],
      order: words.length,
    };
    words.push(word);
    wordByText.set(word.w, word);
    root.words.push(word.id);
    if (ref) root.refs.push(word.id);
  }
  for (const p of r.phrases ?? []) {
    const ph: Phrase = {
      id: phrases.length,
      en: p.en,
      ja: p.ja,
      examples: (p.examples ?? []).map((e: any) => ({ en: e.en, ja: e.ja })),
      root: root.id,
      order: phrases.length,
    };
    phrases.push(ph);
    root.phrases.push(ph.id);
  }
  roots.push(root);
}

// alsoIn が指す語源IDの存在確認
const rootIds = new Set(roots.map((r) => r.id));
for (const r of raw.roots) for (const w of r.words)
  for (const id of w.alsoIn ?? []) if (!rootIds.has(id)) warnings.push(`alsoIn の語源が見つからない: ${w.word} → ${id}`);

const chapters: Chapter[] = raw.chapters.map((c: any) => ({
  no: c.no,
  title: c.title,
  roots: roots.filter((r) => r.chapter === c.no).map((r) => r.id),
}));
for (const r of roots) if (!chapterNos.includes(r.chapter)) warnings.push(`章が見つからない: ${r.id} chapter=${r.chapter}`);

const groups: Group[] = (raw.groups ?? []).map((g: any) => ({
  id: g.id,
  title: g.title,
  words: g.words.map((w: any) => ({
    w: w.word,
    kana: parseKana(w.kana ?? ''),
    defs: w.defs ?? [],
    examples: (w.examples ?? []).map((e: any) => ({ en: e.en, ja: e.ja })),
  })),
}));

const out: Dataset = { title: raw.title, chapters, roots, words, phrases, groups };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));

for (const w of warnings) console.warn('⚠ ' + w);
console.log(
  `data: ${chapters.length}章 / ${roots.length}語源 / ${words.length}語 / ${phrases.length}熟語 / groups ${groups.length} → ${(JSON.stringify(out).length / 1024).toFixed(0)}KB`,
);
