// ============================================================
// Построчное сравнение текстов (браузерный аналог difflib)
// Алгоритм: LCS (наибольшая общая подпоследовательность)
// ============================================================

export type DiffType = 'same' | 'add' | 'del';

export interface DiffLine {
  type: DiffType;
  text: string;
}

export interface DiffChunk {
  lines: DiffLine[];
}

/** Построчный diff двух текстов: удалённые строки (del) и добавленные (add) */
export function diffLines(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;

  // Таблица длин LCS (n+1) x (m+1)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Обратный ход: восстанавливаем последовательность изменений
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i] });
      i++;
    } else {
      out.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) { out.push({ type: 'del', text: a[i] }); i++; }
  while (j < m) { out.push({ type: 'add', text: b[j] }); j++; }
  return out;
}

/** Нарезка diff на компактные блоки с контекстом (как unified diff, context=3) */
export function toChunks(lines: DiffLine[], context = 3): DiffChunk[] {
  const changeIdx: number[] = [];
  lines.forEach((l, idx) => { if (l.type !== 'same') changeIdx.push(idx); });
  if (changeIdx.length === 0) return [];

  const ranges: Array<[number, number]> = [];
  for (const idx of changeIdx) {
    const s = Math.max(0, idx - context);
    const e = Math.min(lines.length - 1, idx + context);
    const last = ranges[ranges.length - 1];
    if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e);
    else ranges.push([s, e]);
  }
  return ranges.map(([s, e]) => ({ lines: lines.slice(s, e + 1) }));
}

/** Количество добавленных и удалённых строк */
export function diffStats(lines: DiffLine[]): { adds: number; dels: number } {
  let adds = 0;
  let dels = 0;
  for (const l of lines) {
    if (l.type === 'add') adds++;
    if (l.type === 'del') dels++;
  }
  return { adds, dels };
}
