import type { ReactNode } from 'react';

export function SpeakerIcon({ size = 22, waves = 2 }: { size?: number; waves?: 1 | 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      {waves === 2 && <path d="M19 6a8.5 8.5 0 0 1 0 12" />}
    </svg>
  );
}

export function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" className="switch" role="switch" aria-checked={on} aria-label={label} onClick={onToggle}>
      <span />
    </button>
  );
}

export function Chip({ active, onClick, children, large }: { active: boolean; onClick: () => void; children: ReactNode; large?: boolean }) {
  return (
    <button type="button" className={'chip' + (large ? ' lg' : '')} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

export function StarButton({ starred, onClick, large }: { starred: boolean; onClick: (e: React.MouseEvent) => void; large?: boolean }) {
  return (
    <button
      type="button"
      className={'icon-btn star' + (large ? ' lg' : '')}
      aria-label={starred ? 'Quitar estrella' : 'Marcar con estrella'}
      aria-pressed={starred}
      onClick={onClick}
      style={{ color: starred ? 'var(--star)' : 'var(--muted)' }}
    >
      {starred ? '★' : '☆'}
    </button>
  );
}

export function LangSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { code: string; name: string }[]; label: string }) {
  return (
    <label className="stack" style={{ gap: 6 }}>
      <span className="eyebrow">{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
    </label>
  );
}
