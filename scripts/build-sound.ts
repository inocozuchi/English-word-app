// data/sound_changes.json（マスター、編集しない）を読み込み、
// アプリで使う形に変換して src/generated/sound.json に書き出す。データの不整合は警告する。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { moraCount } from '../src/modes/sound/mora.ts';
import type { SoundData, Item, RuleId } from '../src/modes/sound/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../data/sound_changes.json');
const OUT = resolve(here, '../src/generated/sound.json');
const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const warnings: string[] = [];

const ruleIds = new Set<string>(raw.rules.map((r: any) => r.id));
const lectureNos = new Set<number>(raw.lectures.map((l: any) => l.no));

const items: Item[] = raw.items.map((it: any, order: number) => {
  const rules: RuleId[] = [];
  for (const c of it.changes ?? []) {
    if (!ruleIds.has(c.rule)) warnings.push(`未知のルール: ${it.id} ${c.rule}`);
    if (!rules.includes(c.rule)) rules.push(c.rule);
    if (!it.text.toLowerCase().includes(c.span.toLowerCase())) warnings.push(`span が英文に見つからない: ${it.id}「${c.span}」（英文: ${it.text}）`);
  }
  for (const m of it.marks ?? []) {
    const w = it.words[m.word];
    if (w === undefined || (m.type === 'link' && it.words[m.word + 1] === undefined)) warnings.push(`marks の単語番号が範囲外: ${it.id}`);
    if (m.type !== 'link' && (m.from === undefined || m.to === undefined || m.to > (w?.length ?? 0) || m.from >= m.to))
      warnings.push(`marks の文字範囲が不正: ${it.id} ${JSON.stringify(m)}`);
  }
  const options = [it.kana, it.plain, ...(it.decoys ?? [])];
  if (it.quiz && new Set(options).size !== 4) warnings.push(`聞こえ方の選択肢が4つにならない: ${it.id}`);
  if (it.alt && options.includes(it.alt)) warnings.push(`別の聞こえ方（alt）が選択肢と重なる: ${it.id}`);
  if (!lectureNos.has(it.lecture)) warnings.push(`講が見つからない: ${it.id}`);
  return { ...it, rules, mora: moraCount(it.kana), order };
});

const texts = new Map<string, string>();
for (const it of items) {
  if (texts.has(it.text)) warnings.push(`同じ英文の項目: ${texts.get(it.text)} と ${it.id}`);
  texts.set(it.text, it.id);
}
for (const t of raw.tFate) {
  const w = t.words[t.target.word];
  if (!w || t.target.to > w.length || !/t/i.test(w.slice(t.target.from, t.target.to))) warnings.push(`tFate の target が t を指していない: ${t.id}`);
  if (!raw.fateLabels[t.fate]) warnings.push(`tFate の fate が不明: ${t.id}`);
}
for (const c of raw.concepts) if (new Set([c.answer, ...c.wrong]).size !== 4) warnings.push(`知識問題の選択肢が4つにならない: ${c.id}`);

const out: SoundData = {
  title: raw.title,
  rules: raw.rules,
  lectures: raw.lectures,
  items,
  contractions: raw.contractions,
  assimilations: raw.assimilations,
  tFate: raw.tFate,
  fateLabels: raw.fateLabels,
  compounds: raw.compounds,
  symptoms: raw.symptoms,
  concepts: raw.concepts,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
for (const w of warnings) console.warn('⚠ ' + w);
console.log(
  `sound: ${items.length}フレーズ / 短縮形 ${out.contractions.length} / 同化 ${out.assimilations.length} / tの行方 ${out.tFate.length} / 複合 ${out.compounds.length} / 症状 ${out.symptoms.length} / 知識 ${out.concepts.length} → ${(JSON.stringify(out).length / 1024).toFixed(0)}KB`,
);
