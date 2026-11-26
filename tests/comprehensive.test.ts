// 総合英語モード: 教材の検証・採点・間隔反復・習熟度・日程・キュー・保存と再開・診断
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRng } from '../src/core/rng.ts';
import { review, type ItemState } from '../src/core/srs.ts';
import { dayNumber } from '../src/core/day.ts';
import { validateSchema, checkReferences, countBundle, type RawBundle } from '../src/modes/comprehensive/validate.ts';
import { autoGrade, normEn, normJa, choicesFromPrompt, wordDiff, hintFor, isOpenKind } from '../src/modes/comprehensive/grade.ts';
import {
  buildIndex,
  planSession,
  planReview,
  stageOf,
  keysOf,
  masteryOf,
  courseDayFor,
  COMP_SRS,
  INITIAL_DAY,
  AFTER_COURSE,
  profileFor,
  type PlanInput,
  type QRec,
  type Evidence,
} from '../src/modes/comprehensive/course.ts';
import { newSession, applyResult, advance, resumeCursor, recordPlan, isOk } from '../src/modes/comprehensive/session.ts';
import { diagAnswer, scoreDiag, compareDiag, type DiagState } from '../src/modes/comprehensive/diag.ts';
import type { CompData } from '../src/modes/comprehensive/types.ts';

const DIR = join(__dirname, '..', 'comprehensive');
const read = (f: string) => JSON.parse(readFileSync(join(DIR, f), 'utf8'));
const bundle = (): RawBundle => ({
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
});
const DATA: CompData = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'generated', 'comprehensive.json'), 'utf8'));
const IX = buildIndex(DATA);
const T = 20000;

describe('教材の検証', () => {
  const b = bundle();
  it('実ファイルの件数（manifest と同じ）', () => {
    expect(countBundle(b)).toEqual(read('manifest.json').counts);
  });
  it('Schema に合う', () => {
    for (const [f, d] of [
      ['comprehensive_schema.json', b.course],
      ['assessment_reference_schema.json', b.assessment],
      ['grammar_reference_schema.json', b.grammar],
      ['learning_policy_schema.json', b.policy],
      ['pronunciation_reference_schema.json', b.pronunciation],
      ['visual_reference_schema.json', b.visual],
    ] as const)
      expect(validateSchema(read(f), d), f).toEqual([]);
  });
  it('参照がすべて実在する', () => {
    expect(checkReferences(b)).toEqual([]);
  });
  it('不正なデータを見つける（Schema・参照）', () => {
    const bad = bundle();
    bad.course.questions[0].kind = 'quiz';
    delete bad.course.questions[1].acceptedAnswers;
    bad.course.questions[3].kind = 'listening';
    delete bad.course.questions[3].audioText;
    const errs = validateSchema(read('comprehensive_schema.json'), bad.course).map((e) => e.message).join('\n');
    expect(errs).toContain('quiz');
    expect(errs).toContain('acceptedAnswers');
    expect(errs).toContain('audioText');
    bad.course.days[0].questionIds.push('q-nope');
    bad.conversation.scenarios[0].nodes[0].choices[0].next = 'nowhere';
    const refs = checkReferences(bad).map((e) => e.message).join('\n');
    expect(refs).toContain('q-nope');
    expect(refs).toContain('nowhere');
  });
});

describe('採点の正規化', () => {
  it('大文字小文字・空白・文末の句読点・カーリー引用符', () => {
    expect(autoGrade('  i AM a student ', ['I am a student.']).verdict).toBe('correct');
    expect(autoGrade('I’m a student!', ["I'm a student."]).verdict).toBe('correct');
  });
  it('明示的な短縮形は同じに扱う', () => {
    expect(autoGrade("I'm a student", ['I am a student.']).verdict).toBe('correct');
    expect(autoGrade("She doesn't like it.", ['She does not like it.']).verdict).toBe('correct');
    expect(autoGrade("I can't swim", ['I cannot swim.']).verdict).toBe('correct');
    expect(autoGrade("It's raining", ['It is raining.']).verdict).toBe('correct');
    expect(normEn("Tom's bag")).toBe("tom's bag"); // 所有格はそのまま
  });
  it('否定・時制・単数複数・冠詞の違いは無視しない', () => {
    expect(autoGrade('I am not a student.', ['I am a student.']).verdict).toBe('mismatch');
    expect(autoGrade('I was a student.', ['I am a student.']).verdict).toBe('mismatch');
    expect(autoGrade('I have two cat.', ['I have two cats.']).verdict).toBe('mismatch');
    expect(autoGrade('I am student.', ['I am a student.']).verdict).toBe('mismatch');
  });
  it('複数の許容解答・日本語の答え', () => {
    expect(autoGrade('Could I have some water please', ['Water would be great, thanks.', 'Could I have some water, please?']).verdict).toBe('correct');
    expect(autoGrade('日本 ', ['日本']).verdict).toBe('correct');
    expect(normJa('週２回。')).toBe('週2回');
    expect(autoGrade('', ['x']).verdict).toBe('empty');
  });
  it('自由回答は自動で誤答にしない種類', () => {
    expect(isOpenKind('paraphrase')).toBe(true);
    expect(isOpenKind('translation', 'response')).toBe(true);
    expect(isOpenKind('recall')).toBe(false);
  });
  it('選択肢つきの聞き取り・語の違い・ヒント', () => {
    expect(choicesFromPrompt('聞こえた語を選ぶ：right / light', ['right'])).toEqual(['right', 'light']);
    expect(choicesFromPrompt('選ぶ', ['choose'])).toBeNull();
    expect(wordDiff('I am student', 'I am a student.').map((x) => x.same)).toEqual([true, true, true]);
    expect(wordDiff('I was a student', 'I am a student.').find((x) => !x.same)?.w).toBe('was');
    expect(hintFor('make sense')).toBe('m・・・ s・・・・');
  });
  it('全問題: 登録された答えはそれ自身と一致する', () => {
    for (const q of DATA.questions) for (const a of q.acceptedAnswers) expect(autoGrade(a, q.acceptedAnswers).verdict, q.id).toBe('correct');
  });
});

describe('間隔反復（0/1/3/7/14/30日）と習熟度', () => {
  it('正解で 1→3→7→14→30 日、まちがえると当日（0日）', () => {
    let s: ItemState | undefined;
    const gaps: number[] = [];
    let d = T;
    for (let k = 0; k < 6; k++) {
      s = review(s, true, d, d, COMP_SRS);
      gaps.push(s.due - d);
      d = s.due;
    }
    expect(gaps).toEqual([1, 3, 7, 14, 30, 30]);
    s = review(s, false, d, d, COMP_SRS);
    expect(s.box).toBe(0);
    expect(s.due).toBe(d);
  });
  it('ヒント・あやしいの正解では箱を進めない（間隔は最低1日）', () => {
    const s0 = review(undefined, true, T, T, COMP_SRS);
    const s1 = review(s0, true, T + 1, T + 1, COMP_SRS, 'low');
    expect(s1.box).toBe(s0.box);
    expect(s1.due).toBe(T + 2);
  });
  it('1回正解しただけでは定着にならない', () => {
    const st = review(undefined, true, T, T, COMP_SRS);
    expect(masteryOf(undefined, undefined)).toBe('unlearned');
    expect(masteryOf(undefined, { r: T })).toBe('recognition');
    expect(masteryOf(st, { rc: T })).toBe('recall');
    expect(masteryOf(st, { rc: T, u: T })).toBe('use');
    let s = st;
    for (let k = 0; k < 3; k++) s = review(s, true, s.due, s.due, COMP_SRS);
    expect(s.box).toBeGreaterThanOrEqual(4);
    expect(masteryOf(s, { rc: T })).toBe('retention');
    expect(masteryOf(s, { r: T })).toBe('recognition'); // 認識だけでは定着にしない
  });
});

describe('日程の進み方', () => {
  it('初日 → 学習した翌日に1日進む。同じ日は進まない', () => {
    let st = courseDayFor(INITIAL_DAY, T);
    expect(st.day).toBe(1);
    st = { ...st, progressed: true };
    expect(courseDayFor(st, T).day).toBe(1);
    st = courseDayFor(st, T + 1);
    expect(st.day).toBe(2);
  });
  it('休んだ日があっても1日しか進まない・進めていない日は進まない', () => {
    const st = courseDayFor({ day: 5, last: T, progressed: true }, T + 10);
    expect(st.day).toBe(6);
    expect(courseDayFor({ day: 5, last: T, progressed: false }, T + 3).day).toBe(5);
  });
  it('Day60 のあとは学習後の復習（61）で止まる', () => {
    expect(courseDayFor({ day: 60, last: T, progressed: true }, T + 1).day).toBe(AFTER_COURSE);
    expect(courseDayFor({ day: AFTER_COURSE, last: T, progressed: true }, T + 1).day).toBe(AFTER_COURSE);
  });
  it('日付は午前4時区切り（地方時）', () => {
    const a = new Date(2026, 3, 10, 3, 59).getTime();
    const b = new Date(2026, 3, 10, 4, 0).getTime();
    expect(dayNumber(b) - dayNumber(a)).toBe(1);
  });
});

const plan = (over: Partial<PlanInput> = {}) =>
  planSession({ ix: IX, minutes: 60, day: 1, today: T, rng: createRng(1), items: {}, ev: {}, qs: {}, convDone: {}, ...over });

describe('今日のキュー', () => {
  it('Day1・60分: 段階の順・予算の中・問題は重ならない', () => {
    const p = plan();
    const prof = profileFor(DATA, 60);
    const qn = p.tasks.filter((t) => t.type === 'question').length;
    expect(qn).toBeGreaterThan(10);
    expect(qn).toBeLessThanOrEqual(prof.budget.review + prof.budget.new + prof.budget.practice + prof.budget.finish);
    expect(new Set(p.tasks.map((t) => t.qid).filter(Boolean)).size).toBe(qn);
    const order = ['review', 'vocabulary', 'idiom', 'chunk', 'grammar', 'translation', 'paraphrase', 'listening', 'scenario', 'reading', 'mixed', 'retry'];
    const ranks = p.tasks.map((t) => order.indexOf(t.stage));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    // 新しい項目は学習カードが問題より先
    const firstLearn = p.tasks.findIndex((t) => t.type === 'learn');
    const its = p.tasks[firstLearn].itemId!;
    const rq = p.tasks.findIndex((t) => t.qid && IX.q.get(t.qid)!.itemIds.includes(its));
    expect(rq).toBeGreaterThan(firstLearn);
  });
  it('20分は必須（core）だけ・新規は上限まで', () => {
    const p = plan({ minutes: 20, day: 2 });
    const prof = profileFor(DATA, 20);
    for (const t of p.tasks) {
      const pri = t.qid ? IX.q.get(t.qid)!.priority : IX.item.get(t.itemId!)!.priority;
      expect(pri).toBe('core');
    }
    expect(p.tasks.filter((t) => t.type === 'learn').length).toBeLessThanOrEqual(Math.min(prof.newItemCap, prof.budget.new));
  });
  it('20分で残った必須は消化済みにせず、次の日に繰り越す', () => {
    const p1 = plan({ minutes: 20, day: 1 });
    // Day1 の一部だけ学習した状態で Day2 を始める
    const ev: Record<string, Evidence> = {};
    const qs: Record<string, QRec> = {};
    for (const t of p1.tasks) {
      if (t.itemId) ev[t.itemId] = { r: T };
      if (t.qid) qs[t.qid] = { n: 1, c: 1, l: T, ok: 1 };
    }
    const day1core = IX.day.get(1)!.itemIds.filter((id) => IX.item.get(id)!.priority === 'core' && !ev[id]);
    expect(day1core.length).toBeGreaterThan(0);
    const p2 = plan({ minutes: 60, day: 2, today: T + 1, ev, qs });
    const carried = p2.tasks.filter((t) => t.reason === 'carry');
    expect(carried.length).toBeGreaterThan(0);
    expect(carried.every((t) => (t.itemId ? IX.item.get(t.itemId)!.day : IX.q.get(t.qid!)!.day) === 1)).toBe(true);
  });
  it('復習がたまったら新規を減らす（一度に大量に出さない）', () => {
    const items: Record<string, ItemState> = {};
    for (const it of DATA.items.filter((i) => i.day < 10)) items[it.id] = { box: 1, due: T, seen: 1, correct: 1, wrong: 0, last: 1, lastOk: true };
    const p = plan({ day: 10, today: T, items, ev: Object.fromEntries(Object.keys(items).map((k) => [k, { r: T - 1 }])) });
    const prof = profileFor(DATA, 60);
    expect(p.backlog).toBe(true);
    expect(p.tasks.filter((t) => t.reason === 'due' || t.reason === 'prev').length).toBe(prof.budget.review);
    expect(p.tasks.filter((t) => t.type === 'learn').length).toBeLessThanOrEqual(Math.floor(Math.min(prof.newItemCap, prof.budget.new) / 2));
  });
  it('総合復習の日（Day7）は新規なし・前の日々から技能を混ぜる', () => {
    const qs: Record<string, QRec> = {};
    for (const id of DATA.days.filter((d) => d.day < 7).flatMap((d) => d.questionIds)) qs[id] = { n: 1, c: 1, l: T - 1, ok: 1 };
    const p = plan({ day: 7, qs });
    expect(p.tasks.some((t) => t.type === 'learn')).toBe(false);
    expect(p.tasks.length).toBeGreaterThan(10);
    expect(new Set(p.tasks.map((t) => IX.q.get(t.qid!)!.kind)).size).toBeGreaterThan(2);
    expect(p.tasks.every((t) => IX.q.get(t.qid!)!.day < 7)).toBe(true);
  });
  it('Day60 のあと（61）も復習として使える', () => {
    const qs: Record<string, QRec> = {};
    for (const q of DATA.questions.slice(0, 400)) qs[q.id] = { n: 1, c: 0, l: T - 1, ok: 0 };
    const p = plan({ day: AFTER_COURSE, qs });
    expect(p.tasks.length).toBeGreaterThan(0);
    expect(p.tasks.some((t) => t.type === 'learn')).toBe(false);
  });
  it('重複問題の別名は同じセッションに入れない', () => {
    for (const [a, c] of Object.entries(DATA.aliases)) {
      const d = IX.q.get(a)!.day;
      const qs: Record<string, QRec> = {};
      const p = plan({ day: Math.max(d, IX.q.get(c)!.day), minutes: 120, qs });
      const ids = p.tasks.map((t) => t.qid);
      expect(ids.includes(a) && ids.includes(c), `${a} ${c}`).toBe(false);
    }
  });
  it('会話の問題があれば、通しの会話を先に（補助練習）', () => {
    const scen = DATA.scenarios[0];
    const p = plan({ day: scen.day, minutes: 120 });
    if (p.tasks.some((t) => t.qid && IX.q.get(t.qid)!.conversationId === scen.id)) {
      const ci = p.tasks.findIndex((t) => t.scenarioId === scen.id);
      const qi = p.tasks.findIndex((t) => t.qid && IX.q.get(t.qid)!.conversationId === scen.id);
      expect(ci).toBeGreaterThanOrEqual(0);
      expect(ci).toBeLessThan(qi);
    }
  });
  it('全問題に段階がある・記録の単位は itemIds か問題ID', () => {
    for (const q of DATA.questions) expect(stageOf(IX, q)).toBeTruthy();
    const noItem = DATA.questions.find((q) => !q.itemIds.length)!;
    expect(keysOf(noItem)).toEqual([noItem.id]);
  });
  it('復習リストだけのキュー', () => {
    const q = DATA.questions[0];
    const t = planReview(IX, [q.itemIds[0] ?? q.id], {}, createRng(1), 20);
    expect(t).toHaveLength(1);
  });
});

describe('保存と再開', () => {
  const p = plan();
  const s0 = newSession({ id: 's1', date: T, day: 1, kind: 'normal', minutes: 60, tasks: p.tasks });
  it('答えたタスクは飛ばして再開・同じタスクに2回書かない', () => {
    const t0 = s0.tasks[0];
    let s = applyResult(s0, t0.id, { v: 'seen', hints: 0, ms: 1000 });
    expect(resumeCursor(s)).toBe(1);
    const again = applyResult(s, t0.id, { v: 'correct', hints: 0, ms: 1 });
    expect(again).toBe(s);
    s = advance(s);
    expect(s.cursor).toBe(1);
    // JSON に保存して読み戻しても同じ位置
    const restored = JSON.parse(JSON.stringify(s));
    expect(resumeCursor(restored)).toBe(1);
  });
  it('まちがえた問題は最後の「間違い直し」に1回だけ足す', () => {
    const tq = s0.tasks.find((t) => t.type === 'question')!;
    let s = applyResult(s0, tq.id, { v: 'wrong', hints: 0, ms: 5000 });
    expect(s.tasks.at(-1)!.id).toBe(tq.id + '#r');
    s = applyResult(s, tq.id + '#r', { v: 'wrong', hints: 0, ms: 5000 });
    expect(s.tasks.filter((t) => t.id.startsWith(tq.id)).length).toBe(2);
  });
  it('記録の内容: 項目ごと・ヒント・自己採点・音声不可は SRS に入れない', () => {
    const tq = s0.tasks.find((t) => t.type === 'question' && IX.q.get(t.qid!)!.itemIds.length)!;
    const r1 = recordPlan(IX, s0, tq, { v: 'correct', hints: 1, ms: 3000 }, T, { ev: {}, qs: {} });
    expect(r1.uid).toBe(`s1:${tq.id}`);
    expect(r1.entries.map((e) => e.key)).toEqual(IX.q.get(tq.qid!)!.itemIds);
    expect(r1.entries[0].conf).toBe('low');
    expect(Object.values(r1.ev)[0].h).toBe(1);
    expect(Object.values(r1.ev)[0].rc).toBeUndefined(); // ヒントありの正解は想起の証拠にしない
    const r2 = recordPlan(IX, s0, tq, { v: 'self-correct', hints: 0, ms: 3000 }, T, { ev: {}, qs: {} });
    expect(r2.tags).toContain('self');
    const r3 = recordPlan(IX, s0, tq, { v: 'audio-unavailable', hints: 0, ms: 0 }, T, { ev: {}, qs: {} });
    expect(r3.entries).toEqual([]);
    expect(r3.audioNA).toBe(tq.qid);
    expect(isOk('self-partial')).toBe(true);
    expect(isOk('skipped')).toBe(false);
  });
});

describe('診断（Day0 / Day60）', () => {
  const form = DATA.diagnostics[0];
  it('30問ずつ・7分野', () => {
    expect(DATA.diagnostics.map((f) => f.questions.length)).toEqual([30, 30]);
  });
  it('自動・自己採点・未回答・音声不可を分けて数え、音声不可は分母から外す', () => {
    const st: DiagState = { form: 'baseline', startedAt: 0, cursor: 0, answers: {} };
    for (const q of form.questions) {
      if (q.domain === 'listening') st.answers[q.id] = { v: 'audio-unavailable', ms: 0 };
      else if (q.domain === 'vocabulary') st.answers[q.id] = diagAnswer(q, q.acceptedAnswers[0], 2000);
      else if (q.domain === 'paraphrase') st.answers[q.id] = { ...diagAnswer(q, 'something', 3000), selfOk: true };
    }
    const sc = scoreDiag(form, st);
    const v = sc.find((s) => s.domain === 'vocabulary')!;
    expect(v.rate).toBe(1);
    const l = sc.find((s) => s.domain === 'listening')!;
    expect(l.rate).toBeNull();
    expect(l.coverage).toBe(0);
    const p = sc.find((s) => s.domain === 'paraphrase')!;
    expect(p.self).toBe(p.total);
    expect(sc.find((s) => s.domain === 'grammar')!.skipped).toBe(sc.find((s) => s.domain === 'grammar')!.total);
    // 比べるのは両方で答えた分野だけ（音声不可のリスニングは比べない）
    const cmp = compareDiag(sc, sc);
    expect(cmp.some((c) => c.domain === 'listening')).toBe(false);
    expect(cmp.some((c) => c.domain === 'vocabulary')).toBe(true);
  });
});
