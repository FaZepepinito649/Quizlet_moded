import { useEffect, useRef, useState } from 'react';
import type { Card } from '../lib/types';
import { langOpts, newCard } from '../lib/store';
import { LangSelect, Switch } from '../components';

export interface Draft { id: string | null; title: string; termLang: string; defLang: string; ignoreAccents: boolean; rows: Card[] }

export default function EditSet({ initial, onCancel, onSave }: { initial: Draft; onCancel: () => void; onSave: (d: Draft) => void }) {
  const [d, setD] = useState<Draft>(initial);
  const focusId = useRef<string | null>(null);
  const patch = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const patchRow = (id: string, p: Partial<Card>) => setD((x) => ({ ...x, rows: x.rows.map((r) => (r.id === id ? { ...r, ...p } : r)) }));
  const move = (i: number, dir: number) => setD((x) => {
    const j = i + dir;
    if (j < 0 || j >= x.rows.length) return x;
    const rows = x.rows.slice();
    [rows[i], rows[j]] = [rows[j], rows[i]];
    return { ...x, rows };
  });
  const del = (id: string) => setD((x) => ({ ...x, rows: x.rows.filter((r) => r.id !== id) }));
  const add = () => { const r = newCard(); focusId.current = r.id; setD((x) => ({ ...x, rows: [...x.rows, r] })); };

  useEffect(() => {
    if (!focusId.current) return;
    document.querySelector<HTMLInputElement>('[data-row="' + focusId.current + '"]')?.focus();
    focusId.current = null;
  }, [d.rows.length]);

  const opts = langOpts([d.termLang, d.defLang]);
  const save = () => onSave(d);

  return (
    <section className="stack anim-in" style={{ maxWidth: 880, margin: '0 auto', gap: 22 }}>
      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>
        <h1 className="h1-sm">{d.id ? 'Editar set' : 'Crear set'}</h1>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" style={{ padding: '10px 16px' }} onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" style={{ padding: '10px 20px' }} onClick={save}>Guardar</button>
        </div>
      </div>
      <div className="panel stack" style={{ padding: 22, gap: 18 }}>
        <label className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">Título</span>
          <input className="field" style={{ fontSize: 18, fontWeight: 700 }} value={d.title} placeholder="Ej. Vocabulario Kapitel 5"
            onChange={(e) => patch({ title: e.target.value })} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
          <LangSelect label="Idioma del término" value={d.termLang} options={opts} onChange={(v) => patch({ termLang: v })} />
          <LangSelect label="Idioma de la definición" value={d.defLang} options={opts} onChange={(v) => patch({ defLang: v })} />
        </div>
        <div className="row" style={{ gap: 14 }}>
          <Switch on={d.ignoreAccents} label="Ignorar acentos" onToggle={() => patch({ ignoreAccents: !d.ignoreAccents })} />
          <span style={{ fontWeight: 600 }}>Ignorar acentos al comprobar</span>
        </div>
      </div>
      <div className="stack" style={{ gap: 12 }}>
        {d.rows.map((r, i) => (
          <div key={r.id} className="panel" style={{ borderRadius: 18, overflow: 'hidden' }}>
            <div className="row" style={{ gap: 4, padding: '8px 10px 8px 18px', borderBottom: '1px solid var(--border)' }}>
              <span className="muted" style={{ fontWeight: 800, fontSize: 14, flex: 1 }}>{i + 1}</span>
              <button className="edit-row-btn" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className="edit-row-btn" aria-label="Bajar" disabled={i === d.rows.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button className="edit-row-btn del" aria-label="Borrar tarjeta" onClick={() => del(r.id)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '12px 24px', padding: '14px 18px 18px' }}>
              <label className="stack" style={{ gap: 4 }}>
                <input className="line-input" data-row={r.id} value={r.term} placeholder="Término" onChange={(e) => patchRow(r.id, { term: e.target.value })} />
                <span className="eyebrow" style={{ fontSize: 12 }}>Término</span>
              </label>
              <label className="stack" style={{ gap: 4 }}>
                <input className="line-input" value={r.def} placeholder="Definición" onChange={(e) => patchRow(r.id, { def: e.target.value })} />
                <span className="eyebrow" style={{ fontSize: 12 }}>Definición</span>
              </label>
            </div>
          </div>
        ))}
        <button onClick={add} className="add-row" style={{ padding: 22, borderRadius: 18, border: '2px dashed var(--border)', background: 'transparent', fontWeight: 800, fontSize: 16, color: 'var(--muted)', cursor: 'pointer', transition: 'border-color .15s,color .15s' }}>
          + Añadir tarjeta
        </button>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-xl" onClick={save}>Guardar set</button>
      </div>
    </section>
  );
}
