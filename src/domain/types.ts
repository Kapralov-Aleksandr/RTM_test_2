// ============================================================
// Доменная модель RMS (Requirements Management System)
// Сущности жизненного цикла: ТЗ → Требования → ЧТЗ →
// Фиче-страницы → Тест-кейсы (ПМИ) → Задачи Jira
// ============================================================

/** Статус атомарного требования в жизненном цикле */
export type ReqStatus = 'draft' | 'approved' | 'in_dev' | 'in_test' | 'done';

/** Приоритет (MoSCoW) */
export type Priority = 'must' | 'should' | 'could';

/** Происхождение требования */
export type ReqSource = 'baseline' | 'new';

/** Атомарное требование */
export interface Requirement {
  id: string;
  code: string;            // REQ-001
  title: string;
  descriptionMd: string;   // Markdown: критерии приёмки, детали
  tzClause: string;        // пункт ТЗ («3.1.2»), «—» для новых
  chtzSection: string;     // раздел ЧТЗ; '' = пробел (не отражено)
  featureId: string;       // фиче-страница; '' = не привязано
  jiraKey: string;         // задача Jira; '' = не заведена
  priority: Priority;
  status: ReqStatus;
  source: ReqSource;
  newReqId?: string;       // связь с записью журнала новых требований
  updatedAt: string;       // ISO
}

/** Версия фиче-страницы (для контроля изменений и diff) */
export interface FeatureVersion {
  id: string;
  ts: string;
  authorId: string;
  note: string;
  md: string;
}

/** Фиче-страница (одна фича = несколько требований) */
export interface FeaturePage {
  id: string;
  code: string;            // FS-001
  confluenceId: string;    // числовой ID в Confluence
  title: string;
  bodyMd: string;
  ownerId: string;         // аналитик
  versions: FeatureVersion[];
}

export type TestStatus = 'draft' | 'ready' | 'passed' | 'failed';

/** Тест-кейс из документа ПМИ */
export interface TestCase {
  id: string;
  code: string;            // TC-101
  title: string;
  requirementId: string;   // '' или несуществующий = «сирота»
  suite: string;           // раздел ПМИ
  status: TestStatus;
}

/** Кэш задач Jira (обновляется синхронизацией) */
export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
}

export type NewReqStatus = 'approved' | 'in_work' | 'rejected' | 'implemented';

/** Новое требование, появившееся после baseline */
export interface NewRequirement {
  id: string;
  code: string;            // NR-01
  description: string;
  source: string;
  date: string;
  budgetHours: number;
  termDays: number;
  featureId: string;
  jiraKey: string;
  status: NewReqStatus;
  requirementId: string;   // заполняется при превращении в атомарное REQ
}

export type Role = 'pm' | 'analyst' | 'qa' | 'dev';

export interface Member {
  id: string;
  name: string;
  role: Role;
}

/** Уведомление команды об изменении фиче-страницы (синхронизация аналитик/QA/разработка) */
export interface ChangeNotice {
  id: string;
  ts: string;
  featureId: string;
  versionId: string;
  message: string;
  audience: Role[];
  done: boolean;
}

/** Исходное ТЗ заказчика */
export interface TzDocument {
  code: string;
  title: string;
  client: string;
  receivedAt: string;
}

/** Глава ТЗ (для дерева требований) */
export interface TzChapter {
  code: string;            // «3.1»
  title: string;
}

export interface Settings {
  jiraUrl: string;
  confUrl: string;
  login: string;
  password: string;
  projectKey: string;
  demoMode: boolean;
  lastJiraSync: string;    // ISO, '' = не было
}

/** Корневое состояние приложения (будущая «база данных») */
export interface AppState {
  version: number;
  tzDoc: TzDocument;
  tzChapters: TzChapter[];
  requirements: Requirement[];
  features: FeaturePage[];
  testCases: TestCase[];
  jiraIssues: JiraIssue[];
  newReqs: NewRequirement[];
  members: Member[];
  notices: ChangeNotice[];
  settings: Settings;
}
