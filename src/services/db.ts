// ============================================================
// Слой данных (демо-режим): localStorage-хранилище + действия.
//
// Интерфейс действий повторяет REST-контракт FastAPI (см. API.md):
//   POST   /api/projects                          → addProject
//   POST   /api/projects/{pid}/requirements       → addRequirement
//   PUT    /api/requirements/{id}                 → updateRequirement (updated_at=now, история)
//   GET    /api/requirements/{id}/history         → state.history
//   PUT    /api/requirements/{id}/validate/{kind} → validateReq
// После запуска backend демо-хранилище заменяется на api-клиент.
// ============================================================

import { useSyncExternalStore } from 'react';
import { FIELD_LABEL, nextReqKey } from '../domain/logic';
import type {
  AppSettings, AppState, Project, ReqType, Requirement, RequirementDraft, RequirementHistoryEntry,
} from '../domain/types';

const KEY = 'rms.state.v1';
let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(++seq).toString(36)}`;

// ---------- Сиды (демонстрационные данные) ----------

function req(
  projectId: string, reqKey: string, reqType: ReqType, title: string,
  o: Partial<Requirement>,
): Requirement {
  return {
    id: uid('r'), projectId, reqKey, reqType, title,
    description: o.description ?? '', linkTz: o.linkTz ?? '', linkChtz: o.linkChtz ?? '',
    release: o.release ?? '1.0', notes: o.notes ?? '', dependencies: o.dependencies ?? '',
    createdAt: o.createdAt ?? '2025-02-10T09:30:00',
    updatedAt: o.updatedAt ?? '2025-02-10T09:30:00',
    lastValidatedFs: undefined as never, lastValidatedTest: undefined as never,
    ...o,
  } as Requirement;
}

function seed(): AppState {
  const p1: Project = { id: 'p-lc', jiraKey: 'LC', name: 'Личный кабинет абитуриента', createdAt: '2025-01-15T10:00:00' };
  const p2: Project = { id: 'p-proj', jiraKey: 'PROJ', name: 'Учебный процесс', createdAt: '2025-03-01T10:00:00' };

  const requirements: Requirement[] = [
    req(p1.id, 'REQ-LC-BUS-0001', 'BUSINESS', 'Приём документов от абитуриентов полностью в электронном виде', {
      description: 'Абитуриент подаёт заявление и комплект документов через личный кабинет без визита в приёмную комиссию.',
      linkTz: 'ТЗ §2.1', linkChtz: 'ЧТЗ 3.1', release: '1.0',
      updatedAt: '2025-02-18T14:00:00', lastValidatedFs: '2025-02-25T11:20:00', lastValidatedTest: '2025-02-25T11:25:00',
    }),
    req(p1.id, 'REQ-LC-BUS-0002', 'BUSINESS', 'Прозрачность конкурсного отбора для абитуриентов', {
      description: 'Абитуриент в любой момент видит свою позицию в рейтинге по каждому конкурсу.',
      linkTz: 'ТЗ §2.2', linkChtz: 'ЧТЗ 3.2', release: '1.0',
      updatedAt: '2025-02-20T10:00:00', lastValidatedFs: '2025-02-27T09:10:00', lastValidatedTest: '2025-02-27T09:40:00',
    }),
    req(p1.id, 'REQ-LC-BUS-0003', 'BUSINESS', 'Сокращение времени обработки заявлений приёмной комиссией', {
      description: 'Автоматическая проверка комплектности заявлений снижает ручную обработку минимум на 60%.',
      linkTz: 'ТЗ §2.3', linkChtz: '', release: '1.1',
      updatedAt: '2025-03-18T16:45:00', lastValidatedFs: '2025-03-02T12:00:00', lastValidatedTest: '2025-03-02T12:05:00',
    }),
    req(p1.id, 'REQ-LC-FUNC-0001', 'FUNCTIONAL', 'Регистрация и вход в личный кабинет абитуриента', {
      description: 'Регистрация по e-mail или телефону, подтверждение кодом, восстановление пароля.',
      linkTz: 'ТЗ §3.1', linkChtz: 'ЧТЗ 4.1', release: '1.0',
      updatedAt: '2025-02-15T12:00:00', lastValidatedFs: '2025-02-22T10:30:00', lastValidatedTest: '2025-02-22T10:35:00',
    }),
    req(p1.id, 'REQ-LC-FUNC-0002', 'FUNCTIONAL', 'Профиль абитуриента и загрузка сканов документов', {
      description: 'Паспорт, аттестат, льготы; форматы PDF/JPG/PNG до 10 МБ, распознавание формата файла.',
      linkTz: 'ТЗ §3.2', linkChtz: 'ЧТЗ 4.2', release: '1.0', dependencies: 'REQ-LC-FUNC-0001',
      updatedAt: '2025-02-16T15:20:00', lastValidatedFs: '2025-02-24T17:00:00', lastValidatedTest: '2025-02-24T17:10:00',
    }),
    req(p1.id, 'REQ-LC-FUNC-0003', 'FUNCTIONAL', 'Мастер подачи заявления на выбранные направления', {
      description: 'Пошаговый мастер: до 5 направлений, контроль оригинала/копии, автоподстановка данных профиля.',
      linkTz: 'ТЗ §3.3', linkChtz: 'ЧТЗ 4.3', release: '1.0', dependencies: 'REQ-LC-FUNC-0002',
      updatedAt: '2025-03-21T11:15:00', lastValidatedFs: '2025-03-05T09:00:00', lastValidatedTest: '2025-03-05T09:05:00',
    }),
    req(p1.id, 'REQ-LC-FUNC-0004', 'FUNCTIONAL', 'Согласия на обработку персональных данных', {
      description: 'Подписание согласий 152-ФЗ при регистрации; журнал выданных и отозванных согласий.',
      linkTz: 'ТЗ §3.4', linkChtz: 'ЧТЗ 4.4', release: '1.0', dependencies: 'REQ-LC-FUNC-0001',
      updatedAt: '2025-03-10T13:40:00', lastValidatedFs: '2025-03-15T10:00:00', lastValidatedTest: '2025-03-01T10:00:00',
    }),
    req(p1.id, 'REQ-LC-FUNC-0005', 'FUNCTIONAL', 'Публикация конкурсных рейтинговых списков', {
      description: 'Ранжирование по баллам, обезличенные списки, обновление не реже раза в час.',
      linkTz: 'ТЗ §3.5', linkChtz: 'ЧТЗ 4.5', release: '1.1', dependencies: 'REQ-LC-FUNC-0003',
      updatedAt: '2025-03-12T18:05:00', lastValidatedFs: '2025-03-01T14:30:00', lastValidatedTest: null,
    }),
    req(p1.id, 'REQ-LC-FUNC-0006', 'FUNCTIONAL', 'Уведомления о статусах заявления на e-mail', {
      description: 'Триггеры: принято, некомплект, зачислен. Шаблоны писем редактируются комиссией.',
      linkTz: 'ТЗ §3.6', linkChtz: 'ЧТЗ 4.6', release: '1.1', dependencies: 'REQ-LC-FUNC-0003',
      updatedAt: '2025-03-04T10:00:00', lastValidatedFs: null, lastValidatedTest: null,
    }),
    req(p1.id, 'REQ-LC-FUNC-0007', 'FUNCTIONAL', 'Интеграция с ЕПГУ (подача через Госуслуги)', {
      description: 'Приём заявлений из суперсервиса «Поступление в вуз онлайн», двусторонний обмен статусами.',
      linkTz: 'ТЗ §3.7', linkChtz: 'ЧТЗ 4.7', release: '2.0',
      updatedAt: '2025-03-20T09:50:00', lastValidatedFs: null, lastValidatedTest: null,
    }),
    req(p1.id, 'REQ-LC-FUNC-0008', 'FUNCTIONAL', 'Экспорт заявлений в «1С:Университет»', {
      description: 'Выгрузка принятых заявлений в учётную систему по расписанию и по требованию.',
      linkTz: 'ТЗ §3.8', linkChtz: 'ЧТЗ 4.8', release: '2.0', dependencies: 'REQ-LC-FUNC-0003',
      updatedAt: '2025-03-19T15:30:00', lastValidatedFs: null, lastValidatedTest: null,
    }),
    req(p1.id, 'REQ-LC-NFUNC-0001', 'NON_FUNCTIONAL', 'Выдерживает 500 одновременных сессий в пиковые дни', {
      description: 'Пик — последний день приёма документов. Время отклика p95 ≤ 2 с.',
      linkTz: 'ТЗ §5.1', linkChtz: 'ЧТЗ 6.1', release: '1.0',
      updatedAt: '2025-02-12T09:00:00', lastValidatedFs: '2025-02-20T16:00:00', lastValidatedTest: '2025-02-20T16:05:00',
    }),
    req(p1.id, 'REQ-LC-NFUNC-0002', 'NON_FUNCTIONAL', 'Хранение персональных данных согласно 152-ФЗ', {
      description: 'Серверы на территории РФ, шифрование при хранении, разграничение доступа.',
      linkTz: 'ТЗ §5.2', linkChtz: 'ЧТЗ 6.2', release: '1.0',
      updatedAt: '2025-03-22T12:10:00', lastValidatedFs: '2025-03-11T11:00:00', lastValidatedTest: '2025-03-11T11:05:00',
    }),
    req(p1.id, 'REQ-LC-NFUNC-0003', 'NON_FUNCTIONAL', 'Доступность 99,5% в период приёмной кампании', {
      description: 'Мониторинг доступности, план восстановления не более 30 минут.',
      linkTz: 'ТЗ §5.3', linkChtz: 'ЧТЗ 6.3', release: '1.1',
      updatedAt: '2025-02-28T10:00:00', lastValidatedFs: '2025-03-06T10:00:00', lastValidatedTest: null,
    }),
    req(p2.id, 'REQ-PROJ-BUS-0001', 'BUSINESS', 'Единое электронное расписание для студентов', {
      description: 'Студент видит актуальное расписание пар, экзаменов и консультаций в одном месте.',
      linkTz: 'ТЗ §1.1', linkChtz: 'ЧТЗ 2.1', release: '1.0',
      updatedAt: '2025-03-05T09:00:00', lastValidatedFs: '2025-03-12T09:00:00', lastValidatedTest: '2025-03-12T09:10:00',
    }),
    req(p2.id, 'REQ-PROJ-FUNC-0001', 'FUNCTIONAL', 'Автоматическая генерация расписания с учётом занятости аудиторий', {
      description: 'Алгоритм учитывает вместимость аудиторий, окна преподавателей и потоки групп.',
      linkTz: 'ТЗ §2.1', linkChtz: 'ЧТЗ 3.1', release: '1.0',
      updatedAt: '2025-03-25T14:20:00', lastValidatedFs: '2025-03-10T10:00:00', lastValidatedTest: null,
    }),
    req(p2.id, 'REQ-PROJ-NFUNC-0001', 'NON_FUNCTIONAL', 'Пересчёт расписания не дольше 30 секунд', {
      description: 'При изменении входных данных диспетчер получает результат за полминуты.',
      linkTz: 'ТЗ §4.1', linkChtz: '', release: '1.0',
      updatedAt: '2025-03-08T11:00:00', lastValidatedFs: null, lastValidatedTest: null,
    }),
  ];

  const history: RequirementHistoryEntry[] = [
    {
      id: uid('h'), requirementId: requirements[7].id, fieldChanged: 'release',
      oldValue: '1.0', newValue: '1.1', changedAt: '2025-03-12T18:05:00',
    },
    {
      id: uid('h'), requirementId: requirements[5].id, fieldChanged: 'title',
      oldValue: 'Мастер подачи заявления', newValue: 'Мастер подачи заявления на выбранные направления',
      changedAt: '2025-03-21T11:15:00',
    },
    {
      id: uid('h'), requirementId: requirements[12].id, fieldChanged: 'description',
      oldValue: 'Серверы на территории РФ.', newValue: 'Серверы на территории РФ, шифрование при хранении, разграничение доступа.',
      changedAt: '2025-03-22T12:10:00',
    },
  ];

  return {
    version: 1,
    activeProjectId: p1.id,
    projects: [p1, p2],
    requirements,
    history,
    settings: {
      jiraUrl: 'https://jira.tomskasu.ru',
      confUrl: 'https://confluence.tomskasu.ru/',
      login: '',
      password: '',
      demoMode: true,
    },
  };
}

// ---------- Хранилище ----------

function load(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AppState) : null;
  } catch {
    return null;
  }
}

let state: AppState = load() ?? seed();
const listeners = new Set<() => void>();

function emit() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* переполнение — игнорируем */ }
  listeners.forEach((l) => l());
}

export function useApp(): AppState {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
  );
}

export function getState(): AppState { return state; }

// ---------- Действия ----------

/** Выбор активного проекта (мультипроектность) */
export function setActiveProject(id: string) {
  state = { ...state, activeProjectId: id };
  emit();
}

/** ➕ Добавить новый проект */
export function addProject(name: string, jiraKey: string): Project {
  const project: Project = { id: uid('p'), jiraKey: jiraKey.toUpperCase(), name, createdAt: new Date().toISOString() };
  state = { ...state, projects: [...state.projects, project], activeProjectId: project.id };
  emit();
  return project;
}

/** 💾 Сохранить настройки интеграций */
export function updateSettings(s: AppSettings) {
  state = { ...state, settings: s };
  emit();
}

/** Редактирование проекта (имя, ключ Jira) */
export function updateProject(id: string, patch: Partial<Pick<Project, 'name' | 'jiraKey'>>) {
  state = {
    ...state,
    projects: state.projects.map((p) => (p.id === id ? { ...p, ...patch, jiraKey: (patch.jiraKey ?? p.jiraKey).toUpperCase() } : p)),
  };
  emit();
}

const EDITABLE: Array<keyof RequirementDraft> = [
  'reqType', 'title', 'description', 'linkTz', 'linkChtz', 'release', 'notes', 'dependencies',
];

/** Создание требования: автогенерация ключа REQ-KEY-TYPE-NNNN */
export function addRequirement(projectId: string, draft: RequirementDraft): Requirement {
  const project = state.projects.find((p) => p.id === projectId);
  const jiraKey = project?.jiraKey ?? 'PRJ';
  const now = new Date().toISOString();
  const r: Requirement = {
    id: uid('r'), projectId,
    reqKey: nextReqKey(state.requirements.filter((x) => x.projectId === projectId), jiraKey, draft.reqType),
    reqType: draft.reqType, title: draft.title.trim(), description: draft.description.trim(),
    linkTz: draft.linkTz.trim(), linkChtz: draft.linkChtz.trim(),
    release: draft.release.trim(), notes: draft.notes.trim(), dependencies: draft.dependencies.trim(),
    createdAt: now, updatedAt: now, lastValidatedFs: null, lastValidatedTest: null,
  };
  state = { ...state, requirements: [...state.requirements, r] };
  emit();
  return r;
}

/**
 * Сохранение требования: updated_at = now → статусы актуальности
 * сбрасываются в «Требует проверки»; изменения пишутся в историю.
 */
export function updateRequirement(id: string, draft: RequirementDraft): void {
  const r = state.requirements.find((x) => x.id === id);
  if (!r) return;
  const now = new Date().toISOString();
  const entries: RequirementHistoryEntry[] = [];
  const next = { ...r };
  for (const f of EDITABLE) {
    const oldV = String(r[f]);
    const newV = String(draft[f]).trim();
    if (oldV !== newV) {
      entries.push({ id: uid('h'), requirementId: id, fieldChanged: f, oldValue: oldV, newValue: newV, changedAt: now });
      (next[f] as string) = newV;
    }
  }
  if (entries.length === 0) return; // нет изменений — не трогаем updated_at
  next.updatedAt = now;
  state = {
    ...state,
    requirements: state.requirements.map((x) => (x.id === id ? next : x)),
    history: [...entries, ...state.history],
  };
  emit();
}

/** ✅ Подтвердить актуальность (по ФС или по тестам) */
export function validateRequirement(id: string, kind: 'fs' | 'tests'): void {
  const now = new Date().toISOString();
  state = {
    ...state,
    requirements: state.requirements.map((x) =>
      x.id === id ? { ...x, [kind === 'fs' ? 'lastValidatedFs' : 'lastValidatedTest']: now } : x,
    ),
  };
  emit();
}

export function deleteRequirement(id: string): void {
  state = {
    ...state,
    requirements: state.requirements.filter((x) => x.id !== id),
    history: state.history.filter((h) => h.requirementId !== id),
  };
  emit();
}

/** Импорт из Excel/CSV: массив черновиков → требования с автоключами */
export function importRequirements(projectId: string, drafts: RequirementDraft[]): Requirement[] {
  return drafts.map((d) => addRequirement(projectId, d));
}

/** Сброс к демо-данным */
export function resetDemo(): void {
  state = seed();
  emit();
}

export { FIELD_LABEL };
