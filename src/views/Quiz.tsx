import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Side, StudySet } from '../lib/types';
import { langName, plural, shuffle } from '../lib/store';
import { cancelSpeech, ttsSupported } from '../lib/speech';
import { diffSegs, evaluate, type CheckResult, type DiffSeg } from '../lib/checkAnswer';
import type { AppApi } from '../App';
import { Chip, Kbd, SpeakerIcon } from '../components';

export type QuizMode = 'write' | 'listen';
export interface QuizPrefs { showSide: Side; hearSide: Side; writeWhat: 'same' | 'other' }
type Phase = 'setup' | 'answer' | 'feedback' | 'done';
interface Feedback { result: CheckResult | 'override'; given: string; correct: string; isFirst: boolean; segs: { expected: DiffSeg[]; given: DiffSeg[] } | null }
interface Round { queue: string[]; pos: number; total: number; first: Record<string, boolean>; errors: Record<string, string>; input: string; fb: Feedback | null; anim: number }

const other = (s: Side): Side => (s === 'term' ? 'def' : 'term');
const sideName = (s: Side) => (s === 'term' ? 'el término' : 'la definición');

export default function Quiz({ set, api, mode, prefs }: { set: StudySet; api: AppApi; mode: QuizMode; prefs: MutableRefObject<QuizPrefs> }) {
  const [opt, setOpt] = useState<QuizPrefs>({ ...prefs.current });
  const [phase, setPhase] = useState<Phase>('setup');
  const [r, setR] = useState<Round>({ queue: [], pos: 0, total: 0, first: {}, errors: {}, input: '', fb: null, anim: 0 });
  const answerRef = useRef<HTMLInputElement>(null);
  const autoT = useRef<number>();
  const isW = mode === 'write';

  const sides = isW
    ? { prompt: opt.showSide, answer: other(opt.showSide) }
    : { prompt: opt.hearSide, answer: opt.writeWhat === 'same' ? opt.hearSide : other(opt.hearSide) };
  const lang = (s: Side) => (s === 'term' ? set.termLang : set.defLang);
  const card = set.cards.find((c) => c.id === r.queue[r.pos]) ?? null;

  const setPref = (p: Partial<QuizPrefs>) => { const o = { ...opt, ...p }; setOpt(o); prefs.current = o; };

  useEffect(() => () => { window.clearTimeout(autoT.current); cancelSpeech(); }, []);

  const play = (rate = 1) => {
    if (!card) return;
    api.speak(card[sides.prompt], lang(sides.prompt), rate);
    if (phase === 'answer') answerRef.current?.focus();
  };

  // Focus input and (in listen mode) auto-play on each new question.
  useEffect(() => {
    if (phase !== 'answer') return;
    const t1 = window.setTimeout(() => answerRef.current?.focus(), 30);
    const t2 = !isW ? window.setTimeout(() => play(1), 250) : undefined;
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, r.anim]);

  const begin = (ids?: string[]) => {
    const valid = (ids ?? set.cards.map((c) => c.id)).filter((id) => set.cards.some((c) => c.id === id));
    if (!valid.length) return;
    window.clearTimeout(autoT.current);
    const queue = shuffle(valid);
    setR((x) => ({ queue, pos: 0, total: queue.length, first: {}, errors: {}, input: '', fb: null, anim: x.anim + 1 }));
    setPhase('answer');
  };

  const next = () => {
    window.clearTimeout(autoT.current);
    if (phase !== 'feedback') return;
    const pos = r.pos + 1;
    if (pos >= r.queue.length) { cancelSpeech(); setPhase('done'); setR((x) => ({ ...x, fb: null })); return; }
    setR((x) => ({ ...x, pos, input: '', fb: null, anim: x.anim + 1 }));
    setPhase('answer');
  };

  const check = (skip = false) => {
    if (phase !== 'answer' || !card) return;
    const correct = card[sides.answer], input = skip ? '' : r.input;
    const ev = evaluate(input, correct, { ignoreAccents: set.ignoreAccents });
    const isFirst = !(card.id in r.first);
    const first = { ...r.first }, errors = { ...r.errors };
    let queue = r.queue;
    if (isFirst) first[card.id] = ev.result !== 'wrong';
    if (ev.result === 'wrong') { queue = [...queue, card.id]; errors[card.id] = input.trim(); }
    api.updateCard(set.id, card.id, { known: ev.result !== 'wrong' });
    const fb: Feedback = { result: ev.result, given: input.trim(), correct, isFirst, segs: ev.result === 'almost' ? diffSegs(input, ev.alt, set.ignoreAccents) : null };
    setR((x) => ({ ...x, input, queue, first, errors, fb }));
    setPhase('feedback');
    window.clearTimeout(autoT.current);
    if (ev.result === 'correct') autoT.current = window.setTimeout(() => keys.current.next(), 1100);
  };

  const override = () => {
    if (!r.fb || r.fb.result !== 'wrong' || !card) return;
    window.clearTimeout(autoT.current);
    const id = card.id, queue = r.queue.slice(), li = queue.lastIndexOf(id);
    if (li > r.pos) queue.splice(li, 1);
    const first = { ...r.first }, errors = { ...r.errors };
    if (r.fb.isFirst) { first[id] = true; delete errors[id]; }
    api.updateCard(set.id, id, { known: true });
    setR((x) => ({ ...x, queue, first, errors, fb: x.fb && { ...x.fb, result: 'override' } }));
  };

  // Keyboard handling through a ref so the listener sees fresh state.
  const keys = useRef({ phase, check, next, begin, play });
  keys.current = { phase, check, next, begin, play };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (e.metaKey || e.altKey) return;
      const t = e.target as HTMLInputElement | null, tag = (t?.tagName || '').toLowerCase();
      const typing = (tag === 'input' && !t?.readOnly) || tag === 'textarea' || tag === 'select';
      if (e.key === 'Enter' && tag !== 'button') {
        if (k.phase === 'answer') { e.preventDefault(); k.check(); }
        else if (k.phase === 'feedback') { e.preventDefault(); k.next(); }
        else if (k.phase === 'setup' && !typing) { e.preventDefault(); k.begin(); }
        return;
      }
      if (mode === 'listen' && (k.phase === 'answer' || k.phase === 'feedback')) {
        if (e.ctrlKey && e.key === ' ') { e.preventDefault(); k.play(1); }
        else if (!typing && !e.ctrlKey && e.key.toLowerCase() === 'r') { e.preventDefault(); k.play(e.shiftKey ? 0.7 : 1); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  const active = phase === 'answer' || phase === 'feedback';

  return (
    <section className="stack" style={{ maxWidth: 760, margin: '0 auto', gap: 16 }}>
      <div className="row" style={{ gap: 12 }}>
        <button className="back" onClick={api.toSet}>← {set.title}</button>
        <div className="spacer" />
        <span className="badge">{isW ? 'Escribir' : 'Escuchar'}</span>
        {active && <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: 16 }}>{r.pos + 1} / {r.queue.length}</span>}
      </div>

      {phase === 'setup' && (
        <div className="panel stack anim-pop" style={{ borderRadius: 24, padding: 'clamp(22px,5vw,40px)', gap: 22 }}>
          <div>
            <h2 style={{ fontSize: 'clamp(24px,4vw,30px)', fontWeight: 800, letterSpacing: '-.02em' }}>{isW ? 'Modo Escribir' : 'Modo Escuchar'}</h2>
            <p className="muted" style={{ margin: '6px 0 0' }}>{plural(set.cards.length, 'tarjeta', 'tarjetas')} en esta sesión</p>
          </div>
          {isW ? (
            <OptGroup title="Se muestra">
              <Chip large active={opt.showSide === 'def'} onClick={() => setPref({ showSide: 'def' })}>Definición</Chip>
              <Chip large active={opt.showSide === 'term'} onClick={() => setPref({ showSide: 'term' })}>Término</Chip>
            </OptGroup>
          ) : (
            <>
              <OptGroup title="Qué se escucha">
                <Chip large active={opt.hearSide === 'term'} onClick={() => setPref({ hearSide: 'term' })}>Término</Chip>
                <Chip large active={opt.hearSide === 'def'} onClick={() => setPref({ hearSide: 'def' })}>Definición</Chip>
              </OptGroup>
              <OptGroup title="Qué escribes">
                <Chip large active={opt.writeWhat === 'same'} onClick={() => setPref({ writeWhat: 'same' })}>Lo mismo (dictado)</Chip>
                <Chip large active={opt.writeWhat === 'other'} onClick={() => setPref({ writeWhat: 'other' })}>El otro lado (traducción)</Chip>
              </OptGroup>
            </>
          )}
          <div style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--surface2)', fontWeight: 600, lineHeight: 1.45 }}>
            {isW
              ? `Verás ${sideName(sides.prompt)} (${langName(lang(sides.prompt))}) y escribirás ${sideName(sides.answer)} (${langName(lang(sides.answer))}).`
              : `Escucharás ${sideName(sides.prompt)} en ${langName(lang(sides.prompt))} y escribirás ${sideName(sides.answer)} (${langName(lang(sides.answer))}). El texto no se muestra hasta que respondas.`}
          </div>
          {!isW && !ttsSupported() && (
            <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--bad-soft)', color: 'var(--bad-ink)', fontWeight: 600 }}>
              Tu navegador no soporta síntesis de voz. Prueba con Chrome, Edge o Safari.
            </div>
          )}
          <div className="row wrap" style={{ gap: 14 }}>
            <button className="btn btn-primary btn-xl" onClick={() => begin()}>Empezar</button>
            <span className="muted" style={{ fontSize: 13 }}>o pulsa <Kbd>Enter</Kbd></span>
          </div>
        </div>
      )}

      {active && card && (
        <>
          <div className="bar primary" style={{ height: 6 }}><div style={{ width: (r.pos / r.queue.length) * 100 + '%' }} /></div>
          {r.pos >= r.total && (
            <div style={{ alignSelf: 'flex-start', padding: '4px 12px', borderRadius: 999, background: 'var(--warn-soft)', color: 'var(--warn-ink)', fontWeight: 700, fontSize: 13 }}>Repaso de falladas</div>
          )}
          <div key={r.anim} className="panel stack" style={{ borderRadius: 24, padding: '18px 20px 26px', gap: 6, minHeight: 220, animation: 'rp-in0 .3s ease both' }}>
            {isW ? (
              <>
                <div className="row" style={{ gap: 6 }}>
                  <span className="label-xs">{(sides.prompt === 'term' ? 'Término · ' : 'Definición · ') + langName(lang(sides.prompt))}</span>
                  <div className="spacer" />
                  <button className="icon-btn lg" aria-label="Escuchar" onClick={() => api.speak(card[sides.prompt], lang(sides.prompt))}><SpeakerIcon /></button>
                </div>
                <div className="fc-text" style={{ padding: '12px 8px', fontSize: 'clamp(26px,4.6vw,40px)', fontWeight: 600 }}>{card[sides.prompt]}</div>
              </>
            ) : (
              <div className="stack" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: '12px 0' }}>
                <span className="label-xs">Escucha {sideName(sides.prompt)}</span>
                <button className="play-btn" aria-label="Reproducir audio" onClick={() => play(1)}><SpeakerIcon size={40} /></button>
                <div className="row wrap" style={{ gap: 8, justifyContent: 'center' }}>
                  <button className="pill-btn" onClick={() => play(1)}>Repetir <span className="kbd-sm">R</span></button>
                  <button className="pill-btn" onClick={() => play(0.7)}>Lento 0.7× <span className="kbd-sm">⇧R</span></button>
                </div>
                {phase === 'feedback' && (
                  <div className="anim-pop" style={{ textAlign: 'center', animationDuration: '.25s' }}>
                    <div className="label-xs">Se escuchó</div>
                    <div style={{ fontSize: 'clamp(22px,4vw,32px)', fontWeight: 700, marginTop: 4, overflowWrap: 'anywhere' }}>{card[sides.prompt]}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <label htmlFor="answer" className="eyebrow" style={{ fontWeight: 800, letterSpacing: '.06em' }}>Escribe {sideName(sides.answer)} · {langName(lang(sides.answer))}</label>
            <div className="row wrap" style={{ gap: 10 }}>
              <input id="answer" ref={answerRef} className="answer-input" value={r.input} readOnly={phase === 'feedback'} placeholder="Escribe tu respuesta"
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} lang={lang(sides.answer)}
                onChange={(e) => { const v = e.target.value; setR((x) => ({ ...x, input: v })); }} />
              {phase === 'answer' && <button className="btn btn-primary btn-xl" style={{ padding: '14px 22px' }} onClick={() => check()}>Comprobar</button>}
            </div>
            {phase === 'answer' && (
              <div className="row wrap muted" style={{ justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                <span><Kbd>Enter</Kbd> comprobar{isW ? '' : ' · R repetir · ⇧R lento'}</span>
                <button className="link-btn" onClick={() => check(true)}>No lo sé</button>
              </div>
            )}
          </div>

          {phase === 'feedback' && r.fb && <FeedbackBox fb={r.fb} onOverride={override} onNext={next} />}
        </>
      )}

      {phase === 'done' && <Results set={set} r={r} sides={sides} onRetry={begin} onBack={api.toSet} />}
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

const FB_STYLE = {
  correct: ['Correcto', '✓', 'var(--ok)', 'var(--ok-soft)', 'var(--ok-ink)'],
  almost: ['Casi — se aceptó', '≈', 'var(--warn)', 'var(--warn-soft)', 'var(--warn-ink)'],
  wrong: ['Incorrecto', '✕', 'var(--bad)', 'var(--bad-soft)', 'var(--bad-ink)'],
  override: ['Marcada como correcta', '✓', 'var(--ok)', 'var(--ok-soft)', 'var(--ok-ink)'],
} as const;

function Segs({ segs }: { segs: DiffSeg[] }) {
  return <>{segs.map((g, i) => <span key={i} className={'seg ' + (g.mark === 'none' ? '' : g.mark)}>{g.t}</span>)}</>;
}

function FeedbackBox({ fb, onOverride, onNext }: { fb: Feedback; onOverride: () => void; onNext: () => void }) {
  const [title, glyph, border, bg, ink] = FB_STYLE[fb.result];
  return (
    <div className="fb" style={{ borderColor: border, background: bg }} role="status">
      <div className="fb-title" style={{ color: ink }}><span className="fb-glyph" style={{ background: border }}>{glyph}</span>{title}</div>
      {fb.result === 'almost' && fb.segs && (
        <div className="fb-grid">
          <div><div className="fb-label">Respuesta correcta</div><div className="fb-big"><Segs segs={fb.segs.expected} /></div></div>
          <div><div className="fb-label">Tu respuesta</div><div className="fb-big" style={{ fontWeight: 600 }}><Segs segs={fb.segs.given} /></div></div>
        </div>
      )}
      {fb.result === 'wrong' && (
        <>
          <div className="fb-grid">
            <div><div className="fb-label">Tu respuesta</div><div className="fb-big" style={{ fontWeight: 600, color: 'var(--bad-ink)' }}>{fb.given || '(sin respuesta)'}</div></div>
            <div><div className="fb-label">Respuesta correcta</div><div className="fb-big" style={{ color: 'var(--ok-ink)' }}>{fb.correct}</div></div>
          </div>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Volverá a aparecer al final de la ronda.</div>
        </>
      )}
      {(fb.result === 'correct' || fb.result === 'override') && <div className="fb-big">{fb.correct}</div>}
      <div className="row wrap" style={{ gap: 10 }}>
        {fb.result === 'wrong' && <button className="btn" onClick={onOverride}>Yo tenía razón</button>}
        <div className="spacer" />
        <button className="btn btn-primary" style={{ fontWeight: 800, gap: 10, paddingInline: 20 }} onClick={onNext}>
          Continuar <span style={{ padding: '0 6px', borderRadius: 5, border: '1px solid currentColor', font: '600 11px ui-monospace,Menlo,monospace', opacity: 0.8 }}>Enter</span>
        </button>
      </div>
    </div>
  );
}

function Results({ set, r, sides, onRetry, onBack }: { set: StudySet; r: Round; sides: { prompt: Side; answer: Side }; onRetry: (ids?: string[]) => void; onBack: () => void }) {
  const ok = Object.values(r.first).filter(Boolean).length;
  const pct = r.total ? Math.round((ok / r.total) * 100) : 0;
  const errs = Object.keys(r.errors)
    .map((id) => { const c = set.cards.find((x) => x.id === id); return c ? { id, prompt: c[sides.prompt], answer: c[sides.answer], given: r.errors[id] || '(sin respuesta)' } : null; })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const title = pct === 100 ? '¡Perfecto!' : pct >= 80 ? '¡Muy bien!' : pct >= 50 ? 'Vas por buen camino' : 'Sigue practicando';
  return (
    <div className="panel stack anim-pop" style={{ borderRadius: 26, padding: 'clamp(24px,5vw,44px)', gap: 24 }}>
      <div className="row wrap" style={{ gap: 24 }}>
        <div className="ring" style={{ background: `conic-gradient(var(--ok) ${pct * 3.6}deg, var(--surface2) 0)` }} role="img" aria-label={pct + ' % de aciertos'}>
          <div>{pct} %</div>
        </div>
        <div>
          <h2 className="h2-done">{title}</h2>
          <p className="muted" style={{ margin: '6px 0 0', fontWeight: 600 }}>{ok} de {r.total} correctas a la primera</p>
        </div>
      </div>
      {errs.length > 0 ? (
        <div className="stack" style={{ gap: 8 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800 }}>Errores ({errs.length})</h3>
          {errs.map((e) => (
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '4px 16px', padding: '12px 16px', borderRadius: 14, background: 'var(--surface2)' }}>
              <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{e.prompt}</div>
              <div style={{ color: 'var(--ok-ink)', fontWeight: 700, overflowWrap: 'anywhere' }}>{e.answer}</div>
              <div style={{ color: 'var(--bad-ink)', overflowWrap: 'anywhere' }}>Escribiste: {e.given}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--ok-soft)', color: 'var(--ok-ink)', fontWeight: 700 }}>Sin errores en esta ronda.</div>
      )}
      <div className="row wrap" style={{ gap: 10 }}>
        {errs.length > 0 && <button className="btn btn-primary btn-lg" style={{ fontWeight: 800 }} onClick={() => onRetry(errs.map((e) => e.id))}>Repasar errores</button>}
        <button className="btn btn-lg" onClick={() => onRetry()}>Repetir todo</button>
        <button className="btn btn-lg" onClick={onBack}>Volver al set</button>
      </div>
    </div>
  );
}
