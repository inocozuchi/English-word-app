// 英文の読み上げ（Web Speech API）。使えない環境では何もしない。
let voice: SpeechSynthesisVoice | null | undefined;

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

function pickVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined) return voice;
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return null; // まだ読み込まれていない（次回また探す）
  voice = vs.find((v) => v.lang === 'en-US' && v.localService) ?? vs.find((v) => v.lang === 'en-US') ?? vs.find((v) => v.lang.startsWith('en')) ?? null;
  return voice;
}

/** 読み上げる（前の読み上げは止める）。終わったら onend */
export function speak(text: string, onend?: () => void) {
  if (!canSpeak() || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.95;
  const v = pickVoice();
  if (v) u.voice = v;
  if (onend) u.onend = u.onerror = () => onend();
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel();
}
