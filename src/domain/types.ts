// ============================================================
// Доменная модель RMS — зеркало SQLite-схемы (см. backend/database.py)
// ============================================================

/** Тип атомарного требования */
export type ReqType = 'BUSINESS' | 'FUNCTIONAL' | 'NON_FUNCTIONAL';

/** Статус актуальности (вычисляемый, не хранится) */
export type Validity = 'ok' | 'stale' | 'none';

/** projects */
export interface Project {
  id: string;
  jiraKey: string;   // "LC", "PROJ"
  name: string;
  createdAt: string; // ISO
}

/** requirements (Таб 2 — Матрица) */
export interface Requirement {
  id: string;
  projectId: string;
  reqKey: string;           // автогенерация: REQ-{KEY}-{TYPE}-{NNNN}
  reqType: ReqType;
  title: string;
  description: string;
  linkTz: string;           // ссылка на раздел ТЗ
  linkChtz: string;         // ссылка на ЧТЗ
  release: string;
  notes: string;
  dependencies: string;     // ключи зависимых требований
  createdAt: string;
  updatedAt: string;
  lastValidatedFs: string | null;    // валидация фиче-страницами
  lastValidatedTest: string | null;  // валидация тест-кейсами
}

/** requirement_history */
export interface RequirementHistoryEntry {
  id: string;
  requirementId: string;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
}

/** Настройки интеграций (боковая панель) */
export interface AppSettings {
  jiraUrl: string;
  confUrl: string;
  login: string;
  password: string;
  demoMode: boolean; // эмуляция интеграций, пока нет backend-прокси
}

/** Корень состояния (демо-режим; в продакшене — SQLite через FastAPI) */
export interface AppState {
  version: number;
  activeProjectId: string;
  projects: Project[];
  requirements: Requirement[];
  history: RequirementHistoryEntry[];
  settings: AppSettings;
}

/** Форма создания/редактирования требования */
export interface RequirementDraft {
  reqType: ReqType;
  title: string;
  description: string;
  linkTz: string;
  linkChtz: string;
  release: string;
  notes: string;
  dependencies: string;
}
