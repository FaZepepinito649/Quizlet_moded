import { useEffect, useRef, useState } from 'react';
import type { Card, Side, StudySet } from '../lib/types';
import { langName, plural } from '../lib/store';
import { diffSegs, evaluate } from '../lib/checkAnswer';
import {
  applyAnswer, counts, DEFAULT_PREFS, LEVEL_NAMES, levelOf, makeQuestion, promptSide, sanitize, startRound,
  type LearnPrefs, type LearnState, type Level, type Question,
} from '../lib/learn';
import type { AppApi } from '../App';
import { Chip, Kbd, SpeakerIcon } from '../components';
import { FeedbackBox, type Feedback } from './Quiz';

/** Feedback for the question just answered (kept in memory only; progress is already saved). */
type Shown =
  | { kind: 'mc'; q: Question; picked: string; correct: boolean; before: StudySet }
  | { kind: 'written'; q: Question; fb: Feedback; before: StudySet };

const sideName = (s: Side) => (s === 'term' ? 'el término' : 'la definición');
const LEVEL_COLORS = ['var(--border)', 'var(--warn)', 'var(--primary)', 'var(--ok)'];

export default function Learn({ set, api }: { set: StudySet; api: AppApi }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [input, setInput] = useState('');
  const [showOpts, setShowOpts] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoT = useRef<number>();

  const prefs: LearnPrefs = set.learn?.prefs ?? set.learnPrefs ?? DEFAULT_PREFS;
  const st = set.learn;
  const c = counts(set);
  const allMastered = c.total > 0 && c.dominado === c.total;
  const save = (fn: (s: StudySet) => StudySet) => api.updateSet(set.id, fn);

  // Resume safely after the set was edited while a round was saved.
  useEffect(() => {
    const clean = sanitize(set, set.learn);
    if (clean && JSON.stringify(clean) !== JSON.stringify(set.learn)) save((s) => ({ ...s, learn: clean }));
    return () => window.clearTimeout(autoT.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = shown ? shown.q : st?.q ?? null;
  const card: Card | undefined = q ? set.cards.find((x) => x.id === q.cardId) : undefined;
  const pSide = promptSide(prefs), aSide = prefs.answerWith;
  const lang = (s: Side) => (s === 'term' ? set.termLang : set.defLang);
  const phase: 'setup' | 'question' | 'summary' | 'done' =
    shown || (st && st.q) ? 'question' : st ? (allMastered ? 'done' : 'summary') : allMastered ? 'done' : 'setup';

  useEffect(() => {
    if (phase === 'question' && !shown && q?.type === 'written') {
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [phase, shown, q?.cardId, q?.type, st?.pos]);

  // ---------- actions ----------
  const begin = (round = 1) => {
    setShown(null); setInput('');
    save((s) => ({ ...s, learnPrefs: prefs, learn: startRound(s, prefs, round) }));
  };
  const setPrefs = (p: Partial<LearnPrefs>) => {
    const np = { ...prefs, ...p };
    if (!np.mc && !np.written) return api.flash('Elige al menos un tipo de pregunta');
    save((s) => {
      const learn = s.learn && { ...s.learn, prefs: np, q: s.learn.q && !shown ? makeQuestion(s, s.learn.q.cardId, np) : s.learn.q };
      return { ...s, learnPrefs: np, learn };
    });
  };
  const resetProgress = () => {
    setShown(null);
    save((s) => ({ ...s, learn: undefined, cards: s.cards.map((x) => ({ ...x, level: 0, known: false })) }));
    api.flash('Progreso de Aprender reiniciado');
  };

  const answerMC = (opt: string) => {
    if (!st?.q || !card || shown) return;
    const correct = opt === card[aSide];
    const before = set;
    save((s) => applyAnswer(s, s.learn!, correct));
    setShown({ kind: 'mc', q: st.q, picked: opt, correct, before });
    window.clearTimeout(autoT.current);
    if (correct) autoT.current = window.setTimeout(() => keys.current.next(), 1000);
  };
  const answerWritten = (skip = false) => {
    if (!st?.q || !card || shown) return;
    const given = skip ? '' : input;
    const ev = evaluate(given, card[aSide], { ignoreAccents: set.ignoreAccents });
    const correct = ev.result !== 'wrong';
    const before = set;
    save((s) => applyAnswer(s, s.learn!, correct));
    const fb: Feedback = { result: ev.result, given: given.trim(), correct: card[aSide], isFirst: true, segs: ev.result === 'almost' ? diffSegs(given, ev.alt, set.ignoreAccents) : null };
    setShown({ kind: 'written', q: st.q, fb, before });
    window.clearTimeout(autoT.current);
    if (ev.result === 'correct') autoT.current = window.setTimeout(() => keys.current.next(), 1100);
  };
  /** "Yo tenía razón": redo the answer as correct from the snapshot taken before it. */
  const override = () => {
    if (shown?.kind !== 'written' || shown.fb.result !== 'wrong') return;
    window.clearTimeout(autoT.current);
    const redone = applyAnswer(shown.before, shown.before.learn!, true);
    save(() => redone);
    setShown({ ...shown, fb: { ...shown.fb, result: 'override' } });
  };
  const next = () => { window.clearTimeout(autoT.current); setShown(null); setInput(''); };

  // ---------- keyboard ----------
  const keys = useRef({ phase, shown, q, next, answerMC, answerWritten, begin, st });
  keys.current = { phase, shown, q, next, answerMC, answerWritten, begin, st };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (e.metaKey || e.altKey || e.ctrlKey) return;
      const tag = ((e.target as HTMLElement | null)?.tagName || '').toLowerCase();
      if (e.key === 'Enter' && tag !== 'button') {
        if (k.shown) { e.preventDefault(); k.next(); }
        else if (k.phase === 'question' && k.q?.type === 'written') { e.preventDefault(); k.answerWritten(); }
        else if (k.phase === 'setup') { e.preventDefault(); k.begin(1); }
        else if (k.phase === 'summary' && k.st) { e.preventDefault(); k.begin(k.st.round + 1); }
        return;
      }
      if (k.phase === 'question' && !k.shown && k.q?.type === 'mc' && tag !== 'input') {
        const i = Number(e.key) - 1;
        if (k.q.options && i >= 0 && i < k.q.options.length) { e.preventDefault(); k.answerMC(k.q.options[i]); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- view ----------
  const roundDone = st ? Math.min(st.pos, st.queue.length) : 0;
  return (
    <section className="stack" style={{ maxWidth: 760, margin: '0 auto', gap: 16 }}>
      <div className="row" style={{ gap: 12 }}>
        <button className="back" onClick={api.toSet}>← {set.title}</button>
        <div className="spacer" />
        <span className="badge">Aprender</span>
        {phase === 'question' && st && <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: 16 }}>Ronda {st.round}</span>}
      </div>

      <MasteryBar set={set} />

      {(phase === 'setup' || showOpts) && (
        <div className="panel stack anim-pop" style={{ borderRadius: 24, padding: 'clamp(22px,5vw,36px)', gap: 20 }}>
          {phase === 'setup' && (
            <div>
              <h2 style={{ fontSize: 'clamp(24px,4vw,30px)', fontWeight: 800, letterSpacing: '-.02em' }}>Modo Aprender</h2>
              <p className="muted" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
                Rondas de 7 términos. Primero opción múltiple; cuando aciertas, la siguiente vez lo escribes. Un término está <b>dominado</b> cuando lo escribes bien.
                Tu progreso se guarda en este navegador aunque cierres la página.
              </p>
            </div>
          )}
          <OptGroup title="Responder con">
            <Chip large active={aSide === 'def'} onClick={() => setPrefs({ answerWith: 'def' })}>Definición</Chip>
            <Chip large active={aSide === 'term'} onClick={() => setPrefs({ answerWith: 'term' })}>Término</Chip>
          </OptGroup>
          <OptGroup title="Tipos de pregunta">
            <Chip large active={prefs.mc} onClick={() => setPrefs({ mc: !prefs.mc })}>Opción múltiple</Chip>
            <Chip large active={prefs.written} onClick={() => setPrefs({ written: !prefs.written })}>Escrita</Chip>
          </OptGroup>
          <div className="row wrap" style={{ gap: 14 }}>
            {phase === 'setup' ? (
              <>
                <button className="btn btn-primary btn-xl" onClick={() => begin(1)}>{c.nuevo === c.total ? 'Empezar' : 'Continuar aprendiendo'}</button>
                <span className="muted" style={{ fontSize: 13 }}>o pulsa <Kbd>Enter</Kbd></span>
                <div className="spacer" />
                {c.nuevo < c.total && <button className="link-btn" onClick={resetProgress}>Reiniciar progreso</button>}
              </>
            ) : (
              <>
                <button className="btn btn-sm" onClick={() => setShowOpts(false)}>Cerrar opciones</button>
                <div className="spacer" />
                <button className="link-btn" style={{ color: 'var(--bad-ink)' }} onClick={() => { setShowOpts(false); resetProgress(); }}>Reiniciar progreso</button>
              </>
            )}
          </div>
        </div>
      )}

      {phase === 'question' && st && card && q && (
        <>
          <div className="row" style={{ gap: 10 }}>
            <div className="bar primary" style={{ height: 6, flex: 1 }}><div style={{ width: (roundDone / Math.max(st.queue.length, 1)) * 100 + '%' }} /></div>
            <span className="muted" style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{roundDone} / {st.queue.length}</span>
            {!showOpts && <button className="link-btn" style={{ fontSize: 14 }} onClick={() => setShowOpts(true)}>Opciones</button>}
          </div>
          <div key={q.cardId + st.pos} className="panel stack" style={{ borderRadius: 24, padding: '18px 20px 26px', gap: 6, minHeight: 200, animation: 'rp-in0 .3s ease both' }}>
            <div className="row" style={{ gap: 6 }}>
              <span className="label-xs">{(pSide === 'term' ? 'Término · ' : 'Definición · ') + langName(lang(pSide))}</span>
              <LevelPill level={levelOf((shown?.before ?? set).cards.find((x) => x.id === card.id) ?? card)} />
              <div className="spacer" />
              <button className="icon-btn lg" aria-label="Escuchar" onClick={() => api.speak(card[pSide], lang(pSide))}><SpeakerIcon /></button>
            </div>
            <div className="fc-text" style={{ padding: '12px 8px', fontSize: 'clamp(26px,4.6vw,40px)', fontWeight: 600 }}>{card[pSide]}</div>
          </div>

          {q.type === 'mc' && q.options && (
            <div className="stack" style={{ gap: 8 }}>
              <span className="eyebrow" style={{ fontWeight: 800 }}>Elige {sideName(aSide)}</span>
              <div className="mc-grid">
                {q.options.map((o, i) => {
                  let cls = 'mc-opt';
                  if (shown?.kind === 'mc') {
                    if (o === card[aSide]) cls += ' right';
                    else if (o === shown.picked) cls += ' wrong';
                    else cls += ' dim';
                  }
                  return (
                    <button key={o} className={cls} disabled={!!shown} onClick={() => answerMC(o)}>
                      <span className="kbd-sm">{i + 1}</span><span style={{ overflowWrap: 'anywhere' }}>{o}</span>
                    </button>
                  );
                })}
              </div>
              {!shown && (
                <div className="row wrap muted" style={{ justifyContent: 'space-between', fontSize: 13, gap: 10 }}>
                  <span><Kbd>1</Kbd>–<Kbd>{q.options.length}</Kbd> elegir</span>
                  <button className="link-btn" onClick={() => answerMC('')}>No lo sé</button>
                </div>
              )}
              {shown?.kind === 'mc' && (
                <div className="fb" style={{ borderColor: shown.correct ? 'var(--ok)' : 'var(--bad)', background: shown.correct ? 'var(--ok-soft)' : 'var(--bad-soft)' }} role="status">
                  <div className="fb-title" style={{ color: shown.correct ? 'var(--ok-ink)' : 'var(--bad-ink)' }}>
                    <span className="fb-glyph" style={{ background: shown.correct ? 'var(--ok)' : 'var(--bad)' }}>{shown.correct ? '✓' : '✕'}</span>
                    {shown.correct ? '¡Bien! La próxima vez lo escribes.' : 'Todavía no. Volverá a aparecer en esta ronda.'}
                  </div>
                  <div className="row"><div className="spacer" />
                    <button className="btn btn-primary" style={{ fontWeight: 800, gap: 10, paddingInline: 20 }} onClick={next} autoFocus={!shown.correct}>
                      Continuar <span style={{ padding: '0 6px', borderRadius: 5, border: '1px solid currentColor', font: '600 11px ui-monospace,Menlo,monospace', opacity: 0.8 }}>Enter</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {q.type === 'written' && (
            <>
              <div className="stack" style={{ gap: 8 }}>
                <label htmlFor="learn-answer" className="eyebrow" style={{ fontWeight: 800 }}>Escribe {sideName(aSide)} · {langName(lang(aSide))}</label>
                <div className="row wrap" style={{ gap: 10 }}>
                  <input id="learn-answer" ref={inputRef} className="answer-input" value={shown?.kind === 'written' ? shown.fb.given : input}
                    readOnly={!!shown} placeholder="Escribe tu respuesta" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                    lang={lang(aSide)} onChange={(e) => setInput(e.target.value)} />
                  {!shown && <button className="btn btn-primary btn-xl" style={{ padding: '14px 22px' }} onClick={() => answerWritten()}>Comprobar</button>}
                </div>
                {!shown && (
                  <div className="row wrap muted" style={{ justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                    <span><Kbd>Enter</Kbd> comprobar</span>
                    <button className="link-btn" onClick={() => answerWritten(true)}>No lo sé</button>
                  </div>
                )}
              </div>
              {shown?.kind === 'written' && <FeedbackBox fb={shown.fb} onOverride={override} onNext={next} />}
            </>
          )}
        </>
      )}

      {phase === 'summary' && st && <RoundSummary set={set} st={st} onNext={() => begin(st.round + 1)} onBack={api.toSet} />}

      {phase === 'done' && (
        <div className="panel stack anim-pop" style={{ borderRadius: 26, padding: 'clamp(24px,5vw,44px)', gap: 20 }}>
          <div>
            <h2 className="h2-done">¡Dominaste todo el set!</h2>
            <p className="muted" style={{ margin: '6px 0 0' }}>{plural(c.total, 'término dominado', 'términos dominados')}. Puedes repasar con Tarjetas o empezar Aprender desde cero.</p>
          </div>
          <div className="row wrap" style={{ gap: 10 }}>
            <button className="btn btn-primary btn-lg" style={{ fontWeight: 800 }} onClick={resetProgress}>Empezar de nuevo</button>
            <button className="btn btn-lg" onClick={api.toSet}>Volver al set</button>
          </div>
        </div>
      )}
    </section>
  );
}

function OptGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</span>
      <div className="row wrap" style={{ gap: 8 }} role="group" aria-label={title}>{children}</div>
    </div>
  );
}

function LevelPill({ level }: { level: Level }) {
  return <span className="level-pill" style={{ ['--lvl' as string]: LEVEL_COLORS[level] }}>{LEVEL_NAMES[level]}</span>;
}

export function MasteryBar({ set }: { set: StudySet }) {
  const c = counts(set);
  const seg = (n: number) => (c.total ? (n / c.total) * 100 : 0) + '%';
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="mastery-bar" role="img" aria-label={`${c.dominado} dominados, ${c.familiar} familiares, ${c.aprendiendo} aprendiendo, ${c.nuevo} nuevos`}>
        <div style={{ width: seg(c.dominado), background: 'var(--ok)' }} />
        <div style={{ width: seg(c.familiar), background: 'var(--primary)' }} />
        <div style={{ width: seg(c.aprendiendo), background: 'var(--warn)' }} />
      </div>
      <div className="row wrap muted" style={{ gap: '4px 16px', fontSize: 13, fontWeight: 600 }}>
        <Legend color="var(--ok)" label="Dominado" n={c.dominado} />
        <Legend color="var(--primary)" label="Familiar" n={c.familiar} />
        <Legend color="var(--warn)" label="Aprendiendo" n={c.aprendiendo} />
        <Legend color="var(--border)" label="Nuevo" n={c.nuevo} />
      </div>
    </div>
  );
}

function Legend({ color, label, n }: { color: string; label: string; n: number }) {
  return <span className="row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />{label} {n}</span>;
}

function RoundSummary({ set, st, onNext, onBack }: { set: StudySet; st: LearnState; onNext: () => void; onBack: () => void }) {
  const cards = st.roundIds.map((id) => set.cards.find((x) => x.id === id)).filter((x): x is Card => !!x);
  const pSide = promptSide(st.prefs);
  return (
    <div className="panel stack anim-pop" style={{ borderRadius: 26, padding: 'clamp(24px,5vw,40px)', gap: 20 }}>
      <div>
        <h2 className="h2-done">Ronda {st.round} completada</h2>
        <p className="muted" style={{ margin: '6px 0 0' }}>Tu progreso está guardado. Puedes seguir ahora o volver más tarde.</p>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {cards.map((c) => (
          <div key={c.id} className="row" style={{ gap: 12, padding: '10px 14px', borderRadius: 14, background: 'var(--surface2)' }}>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 700, overflowWrap: 'anywhere' }}>{c[pSide]}</span>
            <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{c[st.prefs.answerWith]}</span>
            <LevelPill level={levelOf(c)} />
          </div>
        ))}
      </div>
      <div className="row wrap" style={{ gap: 10 }}>
        <button className="btn btn-primary btn-lg" style={{ fontWeight: 800 }} onClick={onNext} autoFocus>Siguiente ronda</button>
        <button className="btn btn-lg" onClick={onBack}>Volver al set</button>
      </div>
    </div>
  );
}
