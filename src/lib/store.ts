import type { Card, StudySet } from './types';

export const STORAGE_KEY = 'repaso.v1';

export const LANGS: [string, string][] = [
  ['de-DE', 'Alemán'], ['es-MX', 'Español (México)'], ['es-ES', 'Español (España)'],
  ['en-US', 'Inglés (EE. UU.)'], ['en-GB', 'Inglés (Reino Unido)'], ['fr-FR', 'Francés'],
  ['it-IT', 'Italiano'], ['pt-BR', 'Portugués (Brasil)'], ['nl-NL', 'Neerlandés'],
  ['ja-JP', 'Japonés'], ['zh-CN', 'Chino (mandarín)'], ['ko-KR', 'Coreano'],
];

export const langName = (code: string) => LANGS.find((l) => l[0] === code)?.[1] ?? (code || '—');

export function langOpts(extra: string[] = []) {
  const list = LANGS.map(([code, name]) => ({ code, name }));
  for (const c of extra) if (c && !list.find((l) => l.code === c)) list.push({ code: c, name: c });
  return list;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);

export const newCard = (term = '', def = '', known = false): Card => ({ id: uid(), term, def, starred: false, known });

export function seed(): StudySet[] {
  const mk = (t: string, d: string, k?: number) => newCard(t, d, !!k);
  return [
    { id: uid(), title: 'Vocabulario Kapitel 5', termLang: 'de-DE', defLang: 'es-MX', ignoreAccents: false, updated: Date.now(), cards: [
      mk('der Bahnhof', 'la estación de tren', 1), mk('die Haltestelle', 'la parada', 1), mk('umsteigen', 'transbordar / cambiar de tren'), mk('pünktlich', 'puntual', 1),
      mk('die Verspätung', 'el retraso'), mk('die Fahrkarte', 'el boleto'), mk('abfahren', 'salir / partir'), mk('ankommen', 'llegar'),
      mk('das Gleis', 'el andén / la vía'), mk('der Zug', 'el tren', 1), mk('die Straße', 'la calle'), mk('müde', 'cansado'),
    ] },
    { id: uid(), title: 'Phrasal verbs básicos', termLang: 'en-US', defLang: 'es-MX', ignoreAccents: true, updated: Date.now(), cards: [
      mk('give up', 'rendirse'), mk('look for', 'buscar', 1), mk('run out of', 'quedarse sin'), mk('turn on', 'encender / prender'),
      mk('turn off', 'apagar', 1), mk('get up', 'levantarse'), mk('find out', 'descubrir / enterarse'), mk('take off', 'despegar / quitarse'),
    ] },
  ];
}

export interface Persisted { sets: StudySet[]; dark: boolean; nav: { view: 'home' | 'set' | 'learn' | 'cards' | 'quiz'; setId: string | null; mode?: 'write' | 'listen' } }

export function loadPersisted(): Persisted {
  let d: Partial<Persisted> | null = null;
  try { d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { /* ignore */ }
  const sets = d && Array.isArray(d.sets) ? d.sets : seed();
  const nav = d?.nav ?? { view: 'home' as const, setId: null };
  const valid = ['set', 'learn', 'cards', 'quiz'].includes(nav.view) && sets.some((s) => s.id === nav.setId);
  return { sets, dark: !!d?.dark, nav: valid ? nav : { view: 'home', setId: nav.setId ?? null } };
}

export function savePersisted(p: Persisted) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
