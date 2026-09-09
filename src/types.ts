// ============================================================
// Типы данных Requirements Tracker
// ============================================================

/** Статус атомарного требования в матрице трассировки */
export type ReqStatus = 'done' | 'progress' | 'todo';

/** Строка матрицы трассировки (соответствует колонкам Excel) */
export interface Requirement {
  id: string;        // REQ-001
  text: string;      // Формулировка требования
  tz: string;        // Пункт ТЗ
  chtz: string;      // Раздел ЧТЗ (пусто = «пробел»)
  page: string;      // Фиче-страница, например FS-001
  testCase: string;  // Тест-кейс ПМИ (пусто = нет покрытия тестами)
  jiraKey: string;   // Задача Jira (пусто = нет задачи)
  status: ReqStatus; // Статус реализации
}

/** Настройки подключения (боковая панель) */
export interface AppConfig {
  jiraUrl: string;
  confUrl: string;
  login: string;
  password: string;
  projectKey: string;
  demoMode: boolean; // эмуляция ответов Jira/Confluence
}

/** Снапшот фиче-страницы Confluence (аналог data/snapshots/) */
export interface PageSnapshot {
  pageId: string;
  title: string;
  version: number;
  date: string; // ISO
  content: string;
}

/** Запись журнала изменений (вкладка «Контроль изменений») */
export interface ChangeJournalEntry {
  id: string;
  ts: string;
  pageId: string;
  title: string;
  fromVersion: number;
  toVersion: number;
  adds: number;
  dels: number;
  actions: string[];
  affectedReqs: string[];
}

export type NewReqStatus = 'approved' | 'work' | 'rejected' | 'implemented';

/** Новое требование, появившееся после baseline */
export interface NewRequirement {
  rid: string;          // REQ-N01
  description: string;
  source: string;       // письмо заказчика / совещание / ...
  date: string;         // ISO-дата
  budgetHours: number;  // влияние на бюджет, часы
  termDays: number;     // влияние на сроки, дни
  page: string;         // связанная фиче-страница
  jiraKey: string;      // связанная задача Jira
  status: NewReqStatus;
}

/** Тест-кейс из документа ПМИ (для поиска «сирот») */
export interface PmiTest {
  code: string;  // TC-101
  title: string;
  req: string;   // привязка к требованию (пусто = сирота)
}

export type ConnStatus = 'idle' | 'checking' | 'ok' | 'demo' | 'error' | 'nocreds';

export interface ConnState {
  jira: ConnStatus;
  conf: ConnStatus;
}
