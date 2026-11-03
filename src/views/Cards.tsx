import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Side, StudySet } from '../lib/types';
import { langName, plural, shuffle } from '../lib/store';
import type { AppApi } from '../App';
import { resumeCards } from '../lib/sessions';
import { Chip, Kbd, SpeakerIcon, StarButton } from '../components';

export interface CardPrefs { shuffle: boolean; startSide: Side; starredOnly: boolean }
type Mark = 'know' | 'learn';
interface Round { ids: string[]; index: number; flipped: boolean; results: Record<string, Mark>; done: boolean; anim: number }

function buildDeck(set: StudySet, opt: CardPrefs): string[] {
  let cs = set.cards;
  if (opt.starredOnly) cs = cs.filter((c) => c.starred);
  const ids = cs.map((c) => c.id);
  return opt.shuffle ? shuffle(ids) : ids;
}

export default function Cards({ set, api, prefs }: { set: StudySet; api: AppApi; prefs: MutableRefObject<CardPrefs> }) {
  // Resume a round saved in a previous visit (it survives closing the page).
  const [saved] = useState(() => resumeCards(set));
  const [resumed, setResumed] = useState(!!saved && saved.index > 0);
  const [opt, setOpt] = useState<CardPrefs>(() => {
    if (saved) return { ...saved.opt };
    const o = { ...prefs.current };
    if (o.starredOnly && !set.cards.some((c) => c.starred)) o.starredOnly = false;
    return o;
  });
  const [r, setR] = useState<Round>(() => saved
    ? { ids: saved.ids, index: saved.index, flipped: false, results: saved.results, done: false, anim: 0 }
    : { ids: buildDeck(set, opt), index: 0, flipped: false, results: {}, done: false, anim: 0 });

  // Save the round after every move; a finished round is cleared.
  useEffect(() => {
    api.updateSet(set.id, (s) => ({ ...s, cardsSession: r.done ? undefined : { opt, ids: r.ids, index: r.index, results: r.results } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.ids, r.index, r.results, r.done, opt]);

  const updateOpt = (p: Partial<CardPrefs>) => {
    const o = { ...opt, ...p };
    setOpt(o);
    prefs.current = o;
    return o;
  };
  const rebuild = (p: Partial<CardPrefs>, onlyIds?: string[]) => {
    const o = { ...opt, ...p };
    let ids = onlyIds ?? buildDeck(set, o);
    if (onlyIds && o.shuffle) ids = shuffle(ids);
    if (!ids.length) return api.flash('No hay tarjetas marcadas con estrella');
    updateOpt(p);
    setResumed(false);
    setR((x) => ({ ids, index: 0, flipped: false, results: {}, done: false, anim: x.anim + 1 }));
  };

  const cardId = r.ids[r.index];
  const card = set.cards.find((c) => c.id === cardId) ?? { id: '', term: '', def: '', starred: false, known: false };
  const tf = opt.startSide === 'term';
  const front = tf ? card.term : card.def, back = tf ? card.def : card.term;
  const fl = tf ? set.termLang : set.defLang, bl = tf ? set.defLang : set.termLang;

  const flip = () => setR((x) => (x.done ? x : { ...x, flipped: !x.flipped }));
  const go = (delta: number, extra?: Partial<Round>) => setR((x) => {
    if (x.done) return x;
    const i = x.index + delta;
    if (i < 0) return x;
    if (i >= x.ids.length) return { ...x, ...extra, done: true };
    return { ...x, ...extra, index: i, flipped: false, anim: x.anim + 1 };
  });
  const mark = (kind: Mark) => {
    if (r.done || !cardId) return;
    api.updateCard(set.id, cardId, { known: kind === 'know' });
    go(1, { results: { ...r.results, [cardId]: kind } });
  };
  const toggleStar = () => { if (card.id) api.updateCard(set.id, card.id, { starred: !card.starred }); };
  const setSide = (s: Side) => { updateOpt({ startSide: s }); setR((x) => ({ ...x, flipped: false, anim: x.anim + 1 })); };

  // Keyboard: latest handlers via ref so the listener is registered once.
  const keys = useRef({ flip, go, mark, toggleStar, done: r.done });
  keys.current = { flip, go, mark, toggleStar, done: r.done };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (k.done || e.metaKey || e.altKey || e.ctrlKey) return;
      const t = e.target as HTMLElement | null, tag = (t?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (tag === 'button' && (e.key === ' ' || e.key === 'Enter')) return;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); k.flip(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); k.go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); k.go(-1); }
      else if (e.key === '1') k.mark('learn');
      else if (e.key === '2') k.mark('know');
      else if (e.key.toLowerCase() === 's') k.toggleStar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const stop = (f: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); f(); };
  const vals = Object.values(r.results);
  const knownN = vals.filter((x) => x === 'know').length, learnN = vals.filter((x) => x === 'learn').length;
  const starredN = set.cards.filter((c) => c.starred).length;
  const progress = ((r.done ? r.ids.length : r.index) / r.ids.length) * 100;

  return (
    <section className="stack" style={{ maxWidth: 820, margin: '0 auto', gap: 16 }}>
      <div className="row" style={{ gap: 12 }}>
        <button className="back" onClick={api.toSet}>← {set.title}</button>
        <div className="spacer" />
        <span className="badge">Tarjetas</span>
        <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: 16 }} aria-live="polite">
          {Math.min(r.index + 1, r.ids.length)} / {r.ids.length}
        </span>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <Chip active={opt.shuffle} onClick={() => rebuild({ shuffle: !opt.shuffle })}>Barajar</Chip>
        <Chip active={tf} onClick={() => setSide('term')}>Término primero</Chip>
        <Chip active={!tf} onClick={() => setSide('def')}>Definición primero</Chip>
        <Chip active={opt.starredOnly} onClick={() => rebuild({ starredOnly: !opt.starredOnly })}>★ Solo con estrella ({starredN})</Chip>
      </div>
      <div className="bar primary" style={{ height: 6 }}><div style={{ width: progress + '%' }} /></div>
      {resumed && !r.done && (
        <div className="resume-note">
          <span>Continúas donde lo dejaste.</span>
          <button className="link-btn" onClick={() => rebuild({})}>Empezar de nuevo</button>
        </div>
      )}

      {!r.done ? (
        <>
          <div className="fc-scene" key={r.anim} style={{ animation: 'rp-in0 .35s ease both' }}>
            <div className={'fc-card' + (r.flipped ? ' flipped' : '')} onClick={flip}>
              <div className="fc-face" aria-hidden={r.flipped}>
                <FaceHeader label={(tf ? 'Término · ' : 'Definición · ') + langName(fl)} starred={card.starred}
                  onStar={stop(toggleStar)} onSpeak={stop(() => api.speak(front, fl))} />
                <div className="fc-text" style={{ fontSize: 'clamp(26px,4.6vw,44px)', fontWeight: 600 }}>{front}</div>
                <div className="muted" style={{ textAlign: 'center', fontSize: 13 }}>Haz clic o pulsa Espacio para voltear</div>
              </div>
              <div className="fc-face back" aria-hidden={!r.flipped}>
                <FaceHeader back label={(tf ? 'Definición · ' : 'Término · ') + langName(bl)} starred={card.starred}
                  onStar={stop(toggleStar)} onSpeak={stop(() => api.speak(back, bl))} />
                <div className="fc-text" style={{ fontSize: 'clamp(24px,4.2vw,40px)', fontWeight: 500, lineHeight: 1.3 }}>{back}</div>
                <div className="muted" style={{ textAlign: 'center', fontSize: 13 }}>¿Lo sabías?</div>
              </div>
            </div>
          </div>
          <div className="fc-controls">
            <button className="fc-nav" aria-label="Anterior" style={{ opacity: r.index === 0 ? 0.4 : 1 }} onClick={() => go(-1)}>←</button>
            <button className="fc-mark learn" onClick={() => mark('learn')}>Sigo aprendiendo</button>
            <button className="fc-mark know" onClick={() => mark('know')}>Ya lo sé</button>
            <button className="fc-nav" aria-label="Siguiente" onClick={() => go(1)}>→</button>
          </div>
          <div className="hints">
            <span><Kbd>Espacio</Kbd>voltear</span>
            <span><Kbd>← →</Kbd>navegar</span>
            <span><Kbd>1</Kbd>sigo aprendiendo</span>
            <span><Kbd>2</Kbd>ya lo sé</span>
            <span><Kbd>S</Kbd>estrella</span>
          </div>
        </>
      ) : (
        <div className="panel stack anim-pop" style={{ borderRadius: 26, padding: 'clamp(24px,5vw,44px)', gap: 22 }}>
          <div>
            <h2 className="h2-done">{learnN === 0 && knownN > 0 ? '¡Muy bien! Ya te las sabes todas.' : 'Ronda terminada'}</h2>
            <p className="muted" style={{ margin: '6px 0 0' }}>{plural(r.ids.length, 'tarjeta repasada', 'tarjetas repasadas')}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            <div className="stat" style={{ background: 'var(--ok-soft)', color: 'var(--ok-ink)' }}><b>{knownN}</b><span>Ya lo sé</span></div>
            <div className="stat" style={{ background: 'var(--bad-soft)', color: 'var(--bad-ink)' }}><b>{learnN}</b><span>Sigo aprendiendo</span></div>
          </div>
          <div className="row wrap" style={{ gap: 10 }}>
            {learnN > 0 && (
              <button className="btn btn-primary btn-lg" style={{ fontWeight: 800 }} autoFocus
                onClick={() => rebuild({}, r.ids.filter((id) => r.results[id] === 'learn'))}>
                Repasar {plural(learnN, 'tarjeta', 'tarjetas')} de “Sigo aprendiendo”
              </button>
            )}
            <button className="btn btn-lg" onClick={() => rebuild({})}>Empezar de nuevo</button>
            <button className="btn btn-lg" onClick={api.toSet}>Volver al set</button>
          </div>
        </div>
      )}
    </section>
  );
}

function FaceHeader({ label, starred, onStar, onSpeak, back }: { label: string; starred: boolean; onStar: (e: React.MouseEvent) => void; onSpeak: (e: React.MouseEvent) => void; back?: boolean }) {
  return (
    <div className="row" style={{ gap: 4 }}>
      <span className="label-xs" style={back ? { color: 'var(--primary)' } : undefined}>{label}</span>
      <div className="spacer" />
      <StarButton large starred={starred} onClick={onStar} />
      <button className="icon-btn lg" aria-label="Escuchar" onClick={onSpeak}><SpeakerIcon /></button>
    </div>
  );
}
