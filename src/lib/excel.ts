// ============================================================
// Экспорт Excel (xlsx / SheetJS).
// В будущей серверной архитектуре эти отчёты сможет генерировать
// FastAPI (openpyxl); интерфейс функций останется тем же.
// ============================================================

import * as XLSX from 'xlsx';
import { REQ_STATUS_META, PRIORITY_META } from '../domain/lifecycle';
import type { AppState, NewRequirement, Requirement, TestCase } from '../domain/types';

interface SheetPayload { name: string; data: Record<string, string | number>[]; }

function writeBook(sheets: SheetPayload[], filename: string): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.data);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

/** Экспорт матрицы трассировки */
export function exportMatrix(rows: Requirement[], tMap: Map<string, TestCase[]>): void {
  const data = rows.map((r) => ({
    'ID': r.code,
    'Требование': r.title,
    'ТЗ пункт': r.tzClause,
    'ЧТЗ раздел': r.chtzSection || '— (пробел)',
    'Фиче-страница': r.featureId || '—',
    'Тест-кейсы': (tMap.get(r.id) ?? []).map((t) => t.code).join(', ') || '— (нет)',
    'Jira задача': r.jiraKey || '— (нет)',
    'Приоритет': PRIORITY_META[r.priority].label,
    'Статус': REQ_STATUS_META[r.status].label,
    'Источник': r.source === 'new' ? 'Новое (после baseline)' : 'Baseline',
  }));
  writeBook([{ name: 'Матрица трассировки', data }], 'traceability_matrix.xlsx');
}

/** Экспорт отчёта о покрытии (несколько листов) */
export function exportCoverageReport(state: AppState, cov: {
  total: number; tzClauses: number; withChtz: number; withTests: number;
  withJira: number; done: number; gaps: Requirement[]; orphans: TestCase[];
}): void {
  const pct = (n: number) => (cov.total ? `${Math.round((n / cov.total) * 100)}%` : '0%');
  writeBook([
    {
      name: 'Сводка',
      data: [
        { 'Показатель': 'Пунктов ТЗ', 'Значение': cov.tzClauses },
        { 'Показатель': 'Атомарных требований', 'Значение': cov.total },
        { 'Показатель': 'Отражено в ЧТЗ', 'Значение': `${cov.withChtz} (${pct(cov.withChtz)})` },
        { 'Показатель': 'Покрыто тестами', 'Значение': `${cov.withTests} (${pct(cov.withTests)})` },
        { 'Показатель': 'Заведено в Jira', 'Значение': `${cov.withJira} (${pct(cov.withJira)})` },
        { 'Показатель': 'Реализовано', 'Значение': `${cov.done} (${pct(cov.done)})` },
        { 'Показатель': 'Пробелов (нет ЧТЗ)', 'Значение': cov.gaps.length },
        { 'Показатель': 'Сирот (тесты без требований)', 'Значение': cov.orphans.length },
      ],
    },
    {
      name: 'Пробелы',
      data: cov.gaps.map((r) => ({ 'ID': r.code, 'Требование': r.title, 'ТЗ пункт': r.tzClause })),
    },
    {
      name: 'Сироты',
      data: cov.orphans.map((t) => ({ 'Тест-кейс': t.code, 'Название': t.title, 'Привязка': t.requirementId || '(пусто)' })),
    },
  ], 'coverage_report.xlsx');
}

/** Экспорт журнала новых требований */
export function exportNewRequirements(rows: NewRequirement[], state: AppState): void {
  const fname = (id: string) => state.features.find((f) => f.id === id)?.code ?? '—';
  const data = rows.map((r) => ({
    'Код': r.code,
    'Описание': r.description,
    'Источник': r.source,
    'Дата': r.date,
    'Бюджет (ч)': r.budgetHours,
    'Сроки (дн)': r.termDays,
    'Фиче-страница': fname(r.featureId),
    'Jira': r.jiraKey || '—',
    'Статус': r.status,
    'Требование': r.requirementId || '—',
  }));
  writeBook([{ name: 'Новые требования', data }], 'new_requirements.xlsx');
}
