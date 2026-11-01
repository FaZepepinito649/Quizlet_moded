// Tolerant answer checking: normalization + weighted Damerau-Levenshtein (OSA).

export type CheckResult = 'correct' | 'almost' | 'wrong';
export interface CheckOptions { ignoreAccents?: boolean }
export interface Evaluation { result: CheckResult; alt: string; cost: number; over: number }
export interface DiffSeg { t: string; mark: 'none' | 'expected' | 'given' }

/** Case-insensitive, trimmed, collapsed spaces, no trailing . , ! ? (and no leading ¡ ¿). */
export function norm(s: unknown): string {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[¡¿]+/, '')
    .replace(/[.,!?]+$/, '')
    .trim();
}

/** ä/ö/ü/ß → ae/oe/ue/ss (always accepted as equivalent). */
export const expand = (s: string) =>
  s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

/** Remove combining diacritics. */
export const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

let adjCache: Set<string> | null = null;
/** Pairs of physically adjacent keys on QWERTY and QWERTZ layouts. */
function adjSet(): Set<string> {
  if (adjCache) return adjCache;
  const set = new Set<string>();
  const add = (a: string, b: string) => { set.add(a + b); set.add(b + a); };
  const layouts = [
    ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
    ['qwertzuiopü', 'asdfghjklöä', 'yxcvbnm'],
  ];
  for (const rows of layouts) {
    rows.forEach((r, ri) => {
      for (let i = 0; i < r.length; i++) {
        if (i + 1 < r.length) add(r[i], r[i + 1]);
        const n = rows[ri + 1];
        if (n) for (const k of [i - 1, i]) if (k >= 0 && k < n.length) add(r[i], n[k]);
      }
    });
  }
  add('z', 'y'); // QWERTY ↔ QWERTZ swap
  return (adjCache = set);
}

type Eq = (x: string, y: string) => boolean;

/** Weighted OSA distance. a = given answer, b = correct answer. */
export function dl(a: string, b: string, eq: Eq = (x, y) => x === y) {
  const adj = adjSet(), n = a.length, m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  // Extra char in answer: 0.5 if it's an extra space or a doubled letter (sticky key).
  const extra = (i: number) => (a[i - 1] === ' ' || (i > 1 && a[i - 1] === a[i - 2]) ? 0.5 : 1);
  // Missing char: 0.5 if it's a missing space.
  const miss = (j: number) => (b[j - 1] === ' ' ? 0.5 : 1);
  const sub = (i: number, j: number) =>
    eq(a[i - 1], b[j - 1]) ? 0 : adj.has(a[i - 1].toLowerCase() + b[j - 1].toLowerCase()) ? 0.5 : 1;
  const trans = (i: number, j: number) =>
    i > 1 && j > 1 && eq(a[i - 1], b[j - 2]) && eq(a[i - 2], b[j - 1]) && !eq(a[i - 1], b[j - 1]);
  for (let i = 1; i <= n; i++) d[i][0] = d[i - 1][0] + extra(i);
  for (let j = 1; j <= m; j++) d[0][j] = d[0][j - 1] + miss(j);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let v = Math.min(d[i - 1][j] + extra(i), d[i][j - 1] + miss(j), d[i - 1][j - 1] + sub(i, j));
      if (trans(i, j)) v = Math.min(v, d[i - 2][j - 2] + 0.5);
      d[i][j] = v;
    }
  }
  return { cost: d[n][m], d, extra, miss, sub, trans };
}

function variants(s: string, ignore?: boolean): string[] {
  const e = expand(s);
  const out = [e];
  if (ignore) { out.push(strip(e)); out.push(strip(s).replace(/ß/g, 'ss')); }
  return out;
}

const threshold = (len: number) => (len <= 4 ? 0.5 : len <= 10 ? 1 : 2);

export function evaluate(resp: string, correct: string, opts: CheckOptions = {}): Evaluation {
  const full = String(correct || '').trim();
  const alts = [...new Set([full, ...full.split('/').map((x) => x.trim()).filter(Boolean)])];
  const rank: Record<CheckResult, number> = { correct: 0, almost: 1, wrong: 2 };
  let best: Evaluation = { result: 'wrong', alt: full, cost: Infinity, over: Infinity };
  const a = norm(resp);
  if (!a) return best;
  for (const alt of alts) {
    const c = norm(alt);
    if (!c) continue;
    const thr = threshold(c.length);
    const av = variants(a, opts.ignoreAccents), cv = variants(c, opts.ignoreAccents);
    let cost = Infinity;
    for (let k = 0; k < av.length; k++) {
      if (av[k] === cv[k]) { cost = 0; break; }
      cost = Math.min(cost, dl(av[k], cv[k]).cost);
    }
    const result: CheckResult = cost === 0 ? 'correct' : cost <= thr ? 'almost' : 'wrong';
    const cand = { result, alt, cost, over: cost - thr };
    if (rank[result] < rank[best.result] || (rank[result] === rank[best.result] && cand.over < best.over)) best = cand;
  }
  return best;
}

export function checkAnswer(resp: string, correct: string, opts?: CheckOptions): CheckResult {
  return evaluate(resp, correct, opts).result;
}

/** Character-level diff segments for the "Casi — se aceptó" feedback. */
export function diffSegs(resp: string, alt: string, ignore?: boolean): { expected: DiffSeg[]; given: DiffSeg[] } {
  const aD = String(resp || '').replace(/\s+/g, ' ').trim().replace(/[.,!?]+$/, '').trim();
  const bD = String(alt || '').trim();
  const a = aD.toLowerCase(), b = bD.toLowerCase();
  const eq: Eq = (x, y) => x === y || (!!ignore && strip(x) === strip(y));
  const r = dl(a, b, eq), d = r.d;
  const close = (x: number, y: number) => Math.abs(x - y) < 1e-9;
  const mA = new Array<boolean>(a.length).fill(false), mB = new Array<boolean>(b.length).fill(false);
  let i = a.length, j = b.length;
  while (i > 0 || j > 0) {
    const cur = d[i][j];
    if (i > 0 && j > 0 && close(cur, d[i - 1][j - 1] + r.sub(i, j))) {
      if (r.sub(i, j) > 0) mA[i - 1] = mB[j - 1] = true;
      i--; j--;
    } else if (r.trans(i, j) && close(cur, d[i - 2][j - 2] + 0.5)) {
      mA[i - 1] = mA[i - 2] = mB[j - 1] = mB[j - 2] = true;
      i -= 2; j -= 2;
    } else if (i > 0 && close(cur, d[i - 1][j] + r.extra(i))) {
      mA[i - 1] = true; i--;
    } else {
      mB[j - 1] = true; j--;
    }
  }
  const segs = (str: string, marks: boolean[], kind: 'expected' | 'given'): DiffSeg[] => {
    const out: DiffSeg[] = [];
    let buf = '', st: boolean | null = null;
    const push = () => { if (buf) out.push({ t: buf, mark: st ? kind : 'none' }); };
    for (let k = 0; k < str.length; k++) {
      if (marks[k] !== st) { push(); buf = ''; st = marks[k]; }
      buf += str[k];
    }
    push();
    return out;
  };
  return { expected: segs(bD, mB, 'expected'), given: segs(aD, mA, 'given') };
}
