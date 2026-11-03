export interface Card {
  id: string; term: string; def: string; starred: boolean; known: boolean;
  /** Aprender: 0 nuevo, 1 aprendiendo, 2 familiar, 3 dominado. */
  level?: number;
}

export interface StudySet {
  id: string;
  title: string;
  termLang: string;
  defLang: string;
  ignoreAccents: boolean;
  updated: number;
  cards: Card[];
  /** Saved progress of the current Aprender round (persisted across page reloads). */
  learn?: import('./learn').LearnState;
  learnPrefs?: import('./learn').LearnPrefs;
  /** Saved Tarjetas round in progress. */
  cardsSession?: import('./sessions').CardsSession;
  /** Saved Escribir / Escuchar rounds in progress. */
  quizSession?: Partial<Record<import('./sessions').QuizMode, import('./sessions').QuizSession>>;
}

export type Side = 'term' | 'def';
