// ============================================================
// Бизнес-логика (зеркало backend/services/):
// генерация ключей требований, статусы актуальности, словари.
// Чистые функции — удобно тестировать и держать в синхроне с бэком.
// ============================================================

import type { ReqType, Requirement, Validity } from './types';

/** Аббревиатуры типов для автогенерации ключа */
export const TYPE_ABBR: Record<ReqType, string> = {
  BUSINESS: 'BUS',
  FUNCTIONAL: 'FUNC',
  NON_FUNCTIONAL: 'NFUNC',
};

export const REQ_TYPE_LABEL: Record<ReqType, string> = {
  BUSINESS: 'Бизнес',
  FUNCTIONAL: 'Функциональное',
  NON_FUNCTIONAL: 'Нефункциональное',
};

export const REQ_TYPE_TONE: Record<ReqType, 'sky' | 'teal' | 'amber'> = {
  BUSINESS: 'sky',
  FUNCTIONAL: 'teal',
  NON_FUNCTIONAL: 'amber',
};

/**
 * Автогенерация ключа: REQ-{JIRA_KEY}-{TYPE_ABBR}-{NNNN}
 * NNNN — следующий номер внутри проекта и типа (4 цифры, с нуля).
 * Пример: REQ-LC-FUNC-0015
 */
export function nextReqKey(reqs: Requirement[], jiraKey: string, type: ReqType): string {
  const prefix = `REQ-${jiraKey.toUpperCase()}-${TYPE_ABBR[type]}-`;
  const maxN = reqs
    .filter((r) => r.reqKey.startsWith(prefix))
    .reduce((acc, r) => Math.max(acc, Number(r.reqKey.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(maxN + 1).padStart(4, '0')}`;
}

/**
 * Статус актуальности по фиче-страницам:
 * 🟢 Актуально — last_validated_fs ≥ updated_at
 * ⚠ Требует проверки — updated_at > last_validated_fs
 * 🔴 Не создано — ссылки на ФС нет (ни разу не валидировалось)
 */
export function fsStatus(r: Requirement): Validity {
  if (!r.lastValidatedFs) return 'none';
  return new Date(r.updatedAt) > new Date(r.lastValidatedFs) ? 'stale' : 'ok';
}

/** Статус актуальности по тест-кейсам (та же логика через last_validated_test) */
export function testsStatus(r: Requirement): Validity {
  if (!r.lastValidatedTest) return 'none';
  return new Date(r.updatedAt) > new Date(r.lastValidatedTest) ? 'stale' : 'ok';
}

export const VALIDITY_META: Record<Validity, { label: string; tone: 'grass' | 'amber' | 'coral'; hint: string }> = {
  ok: { label: 'Актуально', tone: 'grass', hint: 'last_validated ≥ updated_at' },
  stale: { label: 'Требует проверки', tone: 'amber', hint: 'Требование изменилось, актуальность не подтверждена' },
  none: { label: 'Не создано', tone: 'coral', hint: 'Нет ссылки на ФС / тест-кейсы' },
};

/** Русские названия полей для журнала истории изменений */
export const FIELD_LABEL: Record<string, string> = {
  reqType: 'Тип',
  title: 'Название',
  description: 'Описание',
  linkTz: 'Ссылка на ТЗ',
  linkChtz: 'Ссылка на ЧТЗ',
  release: 'Релиз',
  notes: 'Примечание',
  dependencies: 'Зависимости',
};

/** Сравнение двух дат для сортировки */
export function dateKey(iso: string): number {
  return new Date(iso).getTime();
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/** Нормализация типа требования при импорте (рус/англ варианты) */
export function normalizeReqType(v: string): ReqType {
  const s = v.trim().toUpperCase();
  if (['BUS', 'BUSINESS', 'БИЗНЕС', 'БИЗНЕС-ТРЕБОВАНИЕ'].includes(s)) return 'BUSINESS';
  if (['NFUNC', 'NON_FUNCTIONAL', 'NON-FUNCTIONAL', 'НЕФУНКЦИОНАЛЬНОЕ'].includes(s)) return 'NON_FUNCTIONAL';
  if (['FUNC', 'FUNCTIONAL', 'ФУНКЦИОНАЛЬНОЕ'].includes(s)) return 'FUNCTIONAL';
  return 'FUNCTIONAL';
}
