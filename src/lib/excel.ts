// ============================================================
// Excel/CSV: разбор файлов для импорта с маппингом колонок
// и экспорт матрицы требований.
// ============================================================

import * as XLSX from 'xlsx';
import { REQ_TYPE_LABEL, VALIDITY_META, fsStatus, normalizeReqType, testsStatus } from '../domain/logic';
import type { ReqType, Requirement, RequirementDraft } from '../domain/types';

/** Цель маппинга при импорте */
export type ImportField = keyof RequirementDraft;

export const IMPORT_FIELDS: Array<{ field: ImportField; label: string; required?: boolean }> = [
  { field: 'title', label: 'Название', required: true },
  { field: 'reqType', label: 'Тип' },
  { field: 'description', label: 'Описание' },
  { field: 'linkTz', label: 'Ссылка на ТЗ' },
  { field: 'linkChtz', label: 'Ссылка на ЧТЗ' },
  { field: 'release', label: 'Релиз' },
  { field: 'notes', label: 'Примечание' },
  { field: 'dependencies', label: 'Зависимости' },
];

export interface ParsedFile {
  fileName: string;
  headers: string[];
  rows: string[][];
}

/** Разбор Excel/CSV: первая строка = заголовки */
export async function parseImportFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('В файле нет ни одного листа');
  const grid = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: '' });
  if (grid.length < 2) throw new Error('Нужны минимум две строки: заголовки и данные');
  const headers = grid[0].map((h) => String(h ?? '').trim());
  const rows = grid.slice(1)
    .map((r) => r.map((c) => String(c ?? '').trim()))
    .filter((r) => r.some((c) => c !== ''));
  if (rows.length === 0) throw new Error('Строк с данными не найдено');
  return { fileName: file.name, headers, rows };
}

/** Автоподбор колонки под поле по названию заголовка */
export function guessMapping(headers: string[]): Partial<Record<ImportField, number>> {
  const patterns: Record<ImportField, RegExp> = {
    title: /назван|title|заголов|требован/i,
    reqType: /тип|type/i,
    description: /описан|description/i,
    linkTz: /тз/i,
    linkChtz: /чтз/i,
    release: /релиз|release|версия/i,
    notes: /примечан|notes/i,
    dependencies: /зависим|depend/i,
  };
  const out: Partial<Record<ImportField, number>> = {};
  for (const f of Object.keys(patterns) as ImportField[]) {
    const idx = headers.findIndex((h) => patterns[f].test(h));
    if (idx >= 0) out[f] = idx;
  }
  return out;
}

/** Превращение строк + маппинга в черновики требований */
export function rowsToDrafts(parsed: ParsedFile, mapping: Partial<Record<ImportField, number>>): RequirementDraft[] {
  const get = (row: string[], field: ImportField) => {
    const idx = mapping[field];
    return idx === undefined || idx < 0 ? '' : (row[idx] ?? '');
  };
  return parsed.rows.map((row) => ({
    title: get(row, 'title'),
    reqType: normalizeReqType(get(row, 'reqType')) as ReqType,
    description: get(row, 'description'),
    linkTz: get(row, 'linkTz'),
    linkChtz: get(row, 'linkChtz'),
    release: get(row, 'release') || '1.0',
    notes: get(row, 'notes'),
    dependencies: get(row, 'dependencies'),
  })).filter((d) => d.title.trim() !== '');
}

/** Экспорт текущей матрицы в Excel */
export function exportMatrix(rows: Requirement[]): void {
  const data = rows.map((r) => ({
    'ID': r.reqKey,
    'Тип': REQ_TYPE_LABEL[r.reqType],
    'Название': r.title,
    'Описание': r.description,
    'Ссылка на ТЗ': r.linkTz || '—',
    'Ссылка на ЧТЗ': r.linkChtz || '—',
    'Релиз': r.release || '—',
    'Примечание': r.notes || '—',
    'Зависимости': r.dependencies || '—',
    'Статус ФС': VALIDITY_META[fsStatus(r)].label,
    'Статус тестов': VALIDITY_META[testsStatus(r)].label,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Матрица');
  XLSX.writeFile(wb, 'requirements_matrix.xlsx');
}
