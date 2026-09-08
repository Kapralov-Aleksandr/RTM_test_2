// ============================================================
// Слой данных с АВТООПРЕДЕЛЕНИЕМ режима:
//  · backend доступен (GET /api/health через прокси Vite) → REST,
//    данные живут в data/app.db;
//  · недоступен (или включён демо-переключатель) → localStorage.
// UI-компоненты не знают о режиме: единый useApp() + действия.
// ============================================================

import { useSyncExternalStore } from 'react';
import { FIELD_LABEL, nextReqKey } from '../domain/logic';
import type {
  AppSettings, AppState, ChtzDocument, Feature, FeatureTreeNode, Mockup, Project,
  Requirement, RequirementDraft, RequirementHistoryEntry, TzDocument, TzMention,
} from '../domain/types';
import {
  api, checkHealth, type ApiFeature, type ApiRequirement, type ApiTreeNode,
} from './api';

const KEY = 'rms.state.v2';
const PREF_KEY = 'rms.modepref';

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(++seq).toString(36)}`;

export type StoreMode = 'demo' | 'api';
let mode: StoreMode = 'demo';
let backendOnline = false;

export const getMode = () => mode;
export const getBackendOnline = () => backendOnline;

const getPref = (): 'auto' | 'demo' => {
  try { return localStorage.getItem(PREF_KEY) === 'demo' ? 'demo' : 'auto'; } catch { return 'auto'; }
};

export function setDemoPreference(demo: boolean) {
  try { localStorage.setItem(PREF_KEY, demo ? 'demo' : 'auto'); } catch { /* ignore */ }
  void initStore();
}

// ---------- Сиды (демо-режим) ----------

const TZ_SEED_HTML = `<h2>1. Общие сведения</h2><p>Настоящее техническое задание определяет требования к разработке сервиса «Личный кабинет абитуриента» (далее — Система) для автоматизации приёмной кампании.</p><h2>2. Бизнес-требования</h2><p><mark class="req-hl" data-req-key="REQ-LC-BUS-0001" data-req-id="">Абитуриент должен иметь возможность подать заявление и полный комплект документов в электронном виде, без личного визита в приёмную комиссию.</mark></p><p>Система должна обеспечивать прозрачность конкурсного отбора: каждый абитуриент видит свою позицию в рейтинге.</p><h2>3. Функциональные требования</h2><ul><li>Регистрация по e-mail или номеру телефона с подтверждением кодом.</li><li>Загрузка сканов документов: паспорт, аттестат, документы о льготах (PDF/JPG/PNG, до 10 МБ).</li><li>Пошаговый мастер подачи заявления с выбором до 5 направлений подготовки.</li></ul><h2>5. Нефункциональные требования</h2><p>Система должна выдерживать не менее 500 одновременных сессий в пиковые дни приёма документов; время отклика — не более 2 секунд.</p>`;

function seedReq(projectId: string, reqKey: string, reqType: Requirement['reqType'], title: string, o: Partial<Requirement>): Requirement {
  return {
    id: uid('r'), projectId, reqKey, reqType, title,
    description: o.description ?? '', linkTz: o.linkTz ?? '', linkChtz: o.linkChtz ?? '',
    release: o.release ?? '1.0', notes: o.notes ?? '', dependencies: o.dependencies ?? '',
    createdAt: o.createdAt ?? '2025-02-10T09:30:00', updatedAt: o.updatedAt ?? '2025-02-10T09:30:00',
    lastValidatedFs: o.lastValidatedFs ?? null, lastValidatedTest: o.lastValidatedTest ?? null,
  };
}

function seed(): AppState {
  const p1: Project = { id: 'p-lc', jiraKey: 'LC', name: 'Личный кабинет абитуриента', createdAt: '2025-01-15T10:00:00' };
  const p2: Project = { id: 'p-proj', jiraKey: 'PROJ', name: 'Учебный процесс', createdAt: '2025-03-01T10:00:00' };
  const requirements: Requirement[] = [
    seedReq(p1.id, 'REQ-LC-BUS-0001', 'BUSINESS', 'Приём документов от абитуриентов полностью в электронном виде', { linkTz: 'ТЗ §2.1', linkChtz: 'ЧТЗ 3.1', updatedAt: '2025-02-18T14:00:00', lastValidatedFs: '2025-02-25T11:20:00', lastValidatedTest: '2025-02-25T11:25:00' }),
    seedReq(p1.id, 'REQ-LC-BUS-0002', 'BUSINESS', 'Прозрачность конкурсного отбора для абитуриентов', { linkTz: 'ТЗ §2.2', linkChtz: 'ЧТЗ 3.2', updatedAt: '2025-02-20T10:00:00', lastValidatedFs: '2025-02-27T09:10:00', lastValidatedTest: '2025-02-27T09:40:00' }),
    seedReq(p1.id, 'REQ-LC-BUS-0003', 'BUSINESS', 'Сокращение времени обработки заявлений приёмной комиссией', { linkTz: 'ТЗ §2.3', release: '1.1', updatedAt: '2025-03-18T16:45:00', lastValidatedFs: '2025-03-02T12:00:00', lastValidatedTest: '2025-03-02T12:05:00' }),
    seedReq(p1.id, 'REQ-LC-FUNC-0001', 'FUNCTIONAL', 'Регистрация и вход в личный кабинет абитуриента', { linkTz: 'ТЗ §3.1', linkChtz: 'ЧТЗ 4.1', updatedAt: '2025-02-15T12:00:00', lastValidatedFs: '2025-02-22T10:30:00', lastValidatedTest: '2025-02-22T10:35:00' }),
    seedReq(p1.id, 'REQ-LC-FUNC-0002', 'FUNCTIONAL', 'Профиль абитуриента и загрузка сканов документов', { linkTz: 'ТЗ §3.2', linkChtz: 'ЧТЗ 4.2', dependencies: 'REQ-LC-FUNC-0001', updatedAt: '2025-02-16T15:20:00', lastValidatedFs: '2025-02-24T17:00:00', lastValidatedTest: '2025-02-24T17:10:00' }),
    seedReq(p1.id, 'REQ-LC-FUNC-0003', 'FUNCTIONAL', 'Мастер подачи заявления на выбранные направления', { linkTz: 'ТЗ §3.3', linkChtz: 'ЧТЗ 4.3', dependencies: 'REQ-LC-FUNC-0002', updatedAt: '2025-03-21T11:15:00', lastValidatedFs: '2025-03-05T09:00:00', lastValidatedTest: '2025-03-05T09:05:00' }),
    seedReq(p1.id, 'REQ-LC-FUNC-0004', 'FUNCTIONAL', 'Согласия на обработку персональных данных', { linkTz: 'ТЗ §3.4', linkChtz: 'ЧТЗ 4.4', dependencies: 'REQ-LC-FUNC-0001', updatedAt: '2025-03-10T13:40:00', lastValidatedFs: '2025-03-15T10:00:00', lastValidatedTest: '2025-03-01T10:00:00' }),
    seedReq(p1.id, 'REQ-LC-FUNC-0005', 'FUNCTIONAL', 'Публикация конкурсных рейтинговых списков', { linkTz: 'ТЗ §3.5', linkChtz: 'ЧТЗ 4.5', release: '1.1', dependencies: 'REQ-LC-FUNC-0003', updatedAt: '2025-03-12T18:05:00', lastValidatedFs: '2025-03-01T14:30:00' }),
    seedReq(p1.id, 'REQ-LC-FUNC-0006', 'FUNCTIONAL', 'Уведомления о статусах заявления на e-mail', { linkTz: 'ТЗ §3.6', linkChtz: 'ЧТЗ 4.6', release: '1.1', dependencies: 'REQ-LC-FUNC-0003', updatedAt: '2025-03-04T10:00:00' }),
    seedReq(p1.id, 'REQ-LC-FUNC-0007', 'FUNCTIONAL', 'Интеграция с ЕПГУ (подача через Госуслуги)', { linkTz: 'ТЗ §3.7', linkChtz: 'ЧТЗ 4.7', release: '2.0', updatedAt: '2025-03-20T09:50:00' }),
    seedReq(p1.id, 'REQ-LC-NFUNC-0001', 'NON_FUNCTIONAL', 'Выдерживает 500 одновременных сессий в пиковые дни', { linkTz: 'ТЗ §5.1', linkChtz: 'ЧТЗ 6.1', updatedAt: '2025-02-12T09:00:00', lastValidatedFs: '2025-02-20T16:00:00', lastValidatedTest: '2025-02-20T16:05:00' }),
    seedReq(p1.id, 'REQ-LC-NFUNC-0002', 'NON_FUNCTIONAL', 'Хранение персональных данных согласно 152-ФЗ', { linkTz: 'ТЗ §5.2', linkChtz: 'ЧТЗ 6.2', updatedAt: '2025-03-22T12:10:00', lastValidatedFs: '2025-03-11T11:00:00', lastValidatedTest: '2025-03-11T11:05:00' }),
    seedReq(p2.id, 'REQ-PROJ-BUS-0001', 'BUSINESS', 'Единое электронное расписание для студентов', { linkTz: 'ТЗ §1.1', linkChtz: 'ЧТЗ 2.1', updatedAt: '2025-03-05T09:00:00', lastValidatedFs: '2025-03-12T09:00:00', lastValidatedTest: '2025-03-12T09:10:00' }),
    seedReq(p2.id, 'REQ-PROJ-FUNC-0001', 'FUNCTIONAL', 'Автоматическая генерация расписания с учётом занятости аудиторий', { linkTz: 'ТЗ §2.1', linkChtz: 'ЧТЗ 3.1', updatedAt: '2025-03-25T14:20:00', lastValidatedFs: '2025-03-10T10:00:00' }),
  ];

  const rel1 = uid('n'), rel2 = uid('n'), f1 = uid('f'), f2 = uid('f'), f3 = uid('f');
  return {
    version: 2,
    activeProjectId: p1.id,
    projects: [p1, p2],
    requirements,
    history: [
      { id: uid('h'), requirementId: requirements[5].id, fieldChanged: 'title', oldValue: 'Мастер подачи заявления', newValue: 'Мастер подачи заявления на выбранные направления', changedAt: '2025-03-21T11:15:00' },
      { id: uid('h'), requirementId: requirements[11].id, fieldChanged: 'description', oldValue: 'Серверы на территории РФ.', newValue: 'Серверы на территории РФ, шифрование при хранении, разграничение доступа.', changedAt: '2025-03-22T12:10:00' },
    ],
    tzDoc: {
      id: uid('d'), projectId: p1.id, title: 'ТЗ на разработку Личного кабинета абитуриента',
      content: TZ_SEED_HTML, attachment: null,
      mentions: [{ reqId: requirements[0].id, reqKey: 'REQ-LC-BUS-0001', start: 190, end: 330, text: 'Абитуриент должен иметь возможность подать заявление и полный комплект документов в электронном виде, без личного визита в приёмную комиссию.' }],
      updatedAt: '2025-03-24T10:00:00',
    },
    chtzDoc: {
      id: uid('d'), projectId: p1.id, title: 'ЧТЗ · Личный кабинет абитуриента',
      content: `<h2>3. Требования к подаче документов</h2><p>Раздел реализует требование <span class="req-badge" data-req-badge="" data-req-id="${requirements[0].id}" data-req-key="REQ-LC-BUS-0001">REQ-LC-BUS-0001</span>: электронный приём полного комплекта документов.</p><h2>4. Функциональные сценарии</h2><p>Регистрация и вход описаны в <span class="req-badge" data-req-badge="" data-req-id="${requirements[3].id}" data-req-key="REQ-LC-FUNC-0001">REQ-LC-FUNC-0001</span>, профиль и загрузка сканов — в <span class="req-badge" data-req-badge="" data-req-id="${requirements[4].id}" data-req-key="REQ-LC-FUNC-0002">REQ-LC-FUNC-0002</span>.</p>`,
      updatedAt: '2025-03-24T10:05:00',
    },
    tree: [
      { id: rel1, projectId: p1.id, parentId: null, nodeType: 'RELEASE', name: 'Релиз 1.0 · Приём документов', orderNum: 0 },
      { id: f1, projectId: p1.id, parentId: rel1, nodeType: 'FEATURE', name: 'Регистрация и вход', orderNum: 0 },
      { id: f2, projectId: p1.id, parentId: rel1, nodeType: 'FEATURE', name: 'Подача заявления', orderNum: 1 },
      { id: rel2, projectId: p1.id, parentId: null, nodeType: 'RELEASE', name: 'Релиз 2.0 · Интеграции', orderNum: 1 },
      { id: f3, projectId: p1.id, parentId: rel2, nodeType: 'FEATURE', name: 'ЕПГУ (Госуслуги)', orderNum: 0 },
    ],
    features: [
      {
        id: uid('ft'), treeNodeId: f1, title: 'Регистрация и вход', linkJira: 'ASU-301', linkTestCases: 'ПМИ §4.1',
        content: `<h2>Бизнес-ценность</h2><p>Абитуриент за 2 минуты создаёт кабинет и получает доступ к подаче документов.</p><h2>Сценарий</h2><ol><li>Ввод e-mail / телефона</li><li>Подтверждение кодом из SMS или письма</li><li>Восстановление пароля</li></ol>`,
        requirementIds: [requirements[3].id, requirements[6].id],
        mockups: [], updatedAt: '2025-03-20T10:00:00', lastValidated: '2025-03-22T10:00:00',
      },
      {
        id: uid('ft'), treeNodeId: f2, title: 'Подача заявления', linkJira: 'ASU-305', linkTestCases: '',
        content: `<h2>Бизнес-ценность</h2><p>Пошаговый мастер снижает число некомплектных заявлений.</p><ul><li>До 5 направлений подготовки</li><li>Автоподстановка данных профиля</li><li>Контроль обязательных сканов</li></ul>`,
        requirementIds: [requirements[5].id],
        mockups: [], updatedAt: '2025-03-21T15:00:00', lastValidated: null,
      },
    ],
    settings: { jiraUrl: 'https://jira.tomskasu.ru', confUrl: 'https://confluence.tomskasu.ru/', login: '', password: '', demoMode: false },
  };
}

// ---------- Хранилище ----------

function loadDemo(): AppState | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as AppState) : null; } catch { return null; }
}

let state: AppState = loadDemo() ?? seed();
const listeners = new Set<() => void>();

function emit(persist = mode === 'demo') {
  if (persist && mode === 'demo') {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* переполнение */ }
  }
  listeners.forEach((l) => l());
}

export function useApp(): AppState {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
  );
}

export const getState = () => state;

// ---------- Нормализация ответов backend → доменные типы ----------

const normReq = (r: ApiRequirement): Requirement => ({
  id: String(r.id), projectId: String(r.project_id), reqKey: r.req_key,
  reqType: r.req_type as Requirement['reqType'], title: r.title,
  description: r.description ?? '', linkTz: r.link_tz ?? '', linkChtz: r.link_chtz ?? '',
  release: r.release ?? '', notes: r.notes ?? '', dependencies: r.dependencies ?? '',
  createdAt: r.created_at, updatedAt: r.updated_at,
  lastValidatedFs: r.last_validated_fs, lastValidatedTest: r.last_validated_test,
});

const normNode = (n: ApiTreeNode, pid: string): FeatureTreeNode => ({
  id: String(n.id), projectId: pid, parentId: n.parent_id === null ? null : String(n.parent_id),
  nodeType: n.node_type, name: n.name, jiraKey: n.jira_key ?? undefined, orderNum: n.order_num,
});

const normFeature = (f: ApiFeature): Feature => ({
  id: String(f.id), treeNodeId: String(f.tree_node_id), title: f.title, content: f.content ?? '',
  linkJira: f.link_jira ?? '', linkTestCases: f.link_test_cases ?? '',
  requirementIds: f.requirement_ids.map(String),
  mockups: f.mockups.map((m): Mockup => ({ id: String(m.id), name: m.filename, url: m.url })),
  updatedAt: f.updated_at, lastValidated: f.last_validated,
});

/** Полное обновление кэша из backend для активного проекта */
async function refreshFromApi() {
  const [projects, reqs, tree, features, tz, chtz] = await Promise.all([
    api.listProjects(),
    api.listRequirements(state.activeProjectId),
    api.getTree(state.activeProjectId),
    api.getFeatures(state.activeProjectId),
    api.getTz(state.activeProjectId),
    api.getChtz(state.activeProjectId),
  ]);
  const pid = state.activeProjectId;
  if (!projects.some((p) => String(p.id) === pid) && projects.length > 0) {
    state = { ...state, activeProjectId: String(projects[0].id) };
  }
  const tzDoc: TzDocument | null = tz ? {
    id: String(tz.id), projectId: state.activeProjectId, title: tz.title ?? 'Техническое задание',
    content: tz.content ?? '',
    attachment: tz.attached_file_path ? { name: tz.attached_file_path.split('/').pop() ?? 'файл', url: `/files/${tz.attached_file_path}` } : null,
    mentions: tz.mentions.map((m) => {
      const reqKey = reqs.find((r) => r.id === m.requirement_id)?.req_key ?? `REQ-${m.requirement_id}`;
      return { reqId: String(m.requirement_id), reqKey, start: m.start_offset, end: m.end_offset, text: m.highlighted_text };
    }),
    updatedAt: new Date().toISOString(),
  } : null;
  const chtzDoc: ChtzDocument | null = chtz ? {
    id: String(chtz.id), projectId: state.activeProjectId, title: chtz.title ?? 'ЧТЗ',
    content: chtz.content ?? '', updatedAt: new Date().toISOString(),
  } : null;
  state = {
    ...state,
    projects: projects.map((p) => ({ id: String(p.id), jiraKey: p.jira_key, name: p.name, createdAt: p.created_at })),
    requirements: reqs.map(normReq),
    tree: tree.map((n) => normNode(n, state.activeProjectId)),
    features: features.map(normFeature),
    tzDoc, chtzDoc,
  };
  emit(false);
}

/** Инициализация: автоопределение режима. Вызывается из App. */
export async function initStore(): Promise<void> {
  backendOnline = await checkHealth();
  const next: StoreMode = backendOnline && getPref() !== 'demo' ? 'api' : 'demo';
  const switched = next !== mode;
  mode = next;
  if (mode === 'api') {
    try { await refreshFromApi(); return; } catch { mode = 'demo'; }
  }
  if (switched) { state = loadDemo() ?? seed(); }
  emit();
}

// ---------- Действия (прозрачно demo/api) ----------

const asApiId = (id: string) => id; // строки-числа проходят в URL как есть

export async function setActiveProject(id: string): Promise<void> {
  state = { ...state, activeProjectId: id, history: [] };
  if (mode === 'api') {
    await refreshFromApi();
  } else {
    // В демо-режиме сбрасываем документы при смене проекта
    state = { ...state, tzDoc: null, chtzDoc: null };
    emit();
  }
}

export async function addProject(name: string, jiraKey: string): Promise<Project | null> {
  if (mode === 'api') {
    const p = await api.createProject({ jira_key: jiraKey, name });
    state = { ...state, activeProjectId: String(p.id) };
    await refreshFromApi();
    return { id: String(p.id), jiraKey: p.jira_key, name: p.name, createdAt: p.created_at };
  }
  if (state.projects.some((p) => p.jiraKey === jiraKey.toUpperCase())) return null;
  const project: Project = { id: uid('p'), jiraKey: jiraKey.toUpperCase(), name, createdAt: new Date().toISOString() };
  state = { ...state, projects: [...state.projects, project], activeProjectId: project.id, tree: [], features: [], tzDoc: null, chtzDoc: null };
  emit();
  return project;
}

export async function updateProjectKey(id: string, jiraKey: string): Promise<void> {
  if (mode === 'api') { await api.updateProject(asApiId(id), { jira_key: jiraKey }); await refreshFromApi(); return; }
  state = { ...state, projects: state.projects.map((p) => (p.id === id ? { ...p, jiraKey } : p)) };
  emit();
}

export function updateSettings(s: AppSettings) {
  state = { ...state, settings: s };
  emit();
}

const draftToPayload = (d: RequirementDraft) => ({
  req_type: d.reqType, title: d.title.trim(), description: d.description.trim(),
  link_tz: d.linkTz.trim(), link_chtz: d.linkChtz.trim(), release: d.release.trim(),
  notes: d.notes.trim(), dependencies: d.dependencies.trim(),
});

export async function addRequirement(projectId: string, draft: RequirementDraft): Promise<Requirement | null> {
  if (mode === 'api') {
    const r = await api.createRequirement(asApiId(projectId), draftToPayload(draft));
    await refreshFromApi();
    return normReq(r);
  }
  const project = state.projects.find((p) => p.id === projectId);
  const now = new Date().toISOString();
  const r: Requirement = {
    id: uid('r'), projectId,
    reqKey: nextReqKey(state.requirements.filter((x) => x.projectId === projectId), project?.jiraKey ?? 'PRJ', draft.reqType),
    reqType: draft.reqType, title: draft.title.trim(), description: draft.description.trim(),
    linkTz: draft.linkTz.trim(), linkChtz: draft.linkChtz.trim(), release: draft.release.trim(),
    notes: draft.notes.trim(), dependencies: draft.dependencies.trim(),
    createdAt: now, updatedAt: now, lastValidatedFs: null, lastValidatedTest: null,
  };
  state = { ...state, requirements: [...state.requirements, r] };
  emit();
  return r;
}

const EDITABLE: Array<keyof RequirementDraft> = ['reqType', 'title', 'description', 'linkTz', 'linkChtz', 'release', 'notes', 'dependencies'];

export async function updateRequirement(id: string, draft: RequirementDraft): Promise<void> {
  if (mode === 'api') { await api.updateRequirement(asApiId(id), draftToPayload(draft)); await refreshFromApi(); return; }
  const r = state.requirements.find((x) => x.id === id);
  if (!r) return;
  const now = new Date().toISOString();
  const entries: RequirementHistoryEntry[] = [];
  const next = { ...r };
  for (const f of EDITABLE) {
    const oldV = String(r[f]); const newV = String(draft[f]).trim();
    if (oldV !== newV) {
      entries.push({ id: uid('h'), requirementId: id, fieldChanged: f, oldValue: oldV, newValue: newV, changedAt: now });
      (next[f] as string) = newV;
    }
  }
  if (entries.length === 0) return;
  next.updatedAt = now;
  state = { ...state, requirements: state.requirements.map((x) => (x.id === id ? next : x)), history: [...entries, ...state.history] };
  emit();
}

export async function validateRequirement(id: string, kind: 'fs' | 'tests'): Promise<void> {
  if (mode === 'api') { await api.validateRequirement(asApiId(id), kind); await refreshFromApi(); return; }
  const now = new Date().toISOString();
  state = { ...state, requirements: state.requirements.map((x) => (x.id === id ? { ...x, [kind === 'fs' ? 'lastValidatedFs' : 'lastValidatedTest']: now } : x)) };
  emit();
}

export async function deleteRequirement(id: string): Promise<void> {
  if (mode === 'api') { await api.deleteRequirement(asApiId(id)); await refreshFromApi(); return; }
  state = {
    ...state,
    requirements: state.requirements.filter((x) => x.id !== id),
    history: state.history.filter((h) => h.requirementId !== id),
    features: state.features.map((f) => ({ ...f, requirementIds: f.requirementIds.filter((rid) => rid !== id) })),
    tzDoc: state.tzDoc ? { ...state.tzDoc, mentions: state.tzDoc.mentions.filter((m) => m.reqId !== id) } : null,
  };
  emit();
}

/** Подгрузка истории (api: REST, демо: уже в кэше) */
export async function loadHistory(reqId: string): Promise<RequirementHistoryEntry[]> {
  if (mode === 'api') {
    const h = await api.requirementHistory(asApiId(reqId));
    return h.map((e) => ({
      id: String(e.id), requirementId: String(e.requirement_id), fieldChanged: e.field_changed,
      oldValue: e.old_value ?? '', newValue: e.new_value ?? '', changedAt: e.changed_at,
    }));
  }
  return state.history.filter((e) => e.requirementId === reqId);
}

export async function importRequirements(projectId: string, drafts: RequirementDraft[]): Promise<Requirement[]> {
  const out: Requirement[] = [];
  for (const d of drafts) {
    const r = await addRequirement(projectId, d);
    if (r) out.push(r);
  }
  return out;
}

// ---------- Документы (Таб 1 и Таб 3) ----------

export async function saveTzDoc(title: string, content: string, mentions: TzMention[]): Promise<void> {
  if (mode === 'api') {
    await api.saveTz(state.activeProjectId, {
      title, content,
      mentions: mentions.map((m) => ({
        requirement_id: Number(m.reqId), start_offset: m.start, end_offset: m.end, highlighted_text: m.text,
      })),
    });
    await refreshFromApi();
    return;
  }
  const now = new Date().toISOString();
  state = {
    ...state,
    tzDoc: { id: state.tzDoc?.id ?? uid('d'), projectId: state.activeProjectId, title, content, attachment: state.tzDoc?.attachment ?? null, mentions, updatedAt: now },
  };
  emit();
}

export async function uploadTzAttachment(file: File): Promise<{ name: string; url: string } | null> {
  if (mode === 'api') {
    const r = await api.uploadTzFile(state.activeProjectId, file);
    await refreshFromApi();
    return { name: r.filename, url: r.url };
  }
  const url = await new Promise<string>((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result));
    rd.onerror = () => reject(new Error('Не удалось прочитать файл'));
    rd.readAsDataURL(file);
  });
  state = { ...state, tzDoc: state.tzDoc ? { ...state.tzDoc, attachment: { name: file.name, url } } : state.tzDoc };
  emit();
  return { name: file.name, url };
}

export async function saveChtzDoc(title: string, content: string): Promise<void> {
  if (mode === 'api') { await api.saveChtz(state.activeProjectId, { title, content }); await refreshFromApi(); return; }
  state = { ...state, chtzDoc: { id: state.chtzDoc?.id ?? uid('d'), projectId: state.activeProjectId, title, content, updatedAt: new Date().toISOString() } };
  emit();
}

// ---------- Дерево и фичи (Таб 4) ----------

export async function addTreeNode(nodeType: 'RELEASE' | 'FEATURE', name: string, parentId: string | null): Promise<void> {
  if (mode === 'api') {
    await api.addTreeNode(state.activeProjectId, { node_type: nodeType, name, parent_id: parentId === null ? null : Number(parentId) });
    await refreshFromApi(); return;
  }
  const siblings = state.tree.filter((n) => n.parentId === parentId);
  state = { ...state, tree: [...state.tree, { id: uid('n'), projectId: state.activeProjectId, parentId, nodeType, name, orderNum: siblings.length }] };
  emit();
}

/** Импорт структуры дерева из JSON (рекурсивно создаёт релизы и фичи) */
export async function importTreeStructure(nodes: Array<{ name: string; node_type: 'RELEASE' | 'FEATURE'; children?: unknown[]; jira_key?: string | null }>): Promise<{ releases: number; features: number }> {
  if (mode === 'api') {
    const result = await api.importTree(state.activeProjectId, { nodes });
    await refreshFromApi();
    return result;
  }
  // Демо-режим: рекурсивно создаём узлы
  let releases = 0, features = 0;
  interface ImportNode { name: string; node_type: 'RELEASE' | 'FEATURE'; children?: ImportNode[]; jira_key?: string | null; }
  const createNode = (node: ImportNode, parentId: string | null) => {
    const siblings = state.tree.filter((n) => n.parentId === parentId);
    const id = uid('n');
    const newNode: FeatureTreeNode = {
      id, projectId: state.activeProjectId, parentId, nodeType: node.node_type,
      name: node.name, jiraKey: node.jira_key ?? undefined, orderNum: siblings.length,
    };
    state = { ...state, tree: [...state.tree, newNode] };
    if (node.node_type === 'RELEASE') releases++;
    else {
      features++;
      state = { ...state, features: [...state.features, { id: uid('ft'), treeNodeId: id, title: node.name, content: '', linkJira: '', linkTestCases: '', requirementIds: [], mockups: [], updatedAt: new Date().toISOString(), lastValidated: null }] };
    }
    if (node.children) {
      for (const child of node.children) {
        createNode(child, id);
      }
    }
  };
  for (const root of nodes) {
    createNode(root as ImportNode, null);
  }
  emit();
  return { releases, features };
}

export async function renameTreeNode(id: string, name: string): Promise<void> {
  if (mode === 'api') { await api.renameTreeNode(asApiId(id), { name }); await refreshFromApi(); return; }
  state = {
    ...state,
    tree: state.tree.map((n) => (n.id === id ? { ...n, name } : n)),
    features: state.features.map((f) => (f.treeNodeId === id ? { ...f, title: name } : f)),
  };
  emit();
}

export async function deleteTreeNode(id: string): Promise<void> {
  if (mode === 'api') { await api.deleteTreeNode(asApiId(id)); await refreshFromApi(); return; }
  const childIds = state.tree.filter((n) => n.parentId === id).map((n) => n.id);
  const remove = new Set([id, ...childIds]);
  state = {
    ...state,
    tree: state.tree.filter((n) => !remove.has(n.id)),
    features: state.features.filter((f) => !remove.has(f.treeNodeId)),
  };
  emit();
}

export async function moveTreeNode(id: string, parentId: string | null, orderNum: number): Promise<void> {
  if (mode === 'api') { await api.moveTreeNode(asApiId(id), { parent_id: parentId === null ? null : Number(parentId), order_num: orderNum }); await refreshFromApi(); return; }
  state = { ...state, tree: state.tree.map((n) => (n.id === id ? { ...n, parentId, orderNum } : n)) };
  emit();
}

export async function saveFeature(treeNodeId: string, body: { title: string; content: string; linkJira: string; linkTestCases: string }): Promise<void> {
  if (mode === 'api') {
    await api.saveFeature(asApiId(treeNodeId), { title: body.title, content: body.content, link_jira: body.linkJira, link_test_cases: body.linkTestCases });
    await refreshFromApi(); return;
  }
  const existing = state.features.find((f) => f.treeNodeId === treeNodeId);
  const now = new Date().toISOString();
  if (existing) {
    state = { ...state, features: state.features.map((f) => (f.id === existing.id ? { ...f, ...body, title: body.title, linkJira: body.linkJira, linkTestCases: body.linkTestCases, updatedAt: now } : f)) };
  } else {
    state = { ...state, features: [...state.features, { id: uid('ft'), treeNodeId, title: body.title, content: body.content, linkJira: body.linkJira, linkTestCases: body.linkTestCases, requirementIds: [], mockups: [], updatedAt: now, lastValidated: null }] };
  }
  emit();
}

export async function linkRequirement(featureId: string, reqId: string): Promise<void> {
  if (mode === 'api') { await api.linkRequirement(asApiId(featureId), asApiId(reqId)); await refreshFromApi(); return; }
  state = { ...state, features: state.features.map((f) => (f.id === featureId && !f.requirementIds.includes(reqId) ? { ...f, requirementIds: [...f.requirementIds, reqId] } : f)) };
  emit();
}

export async function unlinkRequirement(featureId: string, reqId: string): Promise<void> {
  if (mode === 'api') { await api.unlinkRequirement(asApiId(featureId), asApiId(reqId)); await refreshFromApi(); return; }
  state = { ...state, features: state.features.map((f) => (f.id === featureId ? { ...f, requirementIds: f.requirementIds.filter((x) => x !== reqId) } : f)) };
  emit();
}

export async function uploadMockup(featureId: string, file: File): Promise<void> {
  if (mode === 'api') { await api.uploadMockup(asApiId(featureId), file); await refreshFromApi(); return; }
  const url = await new Promise<string>((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result));
    rd.onerror = () => reject(new Error('Не удалось прочитать файл'));
    rd.readAsDataURL(file);
  });
  state = { ...state, features: state.features.map((f) => (f.id === featureId ? { ...f, mockups: [...f.mockups, { id: uid('m'), name: file.name, url }] } : f)) };
  emit();
}

export async function deleteMockup(featureId: string, mockupId: string): Promise<void> {
  if (mode === 'api') { await api.deleteMockup(asApiId(mockupId)); await refreshFromApi(); return; }
  state = { ...state, features: state.features.map((f) => (f.id === featureId ? { ...f, mockups: f.mockups.filter((m) => m.id !== mockupId) } : f)) };
  emit();
}

export async function resetDemo(): Promise<void> {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  mode = 'demo';
  state = seed();
  emit();
}

export { FIELD_LABEL };
