// ============================================================
// Доменные типы RMS — зеркало схемы SQLite (backend/database.py).
// ============================================================

/** Проекты (мультипроектность) */
export interface Project {
  id: string;
  jiraKey: string;   // "LC"
  name: string;
  createdAt: string;
}

export type ReqType = 'BUSINESS' | 'FUNCTIONAL' | 'NON_FUNCTIONAL';

/** Статус актуальности: вычисляется из updated_at / last_validated */
export type Validity = 'ok' | 'stale' | 'none';

/** Атомарные требования (таблица requirements) */
export interface Requirement {
  id: string;
  projectId: string;
  reqKey: string;        // автогенерация: REQ-{KEY}-{TYPE}-{NNNN}
  reqType: ReqType;
  title: string;
  description: string;
  linkTz: string;
  linkChtz: string;
  release: string;
  notes: string;
  dependencies: string;
  createdAt: string;
  updatedAt: string;
  lastValidatedFs: string | null;
  lastValidatedTest: string | null;
}

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

export interface RequirementHistoryEntry {
  id: string;
  requirementId: string;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
}

/** Настройки интеграций (боковая панель → data/config.json) */
export interface AppSettings {
  jiraUrl: string;
  confUrl: string;
  login: string;
  password: string;
  demoMode: boolean; // предпочитать демо-хранилище (localStorage)
}

// ---------- Итерация 2: документы и связи ----------

/** Связь «выделенный текст в ТЗ → требование» (tz_requirement_mentions) */
export interface TzMention {
  reqId: string;
  reqKey: string;
  start: number;   // offset в тексте документа
  end: number;
  text: string;    // подсвеченный фрагмент
}

/** Исходное ТЗ (tz_documents) */
export interface TzDocument {
  id: string;
  projectId: string;
  title: string;
  content: string; // HTML из редактора
  attachment: { name: string; url: string } | null;
  mentions: TzMention[];
  updatedAt: string;
}

/** ЧТЗ (chtz_documents) */
export interface ChtzDocument {
  id: string;
  projectId: string;
  title: string;
  content: string; // HTML с бейджами @-упоминаний
  updatedAt: string;
}

/** Узел дерева фиче-страниц (feature_tree) */
export interface FeatureTreeNode {
  id: string;
  projectId: string;
  parentId: string | null;
  nodeType: 'RELEASE' | 'FEATURE';
  name: string;
  jiraKey?: string;
  orderNum: number;
}

/** Макет фичи (mockups) */
export interface Mockup {
  id: string;
  name: string;
  url: string; // /files/mockups/... (backend) или dataURL (демо)
}

/** Фиче-страница (features + feature_requirements) */
export interface Feature {
  id: string;
  treeNodeId: string;
  title: string;
  content: string;
  linkJira: string;
  linkTestCases: string;
  requirementIds: string[];
  mockups: Mockup[];
  updatedAt: string;
  lastValidated: string | null;
}

/** Корневое состояние приложения */
export interface AppState {
  version: number;
  activeProjectId: string;
  projects: Project[];
  requirements: Requirement[];
  history: RequirementHistoryEntry[];
  tzDoc: TzDocument | null;
  chtzDoc: ChtzDocument | null;
  tree: FeatureTreeNode[];
  features: Feature[];
  settings: AppSettings;
  // Хранилище документов per-project для демо-режима
  tzDocs?: Record<string, TzDocument>;
  chtzDocs?: Record<string, ChtzDocument>;
}
