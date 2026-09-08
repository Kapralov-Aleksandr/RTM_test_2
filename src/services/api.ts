// ============================================================
// REST-клиент. Все пути — ОТНОСИТЕЛЬНЫЕ (/api/...):
// в dev-режиме Vite проксирует их на FastAPI (vite.config.js),
// в desktop-сборке (Tauri) — тот же путь до локального сервера.
// Никакой ручной настройки API_URL не требуется.
// ============================================================

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let detail = `Сервер ответил ошибкой HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.detail) detail = String(j.detail);
    } catch { /* тело не JSON — оставляем статус */ }
    throw new ApiError(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const j = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
const jp = (body: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) });

/** Быстрая проверка доступности бэкенда (для автоопределения режима) */
export async function checkHealth(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

// ---------- Ответы бэкенда (Pydantic-модели → TS) ----------

export interface ApiProject { id: number; jira_key: string; name: string; created_at: string; }
export interface ApiRequirement {
  id: number; project_id: number; req_key: string; req_type: string; title: string;
  description: string | null; link_tz: string | null; link_chtz: string | null;
  release: string | null; notes: string | null; dependencies: string | null;
  created_at: string; updated_at: string;
  last_validated_fs: string | null; last_validated_test: string | null;
}
export interface ApiHistory {
  id: number; requirement_id: number; field_changed: string;
  old_value: string | null; new_value: string | null; changed_at: string;
}
export interface ApiTz {
  id: number; title: string | null; content: string | null;
  attached_file_path: string | null;
  mentions: Array<{ requirement_id: number; start_offset: number; end_offset: number; highlighted_text: string }>;
}
export interface ApiChtz { id: number; title: string | null; content: string | null; }
export interface ApiTreeNode {
  id: number; parent_id: number | null; node_type: 'RELEASE' | 'FEATURE';
  name: string; jira_key: string | null; order_num: number;
}
export interface ApiFeature {
  id: number; tree_node_id: number; title: string; content: string | null;
  link_jira: string | null; link_test_cases: string | null;
  requirement_ids: number[];
  mockups: Array<{ id: number; filename: string; url: string }>;
  updated_at: string; last_validated: string | null;
}

export const api = {
  // Проекты
  listProjects: () => request<ApiProject[]>('/api/projects'),
  createProject: (body: { jira_key: string; name: string }) => request<ApiProject>('/api/projects', j(body)),
  updateProject: (id: string, body: { jira_key?: string; name?: string }) =>
    request<ApiProject>(`/api/projects/${id}`, jp(body)),

  // Требования
  listRequirements: (pid: string) => request<ApiRequirement[]>(`/api/projects/${pid}/requirements`),
  createRequirement: (pid: string, body: Record<string, unknown>) =>
    request<ApiRequirement>(`/api/projects/${pid}/requirements`, j(body)),
  updateRequirement: (id: string, body: Record<string, unknown>) =>
    request<ApiRequirement>(`/api/requirements/${id}`, jp(body)),
  validateRequirement: (id: string, kind: 'fs' | 'tests') =>
    request<ApiRequirement>(`/api/requirements/${id}/validate/${kind}`, jp({})),
  deleteRequirement: (id: string) => request<void>(`/api/requirements/${id}`, { method: 'DELETE' }),
  requirementHistory: (id: string) => request<ApiHistory[]>(`/api/requirements/${id}/history`),

  // Документы (Таб 1 и Таб 3)
  getTz: (pid: string) => request<ApiTz | null>(`/api/projects/${pid}/tz`),
  saveTz: (pid: string, body: { title: string; content: string; mentions: Array<{ requirement_id: number; start_offset: number; end_offset: number; highlighted_text: string }> }) =>
    request<ApiTz>(`/api/projects/${pid}/tz`, j(body)),
  uploadTzFile: (pid: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ filename: string; url: string }>(`/api/projects/${pid}/tz/upload`, { method: 'POST', body: fd });
  },
  parseDocument: (docType: 'tz' | 'chtz', file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ html: string; title: string; attachment: { filename: string; url: string } }>(
      `/api/documents/${docType}/upload-and-parse`,
      { method: 'POST', body: fd }
    );
  },
  getChtz: (pid: string) => request<ApiChtz | null>(`/api/projects/${pid}/chtz`),
  saveChtz: (pid: string, body: { title: string; content: string }) =>
    request<ApiChtz>(`/api/projects/${pid}/chtz`, j(body)),

  // Дерево фич (Таб 4)
  getTree: (pid: string) => request<ApiTreeNode[]>(`/api/projects/${pid}/tree`),
  addTreeNode: (pid: string, body: { node_type: 'RELEASE' | 'FEATURE'; name: string; parent_id: number | null; jira_key?: string | null }) =>
    request<ApiTreeNode>(`/api/projects/${pid}/tree`, j(body)),
  renameTreeNode: (id: string, body: { name: string }) => request<ApiTreeNode>(`/api/tree/${id}`, jp(body)),
  moveTreeNode: (id: string, body: { parent_id: number | null; order_num: number }) =>
    request<ApiTreeNode>(`/api/tree/${id}/move`, j(body)),
  deleteTreeNode: (id: string) => request<void>(`/api/tree/${id}`, { method: 'DELETE' }),

  // Фиче-страницы
  getFeatures: (pid: string) => request<ApiFeature[]>(`/api/projects/${pid}/features`),
  saveFeature: (nodeId: string, body: { title: string; content: string; link_jira: string; link_test_cases: string }) =>
    request<ApiFeature>(`/api/tree/${nodeId}/feature`, j(body)),
  linkRequirement: (fid: string, rid: string) =>
    request<{ feature_id: number; requirement_id: number }>(`/api/features/${fid}/requirements/${rid}`, j({})),
  unlinkRequirement: (fid: string, rid: string) =>
    request<void>(`/api/features/${fid}/requirements/${rid}`, { method: 'DELETE' }),
  uploadMockup: (fid: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ id: number; filename: string; url: string }>(`/api/features/${fid}/mockups`, { method: 'POST', body: fd });
  },
  deleteMockup: (id: string) => request<void>(`/api/mockups/${id}`, { method: 'DELETE' }),
};
