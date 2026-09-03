// ============================================================
// Слой доступа к Jira / Confluence.
//
// В демо-режиме ответы эмулируются с реалистичными задержками
// (браузер не может напрямую обращаться к серверам с самоподписанным
// SSL — в продакшене этот модуль заменяется на реальные запросы
// requests.get(..., verify=False) через локальный прокси).
//
// Реальные эндпоинты (для справки):
//   GET {jira}/rest/api/2/issue/{key}
//   GET {confluence}/rest/api/content/{id}?expand=body.storage,version
// ============================================================

import { JIRA_ISSUES, PAGES } from '../data/demo';
import type { ConnStatus } from '../types';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Итог проверки страницы Confluence */
export interface PageCheckResult { exists: boolean; title?: string; confluenceId?: string; }

/** Проверка существования фиче-страницы */
export async function apiCheckPage(pageKey: string): Promise<PageCheckResult> {
  await delay(200 + Math.random() * 250);
  const page = PAGES.find((p) => p.id === pageKey || p.confluenceId === pageKey);
  if (!page) return { exists: false };
  return { exists: true, title: page.title, confluenceId: page.confluenceId };
}

/** Итог проверки задачи Jira */
export interface JiraCheckResult {
  exists: boolean;
  status?: string;
  assignee?: string;
}

/** Проверка существования задачи Jira и её статуса */
export async function apiCheckJira(key: string): Promise<JiraCheckResult> {
  await delay(200 + Math.random() * 250);
  const issue = JIRA_ISSUES[key];
  if (!issue) return { exists: false };
  return { exists: true, status: issue.status, assignee: issue.assignee };
}

/** Результат загрузки страницы Confluence */
export interface FetchedPage {
  pageId: string;
  confluenceId: string;
  title: string;
  version: number;      // версия полученного содержимого
  maxVersion: number;   // сколько всего версий «на сервере»
  content: string;
}

/**
 * Загрузка содержимого фиче-страницы.
 * index — сколько версий уже «скачано» ранее (индекс в истории).
 * Демо-режим: каждый вызов возвращает следующую версию, имитируя
 * правки аналитика после уточнений заказчика.
 */
export async function apiFetchPage(pageKey: string, index: number): Promise<FetchedPage> {
  await delay(650 + Math.random() * 550);
  const key = pageKey.trim().toUpperCase();
  const page = PAGES.find((p) => p.id === key || p.confluenceId === key);
  if (!page) {
    throw new Error(`Страница «${pageKey}» не найдена в Confluence (проверьте ID)`);
  }
  const idx = Math.max(0, Math.min(index, page.versions.length - 1));
  return {
    pageId: page.id,
    confluenceId: page.confluenceId,
    title: page.title,
    version: idx + 1,
    maxVersion: page.versions.length,
    content: page.versions[idx],
  };
}

/**
 * Проверка подключения к серверу.
 * demo → эмуляция успешного пинга; иначе — реальная попытка fetch
 * (в браузере почти наверняка завершится ошибкой CORS — это ожидаемо
 * и честно отображается в интерфейсе).
 */
export async function apiPing(
  url: string,
  hasCreds: boolean,
  demo: boolean,
): Promise<ConnStatus> {
  if (demo) {
    await delay(500 + Math.random() * 400);
    return 'demo';
  }
  if (!hasCreds) return 'nocreds';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2600);
    await fetch(url, { signal: ctrl.signal, mode: 'no-cors' });
    clearTimeout(t);
    return 'ok';
  } catch {
    return 'error';
  }
}
