// ============================================================
// Правила жизненного цикла требований и расчёты покрытия
// ============================================================

import type { AppState, NewReqStatus, Priority, ReqStatus, Requirement, TestCase, TestStatus } from './types';

/** Метаданные статусов требования (подписи + тональность бейджа) */
export const REQ_STATUS_META: Record<ReqStatus, { label: string; tone: string; dot: string }> = {
  draft:    { label: 'Черновик',     tone: 'dim',   dot: 'bg-faint' },
  approved: { label: 'Согласовано',  tone: 'sky',   dot: 'bg-sky' },
  in_dev:   { label: 'В разработке', tone: 'amber', dot: 'bg-amber' },
  in_test:  { label: 'Тестирование', tone: 'teal',  dot: 'bg-teal' },
  done:     { label: 'Реализовано',  tone: 'grass', dot: 'bg-grass' },
};

export const PRIORITY_META: Record<Priority, { label: string; tone: string }> = {
  must:   { label: 'Must',   tone: 'coral' },
  should: { label: 'Should', tone: 'amber' },
  could:  { label: 'Could',  tone: 'sky' },
};

export const TEST_STATUS_META: Record<TestStatus, { label: string; tone: string }> = {
  draft:  { label: 'Черновик',  tone: 'dim' },
  ready:  { label: 'Готов',     tone: 'sky' },
  passed: { label: 'Пройден',   tone: 'grass' },
  failed: { label: 'Провален',  tone: 'coral' },
};

export const NEWREQ_STATUS_META: Record<NewReqStatus, { label: string; tone: string }> = {
  approved:    { label: 'Согласовано',  tone: 'sky' },
  in_work:     { label: 'В работе',     tone: 'amber' },
  rejected:    { label: 'Отклонено',    tone: 'coral' },
  implemented: { label: 'Реализовано',  tone: 'grass' },
};

export const NEWREQ_SOURCES = [
  'Письмо заказчика',
  'Совещание',
  'Уточнение к ТЗ',
  'Запрос на изменение',
  'Другое',
];

export const ROLE_LABEL: Record<string, string> = {
  pm: 'Руководитель',
  analyst: 'Аналитик',
  qa: 'QA-инженер',
  dev: 'Разработчик',
};

// ---------- Производные структуры ----------

/** Карта «требование → его тест-кейсы» */
export function testsByRequirement(state: AppState): Map<string, TestCase[]> {
  const map = new Map<string, TestCase[]>();
  for (const tc of state.testCases) {
    if (!tc.requirementId) continue;
    const list = map.get(tc.requirementId);
    if (list) list.push(tc);
    else map.set(tc.requirementId, [tc]);
  }
  return map;
}

export interface Coverage {
  total: number;
  tzClauses: number;
  withChtz: number;
  withFeature: number;
  withTests: number;
  withJira: number;
  done: number;
  /** «Пробелы»: требования без раздела ЧТЗ */
  gaps: Requirement[];
  /** «Сироты»: тест-кейсы без (валидной) привязки к требованию */
  orphans: TestCase[];
}

/** Сквозной расчёт покрытия по всему жизненному циклу */
export function computeCoverage(state: AppState): Coverage {
  const { requirements, testCases } = state;
  const ids = new Set(requirements.map((r) => r.id));
  const tMap = testsByRequirement(state);

  const gaps = requirements.filter((r) => r.source === 'baseline' && !r.chtzSection);
  const orphans = testCases.filter((t) => !t.requirementId || !ids.has(t.requirementId));

  return {
    total: requirements.length,
    tzClauses: new Set(requirements.filter((r) => r.source === 'baseline').map((r) => r.tzClause)).size,
    withChtz: requirements.filter((r) => r.chtzSection).length,
    withFeature: requirements.filter((r) => r.featureId).length,
    withTests: requirements.filter((r) => (tMap.get(r.id) ?? []).length > 0).length,
    withJira: requirements.filter((r) => r.jiraKey).length,
    done: requirements.filter((r) => r.status === 'done').length,
    gaps,
    orphans,
  };
}

/** Проблемы конкретной строки матрицы (для подсветки) */
export function rowProblems(r: Requirement, tMap: Map<string, TestCase[]>) {
  const noTests = (tMap.get(r.id) ?? []).length === 0;
  const noJira = !r.jiraKey;
  const gap = r.source === 'baseline' && !r.chtzSection;
  return { noTests, noJira, gap };
}

/** Этапы воронки жизненного цикла */
export function funnelStages(state: AppState, cov: Coverage) {
  return [
    { label: 'Пункты ТЗ', value: cov.tzClauses, cls: 'bg-sky' },
    { label: 'Атомарные требования', value: cov.total, cls: 'bg-teal' },
    { label: 'Отражено в ЧТЗ', value: cov.withChtz, cls: 'bg-sky' },
    { label: 'Покрыто тестами', value: cov.withTests, cls: 'bg-teal' },
    { label: 'Задачи в Jira', value: cov.withJira, cls: 'bg-amber' },
    { label: 'Реализовано', value: cov.done, cls: 'bg-grass' },
  ];
}

/** Покрытие в разрезе фиче-страниц */
export function coverageByPage(state: AppState) {
  const tMap = testsByRequirement(state);
  return state.features
    .map((f) => {
      const rows = state.requirements.filter((r) => r.featureId === f.id);
      return {
        id: f.id,
        code: f.code,
        title: f.title,
        total: rows.length,
        done: rows.filter((r) => r.status === 'done').length,
        inwork: rows.filter((r) => r.status === 'in_dev' || r.status === 'in_test').length,
        noJira: rows.filter((r) => !r.jiraKey).length,
        noTests: rows.filter((r) => (tMap.get(r.id) ?? []).length === 0).length,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Следующий свободный код требования: REQ-0NN */
export function nextReqCode(state: AppState): string {
  const max = state.requirements.reduce((m, r) => {
    const n = parseInt(r.code.replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `REQ-${String(max + 1).padStart(3, '0')}`;
}

/** Следующий свободный код записи журнала: NR-NN */
export function nextNewReqCode(state: AppState): string {
  const max = state.newReqs.reduce((m, r) => {
    const n = parseInt(r.code.replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `NR-${String(max + 1).padStart(2, '0')}`;
}

export function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
