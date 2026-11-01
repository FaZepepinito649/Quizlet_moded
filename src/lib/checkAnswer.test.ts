import { describe, expect, it } from 'vitest';
import { checkAnswer, diffSegs } from './checkAnswer';

describe('checkAnswer', () => {
  it('normalizes case, spaces and trailing punctuation', () => {
    expect(checkAnswer('  La   Parada. ', 'la parada')).toBe('correct');
    expect(checkAnswer('hola!', 'Hola')).toBe('correct');
    expect(checkAnswer('¿qué?', 'qué')).toBe('correct');
  });

  it('accepts adjacent-key substitutions (QWERTY & QWERTZ)', () => {
    expect(checkAnswer('lsuf', 'lauf')).toBe('almost'); // s↔a, 4 chars → 0.5
    expect(checkAnswer('zug', 'yug')).toBe('almost'); // z↔y
  });

  it('accepts doubled letters, transpositions and spaces at 0.5', () => {
    expect(checkAnswer('hausse', 'hause')).toBe('almost');
    expect(checkAnswer('bahnhfo', 'bahnhof')).toBe('almost');
    expect(checkAnswer('derbahnhof', 'der bahnhof')).toBe('almost');
    expect(checkAnswer('der  bahn hof', 'der bahnhof')).toBe('almost');
  });

  it('applies length thresholds', () => {
    expect(checkAnswer('zgu', 'zug')).toBe('almost'); // transposition 0.5 ≤ 0.5
    expect(checkAnswer('zog', 'zug')).toBe('wrong'); // non-adjacent 1 > 0.5
    expect(checkAnswer('puntaul', 'puntual')).toBe('almost');
    expect(checkAnswer('pentaal', 'puntual')).toBe('wrong');
    expect(checkAnswer('la estacion de trem', 'la estación de tren')).toBe('almost'); // ó→o 1 + n↔m 0.5 ≤ 2
    expect(checkAnswer('la estasion de trak', 'la estación de tren')).toBe('wrong');
  });

  it('umlaut / ß equivalents are always accepted', () => {
    expect(checkAnswer('puenktlich', 'pünktlich')).toBe('correct');
    expect(checkAnswer('strasse', 'die Straße'.slice(4))).toBe('correct');
    expect(checkAnswer('mude', 'müde')).toBe('wrong'); // ≤4 chars → max 0.5, missing letter costs 1
    expect(checkAnswer('punktlich', 'pünktlich')).toBe('almost');
  });

  it('ignoreAccents option', () => {
    expect(checkAnswer('estacion', 'estación')).toBe('almost');
    expect(checkAnswer('estacion', 'estación', { ignoreAccents: true })).toBe('correct');
  });

  it('alternatives separated by /', () => {
    expect(checkAnswer('carro', 'coche / carro')).toBe('correct');
    expect(checkAnswer('coche', 'coche / carro')).toBe('correct');
    expect(checkAnswer('coche / carro', 'coche / carro')).toBe('correct');
    expect(checkAnswer('moto', 'coche / carro')).toBe('wrong');
  });

  it('empty answers are wrong', () => {
    expect(checkAnswer('', 'algo')).toBe('wrong');
  });
});

describe('diffSegs', () => {
  it('marks the differing characters', () => {
    const { expected, given } = diffSegs('puntaul', 'puntual');
    expect(expected.filter((s) => s.mark !== 'none').map((s) => s.t).join('')).toBe('ua');
    expect(given.filter((s) => s.mark !== 'none').map((s) => s.t).join('')).toBe('au');
  });
});
