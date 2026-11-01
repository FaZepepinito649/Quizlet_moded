export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function cancelSpeech() {
  if (ttsSupported()) speechSynthesis.cancel();
}

/** Speak text with the voice best matching `lang`. Returns false when TTS is unavailable. */
export function speak(text: string, lang: string, rate = 1): boolean {
  if (!ttsSupported()) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text || ''));
  u.lang = lang || 'es-MX';
  u.rate = rate;
  const vs = speechSynthesis.getVoices();
  const l = u.lang.toLowerCase();
  const v =
    vs.find((x) => x.lang === u.lang) ||
    vs.find((x) => (x.lang || '').replace('_', '-').toLowerCase() === l) ||
    vs.find((x) => (x.lang || '').slice(0, 2).toLowerCase() === l.slice(0, 2));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
  return true;
}

export function warmVoices() {
  if (!ttsSupported()) return;
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
