// data/chunks.json（マスター、編集しない）を読み込み、src/generated/chunks.json に書き出す。不整合は警告する。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChunkData, Entry } from '../src/modes/chunks/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../data/chunks.json');
const OUT = resolve(here, '../src/generated/chunks.json');
const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const warnings: string[] = [];

const nums = new Set<number>(raw.entries.map((e: any) => e.num));
const sections = new Set<number>(raw.sections.map((s: any) => s.no));

const entries: Entry[] = raw.entries.map((e: any) => {
  for (const k of ['near', 'sameMeaning', 'similarMeaning'] as const)
    for (const n of e[k] ?? []) if (!nums.has(n)) warnings.push(`${k} の番号が見つからない: ${e.id} → ${n}`);
  if (!sections.has(e.section)) warnings.push(`章が見つからない: ${e.id}`);
  if (!['A', 'B', 'C'].includes(e.priority)) warnings.push(`優先度が不明: ${e.id}`);
  if (e.blank && (e.blank.text.match(/＿＿＿＿/g) ?? []).length !== 1) warnings.push(`穴埋めの ＿＿＿＿ が1つでない: ${e.id}`);
  const bad = new Set([...(e.sameMeaning ?? []), ...(e.similarMeaning ?? [])]);
  if ((e.near ?? []).some((n: number) => bad.has(n))) warnings.push(`near に意味の重なる表現が入っている: ${e.id}`);
  const out: Entry = {
    id: e.id,
    num: e.num,
    section: e.section,
    priority: e.priority,
    chunk: e.chunk,
    bare: e.bare,
    ex: e.ex,
    meaning: e.meaning,
    exJa: e.exJa,
    note: e.note ?? '',
    region: e.region ?? [],
    style: e.style ?? [],
    blank: e.blank ?? null,
    sameMeaning: e.sameMeaning ?? [],
    similarMeaning: e.similarMeaning ?? [],
    ambiguous: !!e.ambiguous,
    near: e.near ?? [],
  };
  if (e.gloss) out.gloss = e.gloss;
  if (e.crossRef) out.crossRef = e.crossRef;
  return out;
});
for (const p of raw.pairs) for (const r of p.refs ?? []) if (r !== null && !nums.has(r)) warnings.push(`pairs の refs が見つからない: ${p.id} → ${r}`);

const out: ChunkData = { title: raw.title, priorities: raw.priorities, sections: raw.sections, entries, pairs: raw.pairs };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
for (const w of warnings) console.warn('⚠ ' + w);
const count = (p: string) => entries.filter((e) => e.priority === p).length;
console.log(
  `chunks: ${entries.length}表現（A ${count('A')} / B ${count('B')} / C ${count('C')}）/ ${out.sections.length}章 / 使い分け ${out.pairs.length}組 → ${(JSON.stringify(out).length / 1024).toFixed(0)}KB`,
);
