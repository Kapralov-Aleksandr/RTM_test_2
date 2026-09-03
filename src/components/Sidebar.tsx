// ============================================================
// Боковая панель: настройки подключения, индикаторы связи,
// демо-режим, сброс данных (аналог data/config.json)
// ============================================================

import { useEffect, useState } from 'react';
import type { AppConfig, ConnState, ConnStatus } from '../types';
import { Badge, Button, Dot, Field, Spinner, Switch, inputCls, type Tone } from './ui';
import { IconGear, IconRefresh, IconSave, IconTrash } from './icons';

function connMeta(s: ConnStatus): { label: string; tone: Tone; pulse: boolean } {
  switch (s) {
    case 'checking': return { label: 'Проверка…', tone: 'amber', pulse: true };
    case 'ok': return { label: 'Подключено', tone: 'grass', pulse: false };
    case 'demo': return { label: 'Демо-режим', tone: 'teal', pulse: true };
    case 'error': return { label: 'Нет связи', tone: 'coral', pulse: false };
    case 'nocreds': return { label: 'Нет кредов', tone: 'dim', pulse: false };
    default: return { label: 'Не проверялось', tone: 'dim', pulse: false };
  }
}

function ConnRow({ name, status }: { name: string; status: ConnStatus }) {
  const m = connMeta(status);
  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-bg2/70 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <Dot tone={m.tone} pulse={m.pulse} />
        <span className="text-[13px] font-medium text-ink">{name}</span>
      </div>
      <span className={`text-[11.5px] font-semibold ${m.tone === 'coral' ? 'text-coral' : m.tone === 'grass' ? 'text-grass' : m.tone === 'teal' ? 'text-teal' : m.tone === 'amber' ? 'text-amber' : 'text-faint'}`}>
        {m.label}
      </span>
    </div>
  );
}

export function Sidebar({
  config,
  conn,
  onSave,
  onToggleDemo,
  onCheck,
  onReset,
}: {
  config: AppConfig;
  conn: ConnState;
  onSave: (cfg: AppConfig) => void;
  onToggleDemo: (demo: boolean) => void;
  onCheck: () => void;
  onReset: () => void;
}) {
  // Локальная копия настроек — применяется по кнопке «Сохранить»
  const [form, setForm] = useState<AppConfig>(config);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(config);
  }, [config]);

  const set = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () => {
    setSaving(true);
    // Имитация записи в data/config.json
    setTimeout(() => {
      onSave(form);
      setSaving(false);
    }, 350);
  };

  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 lg:sticky lg:top-[76px] lg:h-[calc(100vh-96px)] lg:w-[300px] lg:overflow-y-auto lg:pr-1">
      {/* Подключение */}
      <div className="rounded-xl border border-line bg-bg1/90 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-teal"><IconGear size={16} /></span>
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.14em] text-dim">Подключение</h3>
          <span className="ml-auto flex gap-1.5">
            {config.demoMode && <Badge tone="teal">DEMO</Badge>}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <ConnRow name="Jira Server" status={conn.jira} />
          <ConnRow name="Confluence" status={conn.conf} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={onCheck}>
            <IconRefresh size={14} />
            Проверить связь
          </Button>
        </div>

        <div className="mt-3 border-t border-line/70 pt-3">
          <Switch
            checked={form.demoMode}
            onChange={(v) => { set('demoMode', v); onToggleDemo(v); }}
            label="Демо-режим (эмуляция API)"
          />
          <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
            Браузер не может обращаться к серверам с самоподписанным SSL напрямую.
            В демо-режиме ответы Jira/Confluence эмулируются; в продакшене подключается
            локальный прокси с <span className="font-mono text-[10.5px] text-dim">verify=False</span>.
          </p>
        </div>
      </div>

      {/* Настройки */}
      <div className="rounded-xl border border-line bg-bg1/90 p-4">
        <h3 className="font-display mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-dim">Параметры</h3>
        <div className="flex flex-col gap-3">
          <Field label="URL Jira">
            <input className={inputCls + ' font-mono text-[12.5px]'} value={form.jiraUrl} onChange={(e) => set('jiraUrl', e.target.value)} placeholder="https://jira.tomskasu.ru" />
          </Field>
          <Field label="URL Confluence">
            <input className={inputCls + ' font-mono text-[12.5px]'} value={form.confUrl} onChange={(e) => set('confUrl', e.target.value)} placeholder="https://confluence.tomskasu.ru/wiki" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Логин">
              <input className={inputCls} value={form.login} onChange={(e) => set('login', e.target.value)} placeholder="ivanov_ii" autoComplete="username" />
            </Field>
            <Field label="Пароль">
              <input className={inputCls} type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••" autoComplete="current-password" />
            </Field>
          </div>
          <Field label="Ключ проекта">
            <input className={inputCls + ' font-mono text-[12.5px]'} value={form.projectKey} onChange={(e) => set('projectKey', e.target.value.toUpperCase())} placeholder="ASU" />
          </Field>
        </div>

        <Button variant="primary" className="mt-4 w-full" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size={15} /> : <IconSave size={15} />}
          Сохранить настройки
        </Button>
        <p className="mt-2 text-center text-[11px] text-faint">Сохраняются в data/config.json</p>
      </div>

      {/* Данные */}
      <div className="rounded-xl border border-line bg-bg1/90 p-4">
        <h3 className="font-display mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-dim">Данные</h3>
        <p className="mb-3 text-[12px] leading-relaxed text-faint">
          Матрица, снапшоты и журналы хранятся локально (аналог папки <span className="font-mono text-[11px] text-dim">data/</span>).
        </p>
        <Button variant="danger" size="sm" className="w-full" onClick={onReset}>
          <IconTrash size={14} />
          Сбросить к демо-данным
        </Button>
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-faint/80">
        Requirements Tracker v1.0 · ТЗ → ЧТЗ → фиче-страницы → ПМИ → Jira
      </p>
    </aside>
  );
}
