import { useEffect, useRef, useState } from 'react';
import type { StudySet } from '../lib/types';
import { langName, plural } from '../lib/store';
import type { AppApi } from '../App';
import { SpeakerIcon, StarButton, Switch } from '../components';

interface Props {
  set: StudySet; api: AppApi;
  onBack: () => void; onEdit: () => void; onExport: () => void; onDelete: () => void;
  onCards: () => void; onWrite: () => void; onListen: () => void;
}

export default function SetView({ set, api, onBack, onEdit, onExport, onDelete, onCards, onWrite, onListen }: Props) {
  const [confirmDel, setConfirmDel] = useState(false);
  const delT = useRef<number>();
  useEffect(() => () => window.clearTimeout(delT.current), []);
  const cards = set.cards;
  const known = cards.filter((c) => c.known).length;
  const pct = cards.length ? Math.round((known / cards.length) * 100) : 0;

  const del = () => {
    if (!confirmDel) {
      setConfirmDel(true);
      window.clearTimeout(delT.current);
      delT.current = window.setTimeout(() => setConfirmDel(false), 3000);
      return;
    }
    onDelete();
  };

  return (
    <section className="stack anim-in" style={{ gap: 26 }}>
      <div className="stack" style={{ gap: 10 }}>
        <button className="back" onClick={onBack}>← Mis sets</button>
        <div className="row wrap" style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 'clamp(28px,4.5vw,40px)', fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1.1, textWrap: 'balance' } as React.CSSProperties}>{set.title}</h1>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 600 }}>
              {plural(cards.length, 'término', 'términos')} · {langName(set.termLang)} → {langName(set.defLang)}
            </p>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn btn-sm hover-ink" onClick={onEdit}>Editar</button>
            <button className="btn btn-sm hover-ink" onClick={onExport}>Exportar set</button>
            <button className="btn btn-sm btn-danger" onClick={del}>{confirmDel ? '¿Seguro? Pulsa otra vez' : 'Eliminar'}</button>
          </div>
        </div>
      </div>

      <div className="grid-modes">
        <button className="tile mode-tile" onClick={onCards}>
          <span className="mode-icon">
            <span style={{ position: 'relative', width: 24, height: 18, display: 'block' }}>
              <span style={{ position: 'absolute', inset: 0, border: '2.5px solid currentColor', borderRadius: 5, transform: 'translate(4px,-4px)', opacity: 0.45 }} />
              <span style={{ position: 'absolute', inset: 0, border: '2.5px solid currentColor', borderRadius: 5, background: 'var(--primary-soft)' }} />
            </span>
          </span>
          <ModeText title="Tarjetas" sub="Voltea y repasa" />
        </button>
        <button className="tile mode-tile" onClick={onWrite}>
          <span className="mode-icon" style={{ fontWeight: 800, fontSize: 20 }}>Aa</span>
          <ModeText title="Escribir" sub="Escribe la respuesta" />
        </button>
        <button className="tile mode-tile" onClick={onListen}>
          <span className="mode-icon"><SpeakerIcon size={26} /></span>
          <ModeText title="Escuchar" sub="Dictado y traducción" />
        </button>
      </div>

      <div className="grid-2">
        <div className="panel stack" style={{ borderRadius: 18, padding: '18px 20px', gap: 10, justifyContent: 'center' }}>
          <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
            <span>Progreso</span><span className="muted">Dominas {known} de {cards.length}</span>
          </div>
          <div className="bar" style={{ height: 10 }}><div style={{ width: pct + '%' }} /></div>
        </div>
        <div className="panel row" style={{ borderRadius: 18, padding: '18px 20px', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Ignorar acentos</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>“estacion” cuenta como “estación”. ä/ö/ü/ß siempre aceptan ae/oe/ue/ss.</div>
          </div>
          <Switch on={set.ignoreAccents} label="Ignorar acentos" onToggle={() => api.updateSet(set.id, (x) => ({ ...x, ignoreAccents: !x.ignoreAccents }))} />
        </div>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <div className="row wrap" style={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Términos <span className="muted" style={{ fontWeight: 600 }}>({cards.length})</span></h2>
          <span className="muted" style={{ fontSize: 13 }}>Haz clic en un texto para editarlo</span>
        </div>
        {cards.map((c) => (
          <div key={c.id} className="panel row" style={{ borderRadius: 16, padding: '10px 12px 10px 18px', gap: 10 }}>
            <span title={c.known ? 'Ya lo sabes' : 'Sigues aprendiendo'} style={{ width: 8, height: 8, borderRadius: '50%', background: c.known ? 'var(--ok)' : 'var(--border)', flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '2px 18px' }}>
              <input className="inline-input" style={{ fontWeight: 700 }} aria-label="Término" value={c.term}
                onChange={(e) => api.updateCard(set.id, c.id, { term: e.target.value })} />
              <input className="inline-input" aria-label="Definición" value={c.def}
                onChange={(e) => api.updateCard(set.id, c.id, { def: e.target.value })} />
            </div>
            <button className="icon-btn" aria-label="Escuchar término" onClick={() => api.speak(c.term, set.termLang)}><SpeakerIcon size={18} waves={1} /></button>
            <StarButton starred={c.starred} onClick={() => api.updateCard(set.id, c.id, { starred: !c.starred })} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ModeText({ title, sub }: { title: string; sub: string }) {
  return (
    <span className="stack" style={{ gap: 2 }}>
      <span style={{ fontWeight: 800, fontSize: 19 }}>{title}</span>
      <span className="muted" style={{ fontSize: 14 }}>{sub}</span>
    </span>
  );
}
