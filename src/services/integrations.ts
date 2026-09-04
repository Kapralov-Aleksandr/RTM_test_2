// ============================================================
// Интеграции: Jira Server и Confluence Server.
//
// Демо-режим эмулирует ответы серверов (браузер не может напрямую
// обращаться к хостам с самоподписанным SSL — в целевой архитектуре
// этот модуль заменяется на вызовы FastAPI-прокси:
//   GET  /api/integrations/jira/issue/{key}
//   GET  /api/integrations/confluence/page/{id}
// которые на бэкенде выполняют requests.get(..., verify=False)).
// ============================================================

import type { JiraIssue } from '../domain/types';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Демо-реестр задач Jira (после «синхронизации» статусы могут отличаться от кэша) */
const DEMO_JIRA: Record<string, { summary: string; status: string }> = {
  'ASU-301': { summary: 'Личный кабинет абитуриента: регистрация', status: 'Готово' },
  'ASU-302': { summary: 'Личный кабинет: профиль и документы', status: 'Готово' },
  'ASU-303': { summary: 'Личный кабинет: восстановление пароля', status: 'В работе' },
  'ASU-304': { summary: 'Личный кабинет: согласия на обработку ПДн', status: 'К выполнению' },
  'ASU-305': { summary: 'Подача заявления: мастер заполнения', status: 'Готово' },
  'ASU-306': { summary: 'Подача заявления: загрузка сканов', status: 'В работе' },
  'ASU-308': { summary: 'Рейтинговые списки: ранжирование', status: 'В работе' },
  'ASU-311': { summary: 'Уведомления: e-mail абитуриентам', status: 'В работе' },
  'ASU-345': { summary: 'Интеграция с ЕПГУ (Госуслуги)', status: 'В работе' },
};

/** «Синхронизация с Jira»: возвращает актуальные статусы задач */
export async function syncJiraIssues(keys: string[]): Promise<JiraIssue[]> {
  await delay(900 + Math.random() * 500);
  return keys
    .filter((k) => DEMO_JIRA[k])
    .map((k) => ({ key: k, summary: DEMO_JIRA[k].summary, status: DEMO_JIRA[k].status }));
}

/** «Проверка страницы Confluence»: существует ли страница и номер версии */
export async function checkConfluencePage(code: string): Promise<{ exists: boolean; version: number }> {
  await delay(500 + Math.random() * 400);
  const versions: Record<string, number> = {
    'FS-001': 2, 'FS-002': 2, 'FS-003': 1, 'FS-004': 2,
  };
  const v = versions[code.toUpperCase()];
  return v ? { exists: true, version: v } : { exists: false, version: 0 };
}
