import type { StudySet } from './types';

export interface ImportRow { n: number; raw: string; term: string; def: string; ok: boolean }
export interface ImportMeta { title?: string; termLang?: string; defLang?: string }

export const SAMPLE_IMPORT =
  '@titulo: Vocabulario Kapitel 5\n@idioma_termino: de-DE\n@idioma_definicion: es-MX\n' +
  'der Bahnhof | la estación de tren\ndie Haltestelle | la parada\n' +
  'umsteigen | transbordar / cambiar de tren\n# comentario ignorado\npünktlich | puntual\ndie Abfahrt la salida';

/** One card per line, "term | def" or tab-separated. Blank and "#" lines ignored; "@key: value" metadata. */
export function parseImport(text: string): { meta: ImportMeta; rows: ImportRow[] } {
  const meta: ImportMeta = {}, rows: ImportRow[] = [];
  String(text || '').split(/\r?\n/).forEach((raw, k) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = line.match(/^@\s*([^:]+?)\s*:\s*(.*)$/);
    if (m) {
      const key = m[1].toLowerCase(), v = m[2].trim();
      if (/t[ií]tul|title/.test(key)) meta.title = v;
      else if (/t[eé]rmin|term/.test(key)) meta.termLang = v;
      else if (/defin|def/.test(key)) meta.defLang = v;
      return;
    }
    let term = '', def = '';
    const ti = line.indexOf('\t'), pi = line.indexOf('|');
    if (ti > -1) { term = line.slice(0, ti); def = line.slice(ti + 1).replace(/\t+/g, ' '); }
    else if (pi > -1) { term = line.slice(0, pi); def = line.slice(pi + 1); }
    term = term.trim(); def = def.trim();
    rows.push({ n: k + 1, raw: line, term, def, ok: !!(term && def) });
  });
  return { meta, rows };
}

export function exportText(s: StudySet): string {
  return [
    '@titulo: ' + s.title,
    '@idioma_termino: ' + s.termLang,
    '@idioma_definicion: ' + s.defLang,
    '',
    ...s.cards.map((c) => c.term + ' | ' + c.def),
  ].join('\n') + '\n';
}

export function exportFileName(title: string): string {
  return (
    title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'set'
  ) + '.txt';
}
