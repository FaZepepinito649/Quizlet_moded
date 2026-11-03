// "Aprender" mode: adaptive rounds that move each card through mastery levels.
// Level 0 = nuevo, 1 = aprendiendo (fallada), 2 = familiar (acertó opción múltiple), 3 = dominado (acertó escrita).
// All of this lives on the set, so it is persisted to localStorage and survives closing the page.
import type { Card, Side, StudySet } from './types';
import { norm } from './checkAnswer';
import { shuffle } from './store';

export type Level = 0 | 1 | 2 | 3;
export type QType = 'mc' | 'written';
export interface Question { cardId: string; type: QType; options?: string[] }
export interface LearnPrefs { answerWith: Side; mc: boolean; written: boolean }
export interface LearnState {
  prefs: LearnPrefs;
  round: number;          // 1-based round number
  roundIds: string[];     // cards in this round
  queue: string[];        // questions to ask (missed cards are appended again)
  pos: number;            // index into queue
  q: Question | null;     // current question (null → round summary)
  startedAt: number;
}

export const ROUND_SIZE = 7;
export const DEFAULT_PREFS: LearnPrefs = { answerWith: 'def', mc: true, written: true };
export const LEVEL_NAMES = ['Nuevo', 'Aprendiendo', 'Familiar', 'Dominado'] as const;

export const levelOf = (c: Card): Level => (c.level ?? 0) as Level;
export const promptSide = (p: LearnPrefs): Side => (p.answerWith === 'def' ? 'term' : 'def');

export function counts(set: StudySet) {
  const n = [0, 0, 0, 0];
  for (const c of set.cards) n[levelOf(c)]++;
  return { nuevo: n[0], aprendiendo: n[1], familiar: n[2], dominado: n[3], total: set.cards.length };
}

/** Which question type a card needs next. */
export function questionType(level: Level, p: LearnPrefs, cardCount: number): QType {
  const mcOk = p.mc && cardCount >= 2;
  if (!p.written) return 'mc';
  if (!mcOk) return 'written';
  return level >= 2 ? 'written' : 'mc';
}

/** Level after an answer. Wrong always drops back to "aprendiendo". */
export function nextLevel(level: Level, type: QType, correct: boolean, p: LearnPrefs): Level {
  if (!correct) return 1;
  if (type === 'written') return 3;
  // Multiple choice: reaches "familiar"; only masters when written questions are disabled.
  if (!p.written) return level >= 2 ? 3 : 2;
  return Math.max(level, 2) as Level;
}

export function buildOptions(set: StudySet, card: Card, side: Side, n = 4): string[] {
  const right = card[side];
  const seen = new Set([norm(right)]);
  const pool: string[] = [];
  for (const c of shuffle(set.cards)) {
    const v = c[side], k = norm(v);
    if (c.id === card.id || !v.trim() || seen.has(k)) continue;
    seen.add(k); pool.push(v);
    if (pool.length >= n - 1) break;
  }
  return shuffle([right, ...pool]);
}

export function makeQuestion(set: StudySet, cardId: string, p: LearnPrefs): Question | null {
  const card = set.cards.find((c) => c.id === cardId);
  if (!card) return null;
  const type = questionType(levelOf(card), p, set.cards.length);
  return type === 'mc' ? { cardId, type, options: buildOptions(set, card, p.answerWith) } : { cardId, type };
}

/** Pick the next round: in-progress cards first (aprendiendo, familiar), then new ones. */
export function pickRound(set: StudySet, size = ROUND_SIZE): string[] {
  const pending = set.cards.filter((c) => levelOf(c) < 3);
  const started = shuffle(pending.filter((c) => levelOf(c) > 0));
  const fresh = pending.filter((c) => levelOf(c) === 0);
  return [...started, ...fresh].slice(0, size).map((c) => c.id);
}

export function startRound(set: StudySet, prefs: LearnPrefs, round: number): LearnState {
  const ids = pickRound(set);
  const queue = shuffle(ids);
  return { prefs, round, roundIds: ids, queue, pos: 0, q: queue.length ? makeQuestion(set, queue[0], prefs) : null, startedAt: Date.now() };
}

/**
 * Apply an answer: returns the set with the card's new level and the advanced learn state.
 * A missed card is asked again at the end of the round.
 */
export function applyAnswer(set: StudySet, st: LearnState, correct: boolean): StudySet {
  if (!st.q) return set;
  const { cardId, type } = st.q;
  const cards = set.cards.map((c) => {
    if (c.id !== cardId) return c;
    const level = nextLevel(levelOf(c), type, correct, st.prefs);
    return { ...c, level, known: level === 3 ? true : correct ? c.known : false };
  });
  const updated = { ...set, cards };
  const queue = correct ? st.queue : [...st.queue, cardId];
  const pos = st.pos + 1;
  // Skip queued cards that were deleted meanwhile.
  let next = pos;
  while (next < queue.length && !cards.some((c) => c.id === queue[next])) next++;
  const q = next < queue.length ? makeQuestion(updated, queue[next], st.prefs) : null;
  return { ...updated, learn: { ...st, queue, pos: next, q } };
}

/** Make a persisted state safe to resume after edits to the set (deleted cards, changed answers). */
export function sanitize(set: StudySet, st: LearnState | undefined): LearnState | undefined {
  if (!st) return undefined;
  const ids = new Set(set.cards.map((c) => c.id));
  const queue = st.queue.filter((id, i) => i < st.pos || ids.has(id));
  const roundIds = st.roundIds.filter((id) => ids.has(id));
  let q = st.q;
  if (q && !ids.has(q.cardId)) q = null;
  if (q?.type === 'mc') {
    const card = set.cards.find((c) => c.id === q!.cardId)!;
    if (!q.options?.includes(card[st.prefs.answerWith])) q = makeQuestion(set, card.id, st.prefs);
  }
  let pos = Math.min(st.pos, queue.length);
  if (!q && pos < queue.length) { q = makeQuestion(set, queue[pos], st.prefs); }
  if (!q) pos = queue.length;
  return { ...st, queue, roundIds, q, pos };
}
