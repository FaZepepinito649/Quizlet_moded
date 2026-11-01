import { describe, expect, it } from 'vitest';
import { exportText, parseImport, SAMPLE_IMPORT } from './importFormat';

describe('parseImport', () => {
  it('parses metadata, pipes, tabs, comments and bad lines', () => {
    const { meta, rows } = parseImport(SAMPLE_IMPORT + '\nder Zug\tel tren\n\n');
    expect(meta).toEqual({ title: 'Vocabulario Kapitel 5', termLang: 'de-DE', defLang: 'es-MX' });
    expect(rows.filter((r) => r.ok).map((r) => r.term)).toEqual(['der Bahnhof', 'die Haltestelle', 'umsteigen', 'pünktlich', 'der Zug']);
    const bad = rows.filter((r) => !r.ok);
    expect(bad).toHaveLength(1);
    expect(bad[0].raw).toBe('die Abfahrt la salida');
  });

  it('round-trips through exportText', () => {
    const set = { id: 'x', title: 'T', termLang: 'en-US', defLang: 'es-MX', ignoreAccents: false, updated: 0,
      cards: [{ id: 'a', term: 'turn on', def: 'encender / prender', starred: false, known: false }] };
    const { meta, rows } = parseImport(exportText(set));
    expect(meta).toEqual({ title: 'T', termLang: 'en-US', defLang: 'es-MX' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ term: 'turn on', def: 'encender / prender', ok: true });
  });
});
