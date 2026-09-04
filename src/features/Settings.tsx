// ============================================================
// Настройки: интеграции (Jira / Confluence), управление данными
// (бэкап, импорт, сброс) и архитектурная справка
// ============================================================

import {
  Database, Download, Loader2, RefreshCw, RotateCcw, Save, Server, Settings as SettingsIcon, ShieldCheck, Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge, Button, Dialog, Field, Input, PageHeader, Panel, Reveal, toast } from '../components/ui';
import { fmtDateTime } from '../domain/lifecycle';
import type { AppState } from '../domain/types';
import { syncJiraIssues } from '../services/integrations';
import { replaceState, resetDemo, setJiraIssues, updateSettings, useApp } from '../services/db';

const REST_MAP = [
  { m: 'GET', p: '/api/requirements', d: 'Список требований (матрица, дерево)' },
  { m: 'POST', p: '/api/requirements', d: 'Создание требования (из журнала NR)' },
  { m: 'PUT', p: '/api/requirements/{id}', d: 'Сохранение требования' },
  { m: 'POST', p: '/api/features/{id}/versions', d: 'Новая версия фиче-страницы' },
  { m: 'GET', p: '/api/notices', d: 'Уведомления команды (синхронизация)' },
  { m: 'POST', p: '/api/new-requirements', d: 'Журнал новых требований' },
  { m: 'POST', p: '/api/integrations/jira/sync', d: 'Синхронизация статусов Jira' },
  { m: 'GET', p: '/api/integrations/confluence/page/{id}', d: 'Проверка страницы Confluence' },
];

export function SettingsPage() {
  const state = useApp();
  const s = state.settings;
  const [draft, setDraft] = useState({ ...s });
  const [syncing, setSyncing] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onSave = () => {
    updateSettings(draft);
    toast('Настройки сохранены (data/config.json в целевой архитектуре)', 'ok');
  };

  const onSync = async () => {
    setSyncing(true);
    try {
      const keys = [...new Set(state.requirements.map((r) => r.jiraKey).filter(Boolean))];
      const issues = await syncJiraIssues(keys);
      setJiraIssues(issues);
      toast(`Jira: синхронизировано ${issues.length} задач (${s.jiraUrl})`, 'ok');
    } finally {
      setSyncing(false);
    }
  };

  const onExportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rms-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Резервная копия выгружена (вся база требований)', 'ok');
  };

  const onImportBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as AppState;
      if (!parsed || typeof parsed.version !== 'number' || !Array.isArray(parsed.requirements)) {
        throw new Error('bad shape');
      }
      replaceState(parsed);
      toast(`База импортирована: ${parsed.requirements.length} требований`, 'ok');
    } catch {
      toast('Файл не похож на резервную копию RMS — импорт отменён', 'err');
    }
  };

  return (
    <div>
      <PageHeader
        title="Настройки"
        sub="Интеграции, управление данными и архитектурный контракт слоя хранения."
      />

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Интеграции */}
        <Reveal>
          <Panel icon={<Server size={16} />} title="Jira и Confluence" sub="HTTP Basic Auth; в целевой архитектуре запросы проксирует FastAPI (verify=False)" pad={false}>
            <div className="flex flex-col gap-3.5 p-5">
              <Field label="URL Jira Server">
                <Input className="font-mono text-[12.5px]" value={draft.jiraUrl} onChange={(e) => setDraft({ ...draft, jiraUrl: e.target.value })} />
              </Field>
              <Field label="URL Confluence Server">
                <Input className="font-mono text-[12.5px]" value={draft.confUrl} onChange={(e) => setDraft({ ...draft, confUrl: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Логин">
                  <Input value={draft.login} placeholder="ivanov" onChange={(e) => setDraft({ ...draft, login: e.target.value })} />
                </Field>
                <Field label="Пароль">
                  <Input type="password" value={draft.password} placeholder="••••••••" onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
                </Field>
              </div>
              <Field label="Ключ проекта Jira">
                <Input className="w-[140px] font-mono" value={draft.projectKey} onChange={(e) => setDraft({ ...draft, projectKey: e.target.value.toUpperCase() })} />
              </Field>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line/70 bg-bg2/40 px-4 py-3">
                <div>
                  <p className="text-[12.5px] font-semibold text-ink">Демо-режим интеграций</p>
                  <p className="text-[11.5px] text-faint">Эмуляция ответов Jira/Confluence (нужна, пока нет прокси)</p>
                </div>
                <label className="flex cursor-pointer items-center">
                  <input type="checkbox" className="peer sr-only" checked={draft.demoMode} onChange={(e) => setDraft({ ...draft, demoMode: e.target.checked })} />
                  <span className="relative h-6 w-11 rounded-full bg-bg3 transition-colors peer-checked:bg-teal/70 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-ink after:transition-transform peer-checked:after:translate-x-5" />
                </label>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Button variant="primary" onClick={onSave}>
                  <Save size={15} />
                  Сохранить настройки
                </Button>
                <div className="flex items-center gap-2">
                  <Button onClick={onSync} disabled={syncing}>
                    {syncing ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                    Синхронизировать Jira
                  </Button>
                </div>
              </div>
              <p className="text-[11.5px] text-faint">
                Последняя синхронизация: <span className="font-mono text-dim">{s.lastJiraSync ? fmtDateTime(s.lastJiraSync) : 'ещё не было'}</span>
              </p>
            </div>
          </Panel>
        </Reveal>

        <div className="flex flex-col gap-5">
          {/* Данные */}
          <Reveal delay={70}>
            <Panel icon={<Database size={16} />} title="Данные" sub="Сейчас: localStorage. Целевая архитектура: SQLite (локально) → PostgreSQL (опционально)" pad={false}>
              <div className="flex flex-col gap-3 p-5">
                <div className="grid grid-cols-3 gap-2.5">
                  <Button onClick={onExportBackup}><Download size={14} />Бэкап</Button>
                  <Button onClick={() => fileRef.current?.click()}><Upload size={14} />Импорт</Button>
                  <Button variant="danger" onClick={() => setResetOpen(true)}><RotateCcw size={14} />Сброс</Button>
                </div>
                <input ref={fileRef} type="file" accept="application/json" className="hidden"
                  onChange={(e) => { onImportBackup(e.target.files?.[0]); e.target.value = ''; }} />
                <div className="grid grid-cols-3 gap-2.5 rounded-lg border border-line/70 bg-bg2/40 px-4 py-3 text-center">
                  {[
                    { v: state.requirements.length, l: 'требований' },
                    { v: state.features.length, l: 'фиче-страниц' },
                    { v: state.testCases.length, l: 'тест-кейсов' },
                  ].map((x) => (
                    <div key={x.l}>
                      <p className="font-display text-[18px] font-bold text-teal">{x.v}</p>
                      <p className="text-[10.5px] uppercase tracking-[0.1em] text-faint">{x.l}</p>
                    </div>
                  ))}
                </div>
                <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-faint">
                  <ShieldCheck size={13} className="mt-0.5 shrink-0 text-teal" />
                  Бэкап — полный JSON базы. Точка переезда на серверное хранение — один модуль <span className="font-mono text-dim">services/db.ts</span>: действия заменяются на REST-вызовы, интерфейс не меняется.
                </p>
              </div>
            </Panel>
          </Reveal>

          {/* Архитектурный контракт */}
          <Reveal delay={140}>
            <Panel icon={<SettingsIcon size={16} />} title="Контракт будущего API (FastAPI)" sub="Слой данных уже изолирован — UI не заметит переезда" pad={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-left">
                  <thead>
                    <tr className="bg-bg2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">
                      <th className="px-5 py-2">Метод</th>
                      <th className="px-3 py-2">Эндпоинт</th>
                      <th className="px-3 py-2 pr-5">Назначение</th>
                    </tr>
                  </thead>
                  <tbody>
                    {REST_MAP.map((r) => (
                      <tr key={r.p + r.m} className="mx-row border-t border-line/50">
                        <td className="px-5 py-2">
                          <Badge tone={r.m === 'GET' ? 'sky' : r.m === 'POST' ? 'grass' : 'amber'}>{r.m}</Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11.5px] text-teal">{r.p}</td>
                        <td className="px-3 py-2 pr-5 text-[12px] text-dim">{r.d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </Reveal>
        </div>
      </div>

      {/* Подтверждение сброса */}
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} title="Сбросить к демо-данным?" width={420}>
        <p className="text-[13px] leading-relaxed text-dim">
          Текущая база (<span className="font-mono text-ink">{state.requirements.length}</span> требований,
          {' '}журнал, версии и уведомления) будет заменена демонстрационным набором.
          Рекомендуется сначала выгрузить бэкап.
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button onClick={() => setResetOpen(false)}>Отмена</Button>
          <Button variant="danger" onClick={() => { resetDemo(); setResetOpen(false); toast('База сброшена к демо-данным', 'warn'); }}>
            <RotateCcw size={14} />
            Сбросить
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
