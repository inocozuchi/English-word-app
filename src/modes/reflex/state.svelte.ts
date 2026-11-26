// 反射版のデータの読み込み（小さいので一度に読む。読んだらメモリに置く）
import type { RQuestion, RCard, RIndexFile } from './types.ts';
import { figureLabels, figureTerms, maskSvg, svgAspect } from './figmask.ts';

const BASE = './data/imagelink-reflex/';

class ReflexState {
  questions = $state.raw<RQuestion[] | null>(null);
  cards = $state.raw<RCard[]>([]);
  error = $state('');
}
export const rx = new ReflexState();
export const qById = new Map<string, RQuestion>();
export const cardById = new Map<string, RCard>();
/** 図のパス → 表示用の URL（答えの文字を伏せた SVG の data URL。読めなかった図は元のファイル）と縦横比 */
const figs = new Map<string, { src: string; aspect: number | null }>();
export const figSrc = (path: string) => figs.get(path)?.src ?? BASE + path;
export const figAspect = (path: string) => figs.get(path)?.aspect ?? null;

/** 使う図をすべて読み、答えの文字を伏せておく（56枚・数KBずつ。オフラインでは SW のキャッシュから） */
async function prepareFigures(qs: RQuestion[]) {
  const labels = figureLabels(qs);
  const paths = new Set<string>();
  for (const q of qs) for (const f of [q.figure, q.answer_figure, ...(q.distractor_figures ?? [])]) if (f) paths.add(f);
  await Promise.all(
    [...paths].map(async (f) => {
      try {
        const r = await fetch(BASE + f);
        if (!r.ok) return;
        const raw = await r.text();
        const terms = (labels.get(f) ?? []).flatMap(figureTerms);
        const { svg } = maskSvg(raw, terms);
        figs.set(f, { src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), aspect: svgAspect(raw) });
      } catch {
        /* 元のファイルを使う */
      }
    }),
  );
}

let p: Promise<void> | null = null;
export function loadReflex(): Promise<void> {
  return (p ??= (async () => {
    const get = async <T,>(f: string): Promise<T> => {
      const r = await fetch(BASE + f);
      if (!r.ok) throw new Error(`${f}: ${r.status}`);
      return r.json();
    };
    const ix = await get<RIndexFile>('index.json');
    const [qs, cs] = await Promise.all([get<RQuestion[]>(ix.question_file), get<RCard[]>(ix.cards_file)]);
    await prepareFigures(qs);
    for (const q of qs) qById.set(q.id, q);
    for (const c of cs) cardById.set(c.id, c);
    rx.cards = cs;
    rx.questions = qs;
    rx.error = '';
  })().catch((e) => {
    p = null;
    rx.error = '問題データを読み込めませんでした（通信を確認してください）';
    throw e;
  }));
}
