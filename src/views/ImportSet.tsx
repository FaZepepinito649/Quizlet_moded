import { useRef, useState } from 'react';
import type { StudySet } from '../lib/types';
import { langOpts, plural, uid } from '../lib/store';
import { parseImport, SAMPLE_IMPORT } from '../lib/importFormat';
import { LangSelect } from '../components';

export default function ImportSet({ onBack, onImport, flash }: { onBack: () => void; onImport: (s: StudySet) => void; flash: (m: string) => void }) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [termLang, setTermLang] = useState('de-DE');
  const [defLang, setDefLang] = useState('es-MX');
  const fileRef = useRef<HTMLInputElement>(null);

  const p = parseImport(text);
  const valid = p.rows.filter((r) => r.ok);
  const bad = p.rows.length - valid.length;
  const finalTitle = (p.meta.title || title).trim();
  const canSave = valid.length > 0 && !!finalTitle;
  const opts = langOpts([termLang, defLang]);
  const meta = [
    p.meta.title && { k: 'Título', v: p.meta.title },
    p.meta.termLang && { k: 'Término', v: p.meta.termLang },
    p.meta.defLang && { k: 'Definición', v: p.meta.defLang },
  ].filter(Boolean) as { k: string; v: string }[];

  const doImport = () => {
    if (!valid.length) return flash('No hay tarjetas válidas para importar');
    if (!finalTitle) return flash('Escribe un título para el set');
    onImport({
      id: uid(), title: finalTitle, termLang: p.meta.termLang || termLang, defLang: p.meta.defLang || defLang, ignoreAccents: false, updated: Date.now(),
      cards: valid.map((r) => ({ id: uid(), term: r.term, def: r.def, starred: false, known: false })),
    });
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setText(String(r.result || ''));
    r.readAsText(f);
    e.target.value = '';
  };

  return (
    <section className="stack anim-in" style={{ gap: 22 }}>
      <div className="stack" style={{ gap: 10 }}>
        <button className="back" onClick={onBack}>← Mis sets</button>
        <h1 className="h1-sm">Importar set</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 640, lineHeight: 1.5 }}>
          Una tarjeta por línea: <code className="inline">término | definición</code> o separado por tabulador (pegar desde Excel). Las líneas con <code className="inline">#</code> se ignoran.
        </p>
      </div>
      <div className="imp-grid">
        <div className="panel stack" style={{ padding: 18, gap: 14 }}>
          <textarea className="imp-text" aria-label="Contenido a importar" value={text} spellCheck={false} onChange={(e) => setText(e.target.value)}
            placeholder={'@titulo: Vocabulario Kapitel 5\n@idioma_termino: de-DE\n@idioma_definicion: es-MX\nder Bahnhof | la estación de tren'} />
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn btn-xs" onClick={() => setText(SAMPLE_IMPORT)}>Cargar ejemplo</button>
            <button className="btn btn-xs" onClick={() => fileRef.current?.click()}>Abrir archivo .txt</button>
            <input ref={fileRef} type="file" accept=".txt,.tsv,.csv,text/plain" onChange={onFile} style={{ display: 'none' }} />
          </div>
          {!p.meta.title && (
            <label className="stack" style={{ gap: 6 }}>
              <span className="eyebrow">Título del set</span>
              <input className="field" style={{ fontSize: 16, fontWeight: 600, padding: '11px 13px' }} value={title} placeholder="Ej. Vocabulario Kapitel 5" onChange={(e) => setTitle(e.target.value)} />
            </label>
          )}
          {(!p.meta.termLang || !p.meta.defLang) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
              {!p.meta.termLang && <LangSelect label="Idioma del término" value={termLang} options={opts} onChange={setTermLang} />}
              {!p.meta.defLang && <LangSelect label="Idioma de la definición" value={defLang} options={opts} onChange={setDefLang} />}
            </div>
          )}
        </div>
        <div className="panel stack" style={{ padding: 18, gap: 12 }}>
          <div className="row wrap" style={{ justifyContent: 'space-between', gap: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Vista previa</h2>
            <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
              {p.rows.length ? plural(valid.length, 'tarjeta válida', 'tarjetas válidas') + (bad ? ' · ' + plural(bad, 'línea sin separador', 'líneas sin separador') : '') : ''}
            </span>
          </div>
          {meta.length > 0 && (
            <div className="row wrap" style={{ gap: 6 }}>
              {meta.map((m) => <span key={m.k} className="badge" style={{ fontWeight: 700, padding: '4px 10px' }}>{m.k}: {m.v}</span>)}
            </div>
          )}
          {p.rows.length === 0 && <div className="empty">Pega tu lista a la izquierda para ver cómo se interpreta.</div>}
          <div className="stack" style={{ gap: 6, maxHeight: 420, overflow: 'auto' }}>
            {p.rows.map((r) => (
              <div key={r.n} className={'imp-row' + (r.ok ? '' : ' bad')}>
                <span className="muted" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{r.n}</span>
                {r.ok ? (
                  <>
                    <span style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{r.term}</span>
                    <span style={{ overflowWrap: 'anywhere' }}>{r.def}</span>
                  </>
                ) : (
                  <>
                    <span style={{ color: 'var(--bad-ink)', fontWeight: 600, overflowWrap: 'anywhere' }}>{r.raw}</span>
                    <span style={{ color: 'var(--bad-ink)', fontSize: 13, fontWeight: 700 }}>{r.term || r.def ? 'Falta término o definición' : 'Sin separador'} — no se importará</span>
                  </>
                )}
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-xl" style={{ marginTop: 4, paddingInline: 22, paddingBlock: 13 }} disabled={!canSave} onClick={doImport}>
            {valid.length ? 'Importar ' + plural(valid.length, 'tarjeta', 'tarjetas') : 'Importar'}
          </button>
        </div>
      </div>
    </section>
  );
}
