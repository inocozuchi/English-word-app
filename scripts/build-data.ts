// data/etymology_words.json（マスター、編集しない）を読み込み、
// アプリで使いやすい形に変換して src/generated/words.json に書き出す。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKana, isValidKana } from '../src/lib/kana.ts';
import type { Dataset, Word, Root, Phrase, Chapter, Group } from '../src/lib/types.ts';

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
    phrases: [],
    order: roots.length,
  };
  for (const w of r.words) {
    if (!isValidKana(w.kana)) warnings.push(`kana の ^ が対になっていない: ${w.word} ${w.kana}`);
    if (!w.defs?.length) warnings.push(`defs が空: ${w.word}`);
    const existing = wordByText.get(w.word);
    if (existing) {
      // 同じ単語が複数の語源に載っている → 1語として扱い、語源を追加
      if (!existing.roots.includes(root.id)) existing.roots.push(root.id);
      root.words.push(existing.id);
      continue;
    }
    const word: Word = {
      id: words.length,
      w: w.word,
      kana: parseKana(w.kana),
      roots: [root.id],
      breakdown: w.breakdown ?? [],
      core: w.core ?? null,
      defs: w.defs.map((d: any) => ({ pos: d.pos, ja: d.ja })),
      examples: (w.examples ?? []).map((e: any) => ({ en: e.en, ja: e.ja })),
      derivatives: (w.derivatives ?? []).map((d: any) => ({ word: d.word, pos: d.pos, ja: d.ja })),
      note: w.note ?? null,
      order: words.length,
    };
    words.push(word);
    wordByText.set(word.w, word);
    root.words.push(word.id);
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
