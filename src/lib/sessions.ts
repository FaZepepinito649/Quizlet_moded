// Saved, resumable rounds for Tarjetas and Escribir/Escuchar.
// They live on the set (like Aprender), so they are written to localStorage and survive closing the page.
import type { Side, StudySet } from './types';

export type CardMark = 'know' | 'learn';
export interface CardsSession {
  opt: { shuffle: boolean; startSide: Side; starredOnly: boolean };
  ids: string[];
  index: number;
  results: Record<string, CardMark>;
}

export type QuizMode = 'write' | 'listen';
export interface QuizSession {
  opt: { showSide: Side; hearSide: Side; writeWhat: 'same' | 'other' };
  queue: string[];
  pos: number;
  total: number;
  first: Record<string, boolean>;
  errors: Record<string, string>;
}

const pick = <T,>(rec: Record<string, T>, ids: Set<string>) =>
  Object.fromEntries(Object.entries(rec).filter(([k]) => ids.has(k))) as Record<string, T>;

/** Drop deleted cards from a saved Tarjetas round. Returns undefined when nothing is left to resume. */
export function resumeCards(set: StudySet): CardsSession | undefined {
  const s = set.cardsSession;
  if (!s) return undefined;
  const ids = new Set(set.cards.map((c) => c.id));
  const current = s.ids[s.index];
  const kept = s.ids.filter((id) => ids.has(id));
  if (!kept.length) return undefined;
  // Keep the position: count surviving cards before the saved index.
  let index = s.ids.slice(0, s.index).filter((id) => ids.has(id)).length;
  if (current && !ids.has(current) && index >= kept.length) index = kept.length - 1;
  if (index >= kept.length) return undefined;
  return { ...s, ids: kept, index, results: pick(s.results, ids) };
}

/** Drop deleted cards from a saved Escribir/Escuchar round. Returns undefined when it is finished or empty. */
export function resumeQuiz(set: StudySet, mode: QuizMode): QuizSession | undefined {
  const s = set.quizSession?.[mode];
  if (!s) return undefined;
  const ids = new Set(set.cards.map((c) => c.id));
  const done = s.queue.slice(0, s.pos);
  const rest = s.queue.slice(s.pos).filter((id) => ids.has(id));
  if (!rest.length) return undefined;
  return { ...s, queue: [...done, ...rest], first: pick(s.first, ids), errors: pick(s.errors, ids) };
}

export const withQuizSession = (set: StudySet, mode: QuizMode, s: QuizSession | undefined): StudySet => {
  const quizSession = { ...set.quizSession };
  if (s) quizSession[mode] = s; else delete quizSession[mode];
  return { ...set, quizSession };
};
