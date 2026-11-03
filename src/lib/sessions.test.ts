import { describe, expect, it } from 'vitest';
import type { StudySet } from './types';
import { resumeCards, resumeQuiz, withQuizSession } from './sessions';

const mkSet = (n: number): StudySet => ({
  id: 's', title: 'T', termLang: 'de-DE', defLang: 'es-MX', ignoreAccents: false, updated: 0,
  cards: Array.from({ length: n }, (_, i) => ({ id: 'c' + i, term: 't' + i, def: 'd' + i, starred: false, known: false })),
});
const opt = { shuffle: false, startSide: 'term' as const, starredOnly: false };
const qopt = { showSide: 'def' as const, hearSide: 'term' as const, writeWhat: 'same' as const };

describe('resumeCards', () => {
  it('keeps position and results after reload (JSON round-trip)', () => {
    const s = mkSet(5);
    s.cardsSession = { opt, ids: ['c3', 'c1', 'c4', 'c0', 'c2'], index: 2, results: { c3: 'know', c1: 'learn' } };
    const r = resumeCards(JSON.parse(JSON.stringify(s)))!;
    expect(r.ids[r.index]).toBe('c4');
    expect(r.results).toEqual({ c3: 'know', c1: 'learn' });
  });

  it('drops deleted cards without losing the place', () => {
    const s = mkSet(5);
    s.cardsSession = { opt, ids: ['c0', 'c1', 'c2', 'c3', 'c4'], index: 3, results: { c1: 'know' } };
    s.cards = s.cards.filter((c) => c.id !== 'c1');
    const r = resumeCards(s)!;
    expect(r.ids[r.index]).toBe('c3');
    expect(r.results).toEqual({});
  });

  it('nothing to resume when there is no saved round', () => {
    expect(resumeCards(mkSet(3))).toBeUndefined();
  });
});

describe('resumeQuiz', () => {
  it('restores each mode separately and drops deleted cards still to ask', () => {
    let s = mkSet(4);
    s = withQuizSession(s, 'write', { opt: qopt, queue: ['c0', 'c1', 'c2', 'c3', 'c0'], pos: 2, total: 4, first: { c0: false, c1: true }, errors: { c0: 'x' } });
    s = { ...s, cards: s.cards.filter((c) => c.id !== 'c2') };
    const r = resumeQuiz(s, 'write')!;
    expect(r.queue).toEqual(['c0', 'c1', 'c3', 'c0']);
    expect(r.pos).toBe(2);
    expect(resumeQuiz(s, 'listen')).toBeUndefined();
    expect(resumeQuiz(withQuizSession(s, 'write', undefined), 'write')).toBeUndefined();
  });
});
