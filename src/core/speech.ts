// 英文の読み上げ（Web Speech API）。使えない環境では何もしない。外部の API は使わない。
// 声はモードごとに優先する言語の順で選ぶ（既定 en-US。総合英語は en-NZ → en-GB → ほかの英語）。
// 端末の声の一覧は後から届く（voiceschanged）ので、届いたら選び直す。
const voiceCache = new Map<string, SpeechSynthesisVoice | null>();
let listeners: (() => void)[] = [];

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

if (canSpeak()) {
  try {
    speechSynthesis.addEventListener?.('voiceschanged', () => {
      voiceCache.clear();
      for (const f of listeners) f();
    });
  } catch {
    /* 古い環境 */
  }
}

/** 声の一覧が変わったら呼ぶ（返り値で解除） */
export function onVoicesChanged(f: () => void): () => void {
  listeners.push(f);
  return () => (listeners = listeners.filter((x) => x !== f));
}

/** 英語の声（端末にあるもの） */
export function englishVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('en'));
}

/** 優先する言語の順に声を選ぶ（例: ['en-NZ', 'en-GB', 'en']。'en' はほかの英語すべて） */
export function pickVoice(langs: readonly string[] = ['en-US', 'en']): SpeechSynthesisVoice | null {
  const key = langs.join(',');
  if (voiceCache.has(key)) return voiceCache.get(key)!;
  const vs = englishVoices();
  if (!vs.length) return null; // まだ読み込まれていない（次回また探す）
  const norm = (l: string) => l.replace('_', '-').toLowerCase();
  let found: SpeechSynthesisVoice | null = null;
  for (const l of langs) {
    const want = l.toLowerCase();
    const m = vs.filter((v) => (want === 'en' ? norm(v.lang).startsWith('en') : norm(v.lang) === want));
    found = m.find((v) => v.localService) ?? m[0] ?? null;
    if (found) break;
  }
  voiceCache.set(key, found);
  return found;
}

export interface SpeakOptions {
  rate?: number;
  langs?: readonly string[];
}

/** 読み上げる（前の読み上げは止める）。終わったら onend */
export function speak(text: string, onend?: () => void, opts: SpeakOptions = {}) {
  if (!canSpeak() || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(opts.langs);
  u.lang = v?.lang ?? opts.langs?.[0] ?? 'en-US';
  u.rate = opts.rate ?? 0.95;
  if (v) u.voice = v;
  if (onend) u.onend = u.onerror = () => onend();
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel();
}
