// ============================================================
// Боковая панель: активный проект (мультипроектность), навигация
// по 6 табам, настройки интеграций Jira/Confluence, индикаторы
// подключения, кнопка «💾 Сохранить настройки».
// ============================================================

import { AnimatePresence, motion } from 'framer-motion';
import {
  Check, FileText, FolderKanban, GitBranch, KeyRound, Loader2, Plug, Plus, Save,
  Table2, X, Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { addProject, setActiveProject, updateProject, updateSettings, useApp } from '../services/db';
import { pingIntegration, type ConnStatus } from '../services/integrations';
import { Badge, Button, Dialog, Dot, Field, Input, toast, type Tone } from './ui';

/** Табы продукта (в порядке спецификации) */
export const TABS = [
  { to: '/tz', num: 1, label: 'Исходное ТЗ', icon: FileText, iter: 2 },
  { to: '/matrix', num: 2, label: 'Матрица требований', icon: Table2, iter: 1 },
  { to: '/chtz', num: 3, label: 'ЧТЗ', icon: FileText, iter: 2 },
  { to: '/features', num: 4, label: 'Фиче-страницы', icon: FolderKanban, iter: 2 },
  { to: '/monitor', num: 5, label: 'Проверка изменений', icon: GitBranch, iter: 3 },
  { to: '/coverage', num: 6, label: 'Покрытие требований', icon: Zap, iter: 3 },
];

const connTone: Record<ConnStatus, { tone: Tone; label: string }> = {
  checking: { tone: 'amber', label: 'проверка…' },
  demo: { tone: 'teal', label: 'демо-режим' },
  ok: { tone: 'grass', label: 'подключено' },
  error: { tone: 'coral', label: 'нет связи' },
  nocreds: { tone: 'dim', label: 'нет кредов' },
};

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-faint/80">{children}</p>
      {right}
    </div>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const state = useApp();
  const active = state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0];

  const [settingsDraft, setSettingsDraft] = useState({ ...state.settings, projectKey: active?.jiraKey ?? '' });
  const [conn, setConn] = useState<{ jira: ConnStatus; conf: ConnStatus }>({ jira: 'demo', conf: 'demo' });
  const [checking, setChecking] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const [npName, setNpName] = useState('');
  const [npKey, setNpKey] = useState('');

  // Индикаторы подключения — при монтировании и по кнопке
  const check = async () => {
    setChecking(true);
    setConn({ jira: 'checking', conf: 'checking' });
    const creds = !!(settingsDraft.login && settingsDraft.password);
    const [jira, conf] = await Promise.all([
      pingIntegration(settingsDraft.jiraUrl, creds, settingsDraft.demoMode),
      pingIntegration(settingsDraft.confUrl, creds, settingsDraft.demoMode),
    ]);
    setConn({ jira, conf });
    setChecking(false);
  };

  useEffect(() => { check(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [state.settings.demoMode, state.activeProjectId]);

  const onSave = () => {
    updateSettings({
      jiraUrl: settingsDraft.jiraUrl, confUrl: settingsDraft.confUrl,
      login: settingsDraft.login, password: settingsDraft.password, demoMode: settingsDraft.demoMode,
    });
    if (active && settingsDraft.projectKey.trim() && settingsDraft.projectKey.toUpperCase() !== active.jiraKey) {
      updateProject(active.id, { jiraKey: settingsDraft.projectKey.trim() });
    }
    toast('Настройки сохранены (в целевой архитектуре — data/config.json)', 'ok');
    check();
  };

  const onAddProject = () => {
    const name = npName.trim();
    const key = npKey.trim().toUpperCase();
    if (!name) { toast('Укажите название проекта', 'err'); return; }
    if (!key || !/^[A-ZА-Я0-9]{2,10}$/.test(key)) { toast('Ключ Jira: 2–10 латинских букв/цифр, например LC', 'err'); return; }
    if (state.projects.some((p) => p.jiraKey === key)) { toast(`Проект с ключом ${key} уже существует`, 'err'); return; }
    const p = addProject(name, key);
    setNewProject(false); setNpName(''); setNpKey('');
    setSettingsDraft((d) => ({ ...d, projectKey: p.jiraKey }));
    toast(`Проект «${p.name}» создан и выбран активным`, 'ok');
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Логотип */}
      <div className="flex items-center gap-3 border-b border-line/70 px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber/40 bg-amber/10 text-amber shadow-[0_0_22px_rgba(245,168,62,0.18)]">
          <Zap size={18} />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[13px] font-bold tracking-wide text-ink">
            REQUIREMENTS<span className="text-teal">·</span>TRACKER
          </p>
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-faint">Трассировка требований</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 px-3.5 py-4">
        {/* Проекты */}
        <section>
          <SectionTitle
            right={
              <button
                onClick={() => setNewProject(true)}
                title="Добавить новый проект"
                className="flex cursor-pointer items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[10.5px] font-semibold text-teal transition-all hover:border-teal/50 hover:bg-teal/10"
              >
                <Plus size={11} /> проект
              </button>
            }
          >
            Активный проект
          </SectionTitle>
          <div className="rounded-xl border border-line bg-bg2/50 p-3">
            <select
              className="w-full cursor-pointer rounded-lg border border-line bg-bg1 px-2.5 py-2 text-[13px] font-semibold text-ink outline-none transition-colors focus:border-teal/60"
              value={state.activeProjectId}
              onChange={(e) => {
                setActiveProject(e.target.value);
                const p = state.projects.find((x) => x.id === e.target.value);
                if (p) setSettingsDraft((d) => ({ ...d, projectKey: p.jiraKey }));
              }}
            >
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-faint">Ключ Jira</span>
              <Badge tone="amber" className="font-mono">{active?.jiraKey}</Badge>
            </div>
          </div>
        </section>

        {/* Навигация по табам */}
        <section>
          <SectionTitle>Табы</SectionTitle>
          <nav className="flex flex-col gap-0.5">
            {TABS.map((t) => {
              const Icon = t.icon;
              const ready = t.iter === 1;
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold transition-all ${
                      isActive ? 'bg-teal/[0.09] text-teal' : 'text-faint hover:bg-bg2/70 hover:text-dim'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-teal transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border font-mono text-[10px] font-bold ${
                        isActive ? 'border-teal/50 text-teal' : ready ? 'border-line2 text-dim' : 'border-line text-faint'
                      }`}>
                        {t.num}
                      </span>
                      <span className="truncate">{t.label}</span>
                      {!ready && (
                        <span className="ml-auto rounded border border-line px-1 py-px text-[9px] font-bold uppercase tracking-wide text-faint/70">
                          ит.{t.iter}
                        </span>
                      )}
                      <Icon size={14} className={`shrink-0 transition-transform group-hover:scale-110 ${ready ? '' : 'opacity-40'}`} />
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </section>

        {/* Интеграции */}
        <section>
          <SectionTitle
            right={
              <button onClick={check} className="cursor-pointer text-faint transition-colors hover:text-teal" title="Проверить подключение">
                {checking ? <Loader2 size={13} className="spin" /> : <Plug size={13} />}
              </button>
            }
          >
            Интеграции
          </SectionTitle>
          <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-bg2/50 p-3">
            <Field label="URL Jira">
              <Input className="px-2.5 py-1.5 font-mono text-[11.5px]" value={settingsDraft.jiraUrl} onChange={(e) => setSettingsDraft({ ...settingsDraft, jiraUrl: e.target.value })} />
            </Field>
            <Field label="URL Confluence">
              <Input className="px-2.5 py-1.5 font-mono text-[11.5px]" value={settingsDraft.confUrl} onChange={(e) => setSettingsDraft({ ...settingsDraft, confUrl: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Логин">
                <Input className="px-2.5 py-1.5 text-[12px]" placeholder="ivanov" value={settingsDraft.login} onChange={(e) => setSettingsDraft({ ...settingsDraft, login: e.target.value })} />
              </Field>
              <Field label="Пароль">
                <Input type="password" className="px-2.5 py-1.5 text-[12px]" placeholder="••••" value={settingsDraft.password} onChange={(e) => setSettingsDraft({ ...settingsDraft, password: e.target.value })} />
              </Field>
            </div>
            <Field label="Ключ проекта">
              <Input className="px-2.5 py-1.5 font-mono text-[12px] uppercase" value={settingsDraft.projectKey} onChange={(e) => setSettingsDraft({ ...settingsDraft, projectKey: e.target.value.toUpperCase() })} />
            </Field>

            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-line/70 bg-bg1/60 px-2.5 py-2">
              <span className="text-[11.5px] font-semibold text-dim">Демо-режим</span>
              <input
                type="checkbox" className="peer sr-only" checked={settingsDraft.demoMode}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, demoMode: e.target.checked })}
              />
              <span className="relative h-5 w-9 shrink-0 rounded-full bg-bg3 transition-colors peer-checked:bg-teal/70 after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-ink after:transition-transform peer-checked:after:translate-x-4" />
            </label>

            {/* Индикаторы подключения */}
            <div className="flex flex-col gap-1.5 rounded-lg border border-line/70 bg-bg1/60 px-2.5 py-2">
              {([['Jira', conn.jira], ['Confluence', conn.conf]] as const).map(([name, st]) => (
                <div key={name} className="flex items-center gap-2">
                  <Dot tone={connTone[st].tone} pulse={st === 'checking'} />
                  <span className="text-[11.5px] font-semibold text-dim">{name}</span>
                  <span className="ml-auto text-[10.5px] text-faint">{connTone[st].label}</span>
                </div>
              ))}
            </div>

            <Button size="sm" variant="primary" className="w-full" onClick={onSave}>
              <Save size={13} />
              Сохранить настройки
            </Button>
          </div>
        </section>
      </div>

      {/* Низ: статус */}
      <div className="border-t border-line/70 px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">
            <span className={`h-1.5 w-1.5 rounded-full ${state.settings.demoMode ? 'bg-teal pulse-dot text-teal' : 'bg-grass'}`} />
            {state.settings.demoMode ? 'Демо-база' : 'SQLite · FastAPI'}
          </span>
          <span className="font-mono text-[10px] text-faint">итерация 1</span>
        </div>
      </div>

      {/* Диалог нового проекта */}
      <Dialog open={newProject} onClose={() => setNewProject(false)} title="➕ Новый проект" width={400}>
        <div className="flex flex-col gap-3.5">
          <Field label="Название проекта">
            <Input autoFocus placeholder="Личный кабинет абитуриента" value={npName} onChange={(e) => setNpName(e.target.value)} />
          </Field>
          <Field label="Ключ Jira (латиница)">
            <div className="flex items-center gap-2">
              <KeyRound size={15} className="text-faint" />
              <Input className="font-mono uppercase" placeholder="LC" value={npKey} onChange={(e) => setNpKey(e.target.value.toUpperCase())} />
            </div>
          </Field>
          <p className="text-[11.5px] leading-relaxed text-faint">
            Ключ используется в автогенерации ID требований: <span className="font-mono text-teal">REQ-{'{KEY}'}-{'{TYPE}'}-{'{NNNN}'}</span>
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setNewProject(false)}>Отмена</Button>
            <Button variant="primary" onClick={onAddProject}><Check size={14} />Создать</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/** Десктоп-сайдбар + мобильная шторка */
export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[276px] shrink-0 border-r border-line bg-bg1/80 backdrop-blur lg:block">
        <SidebarContent />
      </aside>

      {/* Мобильная шапка */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-line bg-bg0/85 px-4 py-3 backdrop-blur lg:hidden">
        <span className="font-display text-[13px] font-bold text-ink">REQ<span className="text-teal">·</span>TRACKER</span>
        <button onClick={() => setMobileOpen(true)} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-dim">
          Меню
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-bg0/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="absolute inset-y-0 left-0 h-full w-[300px] border-r border-line2 bg-bg1"
            >
              <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 z-10 cursor-pointer text-faint hover:text-ink">
                <X size={18} />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
