// comprehensive/（総合英語モードの教材。マスター、編集しない）を検証し、src/generated/comprehensive.json に1つにまとめる。
//   1. manifest.json のハッシュ（SHA-256）と件数を確かめる
//   2. *_schema.json で各ファイルを検証する
//   3. 参照（問題ID・項目ID・図解・会話・読解・文法）の整合性を確かめる
// 不正なデータはエラーとして止める（架空のデータで埋めない）。注意事項は警告として出す。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateSchema, checkReferences, countBundle, type RawBundle } from '../src/modes/comprehensive/validate.ts';
import type { CompData, Day, DayKind } from '../src/modes/comprehensive/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(here, '../comprehensive');
const OUT = resolve(here, '../src/generated/comprehensive.json');
const errors: string[] = [];
const warnings: string[] = [];

if (!existsSync(join(DIR, 'manifest.json'))) {
  console.error('comprehensive/manifest.json がありません（教材が未配置）');
  process.exit(1);
}
const read = (f: string) => JSON.parse(readFileSync(join(DIR, f), 'utf8'));
const manifest = read('manifest.json');

// 1. ハッシュ
for (const [f, h] of Object.entries<string>(manifest.files)) {
  const p = join(DIR, f);
  if (!existsSync(p)) errors.push(`manifest にあるファイルがない: ${f}`);
  else if (createHash('sha256').update(readFileSync(p)).digest('hex') !== h) warnings.push(`ハッシュが manifest と違う（変更あり）: ${f}`);
}

const b: RawBundle = {
  course: read('comprehensive_course.json'),
  curriculum: read('curriculum.json'),
  policy: read('learning_policy.json'),
  quality: read('quality_report.json'),
  visual: read('visual_reference.json'),
  grammar: read('grammar_reference.json'),
  pronunciation: read('pronunciation_reference.json'),
  conversation: read('conversation_reference.json'),
  reading: read('reading_reference.json'),
  paraphrase: read('paraphrase_reference.json'),
  expansion: read('sentence_expansion_reference.json'),
  questionResponse: read('question_response_reference.json'),
  vocabulary: read('vocabulary_reference.json'),
  assessment: read('assessment_reference.json'),
};

// 2. Schema
const schemas: [string, unknown][] = [
  ['comprehensive_schema.json', b.course],
  ['assessment_reference_schema.json', b.assessment],
  ['grammar_reference_schema.json', b.grammar],
  ['learning_policy_schema.json', b.policy],
  ['pronunciation_reference_schema.json', b.pronunciation],
  ['visual_reference_schema.json', b.visual],
];
for (const [f, data] of schemas) for (const i of validateSchema(read(f), data).slice(0, 20)) errors.push(`${f}: ${i.path} ${i.message}`);

// 3. 参照
for (const i of checkReferences(b).slice(0, 50)) errors.push(`参照: ${i.path} ${i.message}`);

// 件数（manifest と実ファイル。実ファイルを正とする）
const counts = countBundle(b);
for (const [k, v] of Object.entries(counts)) if (manifest.counts?.[k] !== undefined && manifest.counts[k] !== v) warnings.push(`件数が manifest と違う: ${k} manifest=${manifest.counts[k]} 実際=${v}`);
const unavailable = b.course.days.filter((d: any) => d.status !== 'available').map((d: any) => d.day);
if (unavailable.length) warnings.push(`未収録の日: ${unavailable.join(', ')}`);

if (errors.length) {
  console.error(`comprehensive: ${errors.length} 件のエラー`);
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}

const policyDay = new Map<number, any>(b.policy.days.map((d: any) => [d.day, d]));
const days: Day[] = b.course.days.map((d: any) => {
  const kind = (policyDay.get(d.day)?.kind ?? (b.curriculum.days.find((c: any) => c.day === d.day)?.kind === 'test' ? 'assessment' : 'lesson')) as DayKind;
  return { day: d.day, topic: d.topic, kind, grammar: d.grammar, itemIds: d.itemIds, questionIds: d.questionIds, reviewDays: d.reviewDays ?? [] };
});


const data: CompData = {
  release: manifest.release ?? b.course.release,
  counts,
  items: b.course.items,
  questions: b.course.questions,
  days,
  route: b.curriculum.route,
  profiles: b.policy.profiles,
  reviewOffsets: b.policy.reviewOffsets,
  aliases: b.quality.exactDuplicateQuestionAliases ?? {},
  sameEnglish: (b.quality.sameEnglishItemGroups ?? []).map((g: any[]) => g.map((x) => x.id)),
  visuals: b.visual.groups,
  grammar: b.grammar.groups,
  pronunciation: b.pronunciation.groups,
  pronunciationLimitations: b.pronunciation.playback?.limitations ?? '',
  scenarios: b.conversation.scenarios,
  readings: b.reading.documents,
  irregularVerbs: b.vocabulary.irregularVerbs ?? [],
  verbSenses: b.vocabulary.verbSenses ?? [],
  diagnostics: b.assessment.forms,
  diagScoring: { thresholds: b.assessment.scoring.thresholds },
  limitations: b.quality.limitations ?? [],
};

mkdirSync(dirname(OUT), { recursive: true });
const json = JSON.stringify(data);
writeFileSync(OUT, json);
for (const w of warnings) console.warn('⚠ ' + w);
console.log(
  `comprehensive: ${counts.items}項目 / 通常${counts.practiceQuestions}問 / 診断${counts.diagnosticQuestions}問 / 図解${counts.visualGroups} / ${counts.days}日 → ${Math.round(json.length / 1024)}KB`,
);
