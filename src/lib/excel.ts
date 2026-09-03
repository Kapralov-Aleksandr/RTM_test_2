// ============================================================
// Импорт и экспорт Excel (xlsx / SheetJS)
// ============================================================

import * as XLSX from 'xlsx';
import { DEMO_MATRIX, REQ_STATUS_LABEL } from '../data/demo';
import type { ChangeJournalEntry, NewRequirement, Requirement } from '../types';

/** Русские заголовки колонок → поля Requirement */
const HEADER_MAP: Record<string, keyof Requirement> = {
  'ID': 'id',
  'Требование': 'text',
  'ТЗ пункт': 'tz',
  'ЧТЗ раздел': 'chtz',
  'Фиче-страница': 'page',
  'Тест-кейс': 'testCase',
  'Jira задача': 'jiraKey',
  'Статус': 'status',
};

const STATUS_IN: Record<string, Requirement['status']> = {
  'реализовано': 'done',
  'в работе': 'progress',
  'не начато': 'todo',
};

function statusOut(s: Requirement['status']): string {
  return REQ_STATUS_LABEL[s] ?? s;
}

function norm(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** Разбор загруженного Excel-файла матрицы трассировки */
export async function parseMatrixFile(file: File): Promise<Requirement[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('В файле нет ни одного листа');
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  if (raw.length === 0) throw new Error('Лист Excel пуст');

  const rows: Requirement[] = [];
  for (const r of raw) {
    const req: Requirement = {
      id: '', text: '', tz: '', chtz: '', page: '', testCase: '', jiraKey: '', status: 'todo',
    };
    for (const [key, value] of Object.entries(r)) {
      const field = HEADER_MAP[key.trim()];
      if (!field) continue;
      if (field === 'status') {
        req.status = STATUS_IN[norm(value).toLowerCase()] ?? 'todo';
      } else {
        req[field] = norm(value).replace(/^—$|^-$/, '');
      }
    }
    if (req.id) rows.push(req);
  }
  if (rows.length === 0) {
    throw new Error('Не найдено ни одной строки с заполненным ID. Проверьте заголовки колонок.');
  }
  return rows;
}

/** Экспорт матрицы трассировки */
export function exportMatrix(rows: Requirement[], name = 'traceability_matrix.xlsx'): void {
  const data = rows.map((r) => ({
    'ID': r.id,
    'Требование': r.text,
    'ТЗ пункт': r.tz,
    'ЧТЗ раздел': r.chtz || '—',
    'Фиче-страница': r.page,
    'Тест-кейс': r.testCase || '—',
    'Jira задача': r.jiraKey || '—',
    'Статус': statusOut(r.status),
  }));
  writeBook([{ name: 'Матрица', data }], name);
}

/** Скачивание шаблона матрицы с описанием колонок */
export function downloadTemplate(): void {
  const sample = DEMO_MATRIX.slice(0, 3).map((r) => ({
    'ID': r.id,
    'Требование': r.text,
    'ТЗ пункт': r.tz,
    'ЧТЗ раздел': r.chtz,
    'Фиче-страница': r.page,
    'Тест-кейс': r.testCase || '',
    'Jira задача': r.jiraKey || '',
    'Статус': statusOut(r.status),
  }));
  const legend = [
    { 'Колонка': 'ID', 'Описание': 'Уникальный идентификатор атомарного требования (REQ-001)' },
    { 'Колонка': 'Требование', 'Описание': 'Формулировка атомарного требования из ТЗ' },
    { 'Колонка': 'ТЗ пункт', 'Описание': 'Пункт исходного ТЗ заказчика' },
    { 'Колонка': 'ЧТЗ раздел', 'Описание': 'Раздел ЧТЗ в Confluence. Пусто = требование не отражено в ЧТЗ (пробел)' },
    { 'Колонка': 'Фиче-страница', 'Описание': 'ID фиче-страницы Confluence (FS-001 или числовой ID)' },
    { 'Колонка': 'Тест-кейс', 'Описание': 'Код тест-кейса ПМИ. Пусто = нет тестового покрытия' },
    { 'Колонка': 'Jira задача', 'Описание': 'Ключ задачи Jira (ASU-301). Пусто = задача не заведена' },
    { 'Колонка': 'Статус', 'Описание': 'Реализовано / В работе / Не начато' },
  ];
  writeBook([
    { name: 'Матрица', data: sample },
    { name: 'Описание колонок', data: legend },
  ], 'traceability_matrix_template.xlsx');
}

interface SheetPayload { name: string; data: Record<string, string | number>[]; }

function writeBook(sheets: SheetPayload[], filename: string): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.data);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

/** Экспорт отчёта о покрытии (несколько листов) */
export function exportCoverageReport(payload: {
  summary: Array<{ 'Показатель': string; 'Значение': string }>;
  matrix: Array<Record<string, string | number>>;
  byPage: Array<Record<string, string | number>>;
  gaps: Array<Record<string, string>>;
  orphans: Array<Record<string, string>>;
}): void {
  writeBook([
    { name: 'Сводка', data: payload.summary },
    { name: 'Матрица', data: payload.matrix },
    { name: 'По фиче-страницам', data: payload.byPage },
    { name: 'Пробелы', data: payload.gaps },
    { name: 'Сироты', data: payload.orphans },
  ], 'coverage_report.xlsx');
}

/** Экспорт журнала новых требований */
export function exportNewRequirements(rows: NewRequirement[]): void {
  const data = rows.map((r) => ({
    'ID': r.rid,
    'Описание': r.description,
    'Источник': r.source,
    'Дата': r.date,
    'Бюджет (ч)': r.budgetHours,
    'Сроки (дн)': r.termDays,
    'Фиче-страница': r.page || '—',
    'Jira': r.jiraKey || '—',
    'Статус': r.status,
  }));
  writeBook([{ name: 'Новые требования', data }], 'new_requirements.xlsx');
}

/** Экспорт журнала изменений фиче-страниц */
export function exportChangeJournal(entries: ChangeJournalEntry[]): void {
  const data = entries.map((e) => ({
    'Дата': new Date(e.ts).toLocaleString('ru-RU'),
    'Страница': e.pageId,
    'Название': e.title,
    'Версии': `v${e.fromVersion} → v${e.toVersion}`,
    'Добавлено строк': e.adds,
    'Удалено строк': e.dels,
    'Затронутые требования': e.affectedReqs.join(', '),
    'Действия': e.actions.join('; '),
  }));
  writeBook([{ name: 'Журнал изменений', data }], 'change_journal.xlsx');
}
