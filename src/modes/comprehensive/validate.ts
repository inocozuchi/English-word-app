// 教材データの検証（ビルド時と単体テストで使う。UI に依存しない）
//   - JSON Schema の検証（教材の *_schema.json が使っている範囲: type / required / properties / enum / const /
//     minLength / minimum / maximum / items / minItems / maxItems / uniqueItems / additionalProperties / allOf + if/then）
//   - 参照の検査（日程・図解・会話・読解・文法などが指す問題ID・項目IDが実在するか）
export interface Issue {
  path: string;
  message: string;
}

const typeOf = (v: unknown) => (Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v);
function isType(v: unknown, t: string) {
  const a = typeOf(v);
  return a === t || (t === 'number' && (a === 'integer' || a === 'number')) || (t === 'integer' && a === 'integer');
}

/** schema にデータが合うか（合わない箇所を返す） */
export function validateSchema(schema: any, data: unknown, path = '$', out: Issue[] = []): Issue[] {
  if (!schema || typeof schema !== 'object') return out;
  const s = schema;
  if (s.type && !isType(data, s.type)) {
    out.push({ path, message: `型が ${s.type} ではない（${typeOf(data)}）` });
    return out;
  }
  if ('const' in s && data !== s.const) out.push({ path, message: `値が ${JSON.stringify(s.const)} ではない` });
  if (s.enum && !s.enum.includes(data)) out.push({ path, message: `値 ${JSON.stringify(data)} は ${s.enum.join(' / ')} のどれでもない` });
  if (typeof data === 'string') {
    if (s.minLength !== undefined && data.length < s.minLength) out.push({ path, message: `文字数が ${s.minLength} 未満` });
  }
  if (typeof data === 'number') {
    if (s.minimum !== undefined && data < s.minimum) out.push({ path, message: `${data} < ${s.minimum}` });
    if (s.maximum !== undefined && data > s.maximum) out.push({ path, message: `${data} > ${s.maximum}` });
  }
  if (Array.isArray(data)) {
    if (s.minItems !== undefined && data.length < s.minItems) out.push({ path, message: `要素が ${s.minItems} 個未満` });
    if (s.maxItems !== undefined && data.length > s.maxItems) out.push({ path, message: `要素が ${s.maxItems} 個を超える` });
    if (s.uniqueItems) {
      const seen = new Set<string>();
      for (const v of data) {
        const k = JSON.stringify(v);
        if (seen.has(k)) out.push({ path, message: `重複した要素 ${k}` });
        seen.add(k);
      }
    }
    if (s.items) data.forEach((v, i) => validateSchema(s.items, v, `${path}[${i}]`, out));
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    for (const r of s.required ?? []) if (!(r in o)) out.push({ path, message: `必須の ${r} がない` });
    for (const [k, sub] of Object.entries(s.properties ?? {})) if (k in o) validateSchema(sub, o[k], `${path}.${k}`, out);
    if (s.additionalProperties === false) {
      for (const k of Object.keys(o)) if (!(k in (s.properties ?? {}))) out.push({ path, message: `想定外の項目 ${k}` });
    } else if (s.additionalProperties && typeof s.additionalProperties === 'object') {
      for (const k of Object.keys(o)) if (!(k in (s.properties ?? {}))) validateSchema(s.additionalProperties, o[k], `${path}.${k}`, out);
    }
  }
  for (const sub of s.allOf ?? []) {
    if (sub.if) {
      const cond = validateSchema(sub.if, data, path, []).length === 0;
      if (cond && sub.then) validateSchema(sub.then, data, path, out);
      else if (!cond && sub.else) validateSchema(sub.else, data, path, out);
    } else validateSchema(sub, data, path, out);
  }
  return out;
}

/** 参照の検査に使う教材一式（comprehensive/ の各ファイルを読み込んだもの） */
export interface RawBundle {
  course: any;
  curriculum: any;
  policy: any;
  quality: any;
  visual: any;
  grammar: any;
  pronunciation: any;
  conversation: any;
  reading: any;
  paraphrase: any;
  expansion: any;
  questionResponse: any;
  vocabulary: any;
  assessment: any;
}

/** 参照の整合性（存在しない ID・重複 ID・日の食い違い） */
export function checkReferences(b: RawBundle): Issue[] {
  const out: Issue[] = [];
  const qIds = new Set<string>();
  const iIds = new Set<string>();
  for (const q of b.course.questions) {
    if (qIds.has(q.id)) out.push({ path: `questions.${q.id}`, message: '問題IDが重複' });
    qIds.add(q.id);
  }
  for (const it of b.course.items) {
    if (iIds.has(it.id)) out.push({ path: `items.${it.id}`, message: '項目IDが重複' });
    iIds.add(it.id);
  }
  const needQ = (where: string, id: string) => !qIds.has(id) && out.push({ path: where, message: `問題ID ${id} がない` });
  const needI = (where: string, id: string) => !iIds.has(id) && out.push({ path: where, message: `項目ID ${id} がない` });
  const byQ = new Map<string, any>(b.course.questions.map((q: any) => [q.id, q]));
  for (const q of b.course.questions) for (const i of q.itemIds) needI(`questions.${q.id}.itemIds`, i);
  for (const d of b.course.days) {
    for (const id of d.questionIds) {
      needQ(`days[${d.day}].questionIds`, id);
      const q = byQ.get(id);
      if (q && q.day !== d.day) out.push({ path: `days[${d.day}]`, message: `問題 ${id} の day が ${q.day}` });
    }
    for (const id of d.itemIds) needI(`days[${d.day}].itemIds`, id);
  }
  if (b.course.days.length !== b.curriculum.days.length) out.push({ path: 'curriculum.days', message: '日数が教材と違う' });
  b.curriculum.days.forEach((d: any, i: number) => {
    const c = b.course.days[i];
    if (!c || c.day !== d.day) out.push({ path: `curriculum.days[${i}]`, message: '日の並びが教材と違う' });
  });
  for (const [a, canon] of Object.entries<string>(b.quality.exactDuplicateQuestionAliases ?? {})) {
    needQ('quality.aliases', a);
    needQ('quality.aliases', canon);
  }
  for (const g of b.quality.sameEnglishItemGroups ?? []) for (const it of g) needI('quality.sameEnglishItemGroups', it.id);
  for (const v of b.visual.groups) {
    for (const id of v.questionIds) needQ(`visual.${v.id}`, id);
    for (const id of v.itemIds) needI(`visual.${v.id}`, id);
    for (const n of v.nodes) if (typeof n.itemId === 'string') needI(`visual.${v.id}.nodes`, n.itemId);
  }
  const gIds = new Set(b.grammar.groups.map((g: any) => g.id));
  for (const g of b.grammar.groups) for (const id of g.questionIds) needQ(`grammar.${g.id}`, id);
  const pIds = new Set(b.pronunciation.groups.map((g: any) => g.id));
  for (const g of b.pronunciation.groups) for (const id of g.questionIds) needQ(`pronunciation.${g.id}`, id);
  const cIds = new Set(b.conversation.scenarios.map((s: any) => s.id));
  for (const s of b.conversation.scenarios) {
    for (const id of s.questionIds) needQ(`conversation.${s.id}`, id);
    const nodes = new Set(s.nodes.map((n: any) => n.id));
    if (!nodes.has(s.startNode)) out.push({ path: `conversation.${s.id}`, message: `開始ノード ${s.startNode} がない` });
    for (const n of s.nodes)
      for (const c of n.choices ?? []) if (!nodes.has(c.next)) out.push({ path: `conversation.${s.id}.${n.id}`, message: `次のノード ${c.next} がない` });
    if (!s.nodes.some((n: any) => n.terminal)) out.push({ path: `conversation.${s.id}`, message: '終わりのノードがない' });
  }
  const rIds = new Set(b.reading.documents.map((d: any) => d.id));
  for (const d of b.reading.documents) for (const id of d.questionIds) needQ(`reading.${d.id}`, id);
  for (const q of b.course.questions) {
    if (q.grammarId && !gIds.has(q.grammarId)) out.push({ path: `questions.${q.id}`, message: `grammarId ${q.grammarId} がない` });
    if (q.pronunciationId && !pIds.has(q.pronunciationId)) out.push({ path: `questions.${q.id}`, message: `pronunciationId ${q.pronunciationId} がない` });
    if (q.conversationId && !cIds.has(q.conversationId)) out.push({ path: `questions.${q.id}`, message: `conversationId ${q.conversationId} がない` });
    if (q.readingId && !rIds.has(q.readingId)) out.push({ path: `questions.${q.id}`, message: `readingId ${q.readingId} がない` });
  }
  for (const e of b.paraphrase.exercises ?? []) {
    for (const id of e.questionIds ?? []) needQ('paraphrase.exercises', id);
    if (e.itemId) needI('paraphrase.exercises', e.itemId);
  }
  for (const t of b.expansion.templates ?? []) {
    for (const id of t.questionIds ?? []) needQ(`expansion.${t.itemId}`, id);
    if (t.itemId) needI('expansion', t.itemId);
  }
  for (const p of b.questionResponse.pairs ?? []) if (p.itemId) needI('questionResponse', p.itemId);
  for (const v of [...(b.vocabulary.irregularVerbs ?? []), ...(b.vocabulary.verbSenses ?? [])]) if (v.itemId) needI(`vocabulary.${v.id}`, v.itemId);
  const diagIds = new Set<string>();
  for (const f of b.assessment.forms)
    for (const q of f.questions) {
      if (diagIds.has(q.id)) out.push({ path: `assessment.${q.id}`, message: '診断の問題IDが重複' });
      if (qIds.has(q.id)) out.push({ path: `assessment.${q.id}`, message: '診断の問題IDが通常問題と同じ' });
      diagIds.add(q.id);
    }
  return out;
}

/** 実ファイルの件数（manifest の件数と比べる） */
export function countBundle(b: RawBundle) {
  return {
    items: b.course.items.length,
    practiceQuestions: b.course.questions.length,
    diagnosticQuestions: b.assessment.forms.reduce((n: number, f: any) => n + f.questions.length, 0),
    visualGroups: b.visual.groups.length,
    days: b.course.days.length,
  };
}
