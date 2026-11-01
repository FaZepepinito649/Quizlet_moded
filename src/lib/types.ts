export interface Card { id: string; term: string; def: string; starred: boolean; known: boolean }

export interface StudySet {
  id: string;
  title: string;
  termLang: string;
  defLang: string;
  ignoreAccents: boolean;
  updated: number;
  cards: Card[];
}

export type Side = 'term' | 'def';
