import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card, StudySet } from './lib/types';
import { loadPersisted, newCard, savePersisted, uid } from './lib/store';
import { cancelSpeech, speak as tts, warmVoices } from './lib/speech';
import { checkAnswer } from './lib/checkAnswer';
import { exportFileName, exportText } from './lib/importFormat';
import Home from './views/Home';
import SetView from './views/SetView';
import EditSet, { type Draft } from './views/EditSet';
import ImportSet from './views/ImportSet';
import Cards, { type CardPrefs } from './views/Cards';
import Quiz, { type QuizMode, type QuizPrefs } from './views/Quiz';

export type View = 'home' | 'set' | 'edit' | 'import' | 'cards' | 'quiz';

export interface AppApi {
  flash: (msg: string) => void;
  speak: (text: string, lang: string, rate?: number) => void;
  updateSet: (id: string, fn: (s: StudySet) => StudySet) => void;
  updateCard: (setId: string, cardId: string, patch: Partial<Card>) => void;
  toSet: () => void;
}

declare global {
  interface Window { checkAnswer?: typeof checkAnswer }
}

const initial = loadPersisted();

export default function App() {
  const [sets, setSets] = useState<StudySet[]>(initial.sets);
  const [dark, setDark] = useState(initial.dark);
  const [view, setView] = useState<View>(initial.nav.view);
  const [setId, setSetId] = useState<string | null>(initial.nav.setId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [quizMode, setQuizMode] = useState<QuizMode>('write');
  const [session, setSession] = useState(0); // remounts study views on each start
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<number>();
  const cardPrefs = useRef<CardPrefs>({ shuffle: false, startSide: 'term', starredOnly: false });
  const quizPrefs = useRef<QuizPrefs>({ showSide: 'def', hearSide: 'term', writeWhat: 'same' });

  const cur = sets.find((s) => s.id === setId) ?? null;
  // Fall back gracefully if the current set disappeared.
  const shown: View = (['set', 'cards', 'quiz'].includes(view) && !cur) || (view === 'edit' && !draft) ? 'home' : view;

  // ---------- effects ----------
  useEffect(() => { document.body.classList.toggle('dark', dark); }, [dark]);
  useEffect(() => {
    const v = shown === 'home' || shown === 'set' ? shown : setId && cur ? 'set' : 'home';
    savePersisted({ sets, dark, nav: { view: v, setId } });
  }, [sets, dark, shown, setId, cur]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [shown]);
  useEffect(() => {
    warmVoices();
    window.checkAnswer = checkAnswer;
    return () => { delete window.checkAnswer; };
  }, []);

  // ---------- helpers ----------
  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(null), 2400);
  }, []);
  const speak = useCallback((text: string, lang: string, rate = 1) => {
    if (!tts(text, lang, rate)) flash('Tu navegador no soporta audio');
  }, [flash]);
  const updateSet = useCallback((id: string, fn: (s: StudySet) => StudySet) => {
    setSets((p) => p.map((x) => (x.id === id ? { ...fn(x), updated: Date.now() } : x)));
  }, []);
  const updateCard = useCallback((sid: string, cardId: string, patch: Partial<Card>) => {
    updateSet(sid, (x) => ({ ...x, cards: x.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)) }));
  }, [updateSet]);

  // ---------- navigation ----------
  const goHome = useCallback(() => { cancelSpeech(); setView('home'); }, []);
  const toSet = useCallback(() => { cancelSpeech(); setView('set'); }, []);
  const openSet = (id: string) => { setSetId(id); setView('set'); };
  const newSet = () => { setDraft({ id: null, title: '', termLang: 'de-DE', defLang: 'es-MX', ignoreAccents: false, rows: [newCard(), newCard(), newCard()] }); setView('edit'); };
  const editSet = () => {
    if (!cur) return;
    setDraft({ id: cur.id, title: cur.title, termLang: cur.termLang, defLang: cur.defLang, ignoreAccents: cur.ignoreAccents, rows: cur.cards.map((c) => ({ ...c })) });
    setView('edit');
  };
  const cancelDraft = useCallback(() => { setView(draft?.id ? 'set' : 'home'); setDraft(null); }, [draft]);
  const startCards = () => {
    if (!cur?.cards.length) return flash('Este set no tiene tarjetas');
    setSession((n) => n + 1); setView('cards');
  };
  const startQuiz = (mode: QuizMode) => {
    if (!cur?.cards.length) return flash('Este set no tiene tarjetas');
    setQuizMode(mode); setSession((n) => n + 1); setView('quiz');
  };

  // ---------- set actions ----------
  const exportSet = () => {
    if (!cur) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportText(cur)], { type: 'text/plain;charset=utf-8' }));
    a.download = exportFileName(cur.title);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    flash('Set exportado como .txt');
  };
  const deleteSet = () => {
    if (!cur) return;
    setSets((p) => p.filter((x) => x.id !== cur.id));
    setSetId(null); setView('home');
    flash('Set eliminado');
  };
  const saveDraft = (d: Draft) => {
    const title = d.title.trim();
    if (!title) return flash('Ponle un título al set');
    const rows = d.rows.map((r) => ({ ...r, term: r.term.trim(), def: r.def.trim() })).filter((r) => r.term || r.def);
    const half = rows.findIndex((r) => !r.term || !r.def);
    if (half > -1) return flash('Completa término y definición en la tarjeta ' + (half + 1));
    if (!rows.length) return flash('Añade al menos una tarjeta');
    const base = { title, termLang: d.termLang, defLang: d.defLang, ignoreAccents: d.ignoreAccents, cards: rows, updated: Date.now() };
    if (d.id) {
      const id = d.id;
      setSets((p) => p.map((x) => (x.id === id ? { ...x, ...base } : x)));
      setSetId(id);
    } else {
      const id = uid();
      setSets((p) => [{ id, ...base }, ...p]);
      setSetId(id);
    }
    setDraft(null); setView('set');
    flash('Set guardado');
  };
  const importSet = (s: StudySet) => {
    setSets((p) => [s, ...p]); setSetId(s.id); setView('set');
    flash('Importadas ' + s.cards.length + ' tarjetas');
  };

  // ---------- global Escape ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (shown === 'cards' || shown === 'quiz') toSet();
      else if (shown === 'edit') cancelDraft();
      else if (shown === 'import' || shown === 'set') goHome();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, toSet, cancelDraft, goHome]);

  const api: AppApi = { flash, speak, updateSet, updateCard, toSet };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-in">
          <button className="brand" onClick={goHome} aria-label="Ir a Mis sets">
            <span className="brand-mark">R</span>
            <span className="brand-name">Repaso</span>
          </button>
          <div className="spacer" />
          <button className="theme-btn" onClick={() => setDark((d) => !d)}>
            <span className="theme-dot" />{dark ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </div>
      </header>
      <main className="main">
        {shown === 'home' && <Home sets={sets} onOpen={openSet} onNew={newSet} onImport={() => setView('import')} />}
        {shown === 'set' && cur && (
          <SetView key={cur.id} set={cur} api={api} onBack={goHome} onEdit={editSet} onExport={exportSet} onDelete={deleteSet}
            onCards={startCards} onWrite={() => startQuiz('write')} onListen={() => startQuiz('listen')} />
        )}
        {shown === 'edit' && draft && <EditSet initial={draft} onCancel={cancelDraft} onSave={saveDraft} />}
        {shown === 'import' && <ImportSet onBack={goHome} onImport={importSet} flash={flash} />}
        {shown === 'cards' && cur && <Cards key={session} set={cur} api={api} prefs={cardPrefs} />}
        {shown === 'quiz' && cur && <Quiz key={session} set={cur} api={api} mode={quizMode} prefs={quizPrefs} />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

