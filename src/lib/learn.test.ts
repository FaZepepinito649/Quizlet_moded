import { describe, expect, it } from 'vitest';
import type { StudySet } from './types';
import { applyAnswer, buildOptions, counts, DEFAULT_PREFS, nextLevel, pickRound, sanitize, startRound } from './learn';

const mkSet = (n: number): StudySet => ({
  id: 's', title: 'T', termLang: 'de-DE', defLang: 'es-MX', ignoreAccents: false, updated: 0,
  cards: Array.from({ length: n }, (_, i) => ({ id: 'c' + i, term: 't' + i, def: 'd' + i, starred: false, known: false })),
});

describe('levels', () => {
  it('MC → familiar, written → dominado, wrong → aprendiendo', () => {
    expect(nextLevel(0, 'mc', true, DEFAULT_PREFS)).toBe(2);
    expect(nextLevel(2, 'written', true, DEFAULT_PREFS)).toBe(3);
    expect(nextLevel(3, 'written', false, DEFAULT_PREFS)).toBe(1);
    expect(nextLevel(2, 'mc', true, { ...DEFAULT_PREFS, written: false })).toBe(3);
  });
});

describe('rounds', () => {
  it('rounds hold up to 7 cards, in-progress cards first', () => {
    const s = mkSet(10);
    s.cards[9].level = 1;
    s.cards[0].level = 3;
    const ids = pickRound(s);
    expect(ids).toHaveLength(7);
    expect(ids[0]).toBe('c9');
    expect(ids).not.toContain('c0');
  });

  it('missed cards are asked again, and progress is a plain serializable object', () => {
    let s = mkSet(3);
    s = { ...s, learn: startRound(s, DEFAULT_PREFS, 1) };
    expect(s.learn!.q!.type).toBe('mc');
    expect(s.learn!.q!.options).toHaveLength(3);
    const first = s.learn!.q!.cardId;
    s = applyAnswer(s, s.learn!, false);
    expect(s.learn!.queue).toHaveLength(4);
    s = applyAnswer(s, s.learn!, true);
    s = applyAnswer(s, s.learn!, true);
    expect(s.learn!.q!.cardId).toBe(first); // retry at the end
    s = applyAnswer(s, s.learn!, true);
    expect(s.learn!.q).toBeNull();
    expect(counts(s)).toMatchObject({ familiar: 3 });
    const restored = JSON.parse(JSON.stringify(s));
    const r2 = startRound(restored, DEFAULT_PREFS, 2);
    expect(r2.q!.type).toBe('written');
  });

  it('options are distinct and include the answer', () => {
    const s = mkSet(6);
    const opts = buildOptions(s, s.cards[0], 'def');
    expect(opts).toHaveLength(4);
    expect(new Set(opts).size).toBe(4);
    expect(opts).toContain('d0');
  });

  it('sanitize drops deleted cards from a saved round', () => {
    let s = mkSet(4);
    s = { ...s, learn: startRound(s, DEFAULT_PREFS, 1) };
    const cur = s.learn!.q!.cardId;
    const edited = { ...s, cards: s.cards.filter((c) => c.id !== cur) };
    const clean = sanitize(edited, edited.learn)!;
    expect(clean.queue).not.toContain(cur);
    expect(clean.q!.cardId).not.toBe(cur);
  });
});
