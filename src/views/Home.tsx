import type { StudySet } from '../lib/types';
import { plural } from '../lib/store';

export default function Home({ sets, onOpen, onNew, onImport }: { sets: StudySet[]; onOpen: (id: string) => void; onNew: () => void; onImport: () => void }) {
  const total = sets.reduce((n, x) => n + x.cards.length, 0);
  return (
    <section className="anim-in">
      <div className="row wrap" style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 26 }}>
        <div>
          <h1 className="h1">Mis sets</h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 16 }}>
            {sets.length ? plural(sets.length, 'set', 'sets') + ' · ' + plural(total, 'término', 'términos') : 'Aún no tienes sets'}
          </p>
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <button className="btn hover-ink" onClick={onImport}>Importar set</button>
          <button className="btn btn-primary" style={{ paddingInline: 20 }} onClick={onNew}>+ Crear set</button>
        </div>
      </div>
      {sets.length > 0 ? (
        <div className="grid-sets">
          {sets.map((x) => {
            const k = x.cards.filter((c) => c.known).length;
            const p = x.cards.length ? Math.round((k / x.cards.length) * 100) : 0;
            return (
              <button key={x.id} className="tile set-tile" onClick={() => onOpen(x.id)}>
                <div style={{ fontWeight: 700, fontSize: 19, lineHeight: 1.25, textWrap: 'pretty' } as React.CSSProperties}>{x.title}</div>
                <div className="row wrap" style={{ gap: 6 }}>
                  <span className="pill">{plural(x.cards.length, 'término', 'términos')}</span>
                  <span className="pill" style={{ fontWeight: 600 }}>{x.termLang} → {x.defLang}</span>
                </div>
                <div className="stack" style={{ marginTop: 'auto', gap: 7, width: '100%' }}>
                  <div className="bar"><div style={{ width: p + '%' }} /></div>
                  <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{p === 100 ? 'Dominado' : p + ' % dominado'}</div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '2px dashed var(--border)', borderRadius: 20, padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>Todavía no hay sets</div>
          <p className="muted" style={{ margin: 0, maxWidth: 420 }}>Crea tu primer set de tarjetas o pega una lista para importarla.</p>
        </div>
      )}
    </section>
  );
}
