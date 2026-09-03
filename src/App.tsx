// ============================================================
// Requirements Tracker — контроль качества проекта
// и трассировка требований: ТЗ → ЧТЗ → фиче-страницы → ПМИ → Jira
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppConfig, ConnState, NewRequirement, Requirement } from './types';
import { DEFAULT_CONFIG, DEMO_MATRIX, DEMO_NEW_REQS } from './data/demo';
import { apiPing } from './lib/mockApi';
import { clearAll, load, save } from './lib/storage';
import { Sidebar } from './components/Sidebar';
import { TraceTab } from './components/TraceTab';
import { ChangeTab } from './components/ChangeTab';
import { CoverageTab } from './components/CoverageTab';
import { NewReqTab } from './components/NewReqTab';
import { Badge, Dot, EmptyState, ToastHost, type ToastItem } from './components/ui';
import {
  IconDiff, IconFunnel, IconGrid, IconLock, IconLogo, IconPlus,
} from './components/icons';

type TabKey = 'matrix' | 'changes' | 'coverage' | 'newreqs';

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: 'matrix', label: 'Матрица трассировки', icon: IconGrid },
  { key: 'changes', label: 'Контроль изменений', icon: IconDiff },
  { key: 'coverage', label: 'Покрытие требований', icon: IconFunnel },
  { key: 'newreqs', label: 'Новые требования', icon: IconPlus },
];

export default function App() {
  // ---------- Состояние ----------
  const [config, setConfig] = useState<AppConfig>(() => load<AppConfig>('config', DEFAULT_CONFIG));
  const [matrix, setMatrixState] = useState<Requirement[]>(
    () => load<Requirement[] | null>('matrix', null) ?? DEMO_MATRIX,
  );
  const [conn, setConn] = useState<ConnState>({ jira: 'idle', conf: 'idle' });
  const [tab, setTab] = useState<TabKey>('matrix');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const toastId = useRef(0);

  // ---------- Тосты ----------
  const notify = useCallback((msg: string, tone: ToastItem['tone'] = 'ok') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  // ---------- Проверка подключения ----------
  const checkConn = useCallback(async (cfg: AppConfig) => {
    setConn({ jira: 'checking', conf: 'checking' });
    const hasCreds = !!(cfg.login && cfg.password);
    const [jira, conf] = await Promise.all([
      apiPing(cfg.jiraUrl, hasCreds, cfg.demoMode),
      apiPing(cfg.confUrl, hasCreds, cfg.demoMode),
    ]);
    setConn({ jira, conf });
  }, []);

  useEffect(() => {
    checkConn(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Действия с настройками и данными ----------
  const saveConfig = (cfg: AppConfig) => {
    setConfig(cfg);
    save('config', cfg);
    notify('Настройки сохранены в data/config.json', 'ok');
    checkConn(cfg);
  };

  const toggleDemo = (demo: boolean) => {
    const cfg = { ...config, demoMode: demo };
    setConfig(cfg);
    save('config', cfg);
    notify(demo ? 'Демо-режим включён: ответы Jira/Confluence эмулируются' : 'Демо-режим выключен: используются реальные серверы', demo ? 'ok' : 'warn');
    checkConn(cfg);
  };

  const resetDemo = () => {
    clearAll();
    setConfig(DEFAULT_CONFIG);
    setMatrixState(DEMO_MATRIX);
    setResetKey((k) => k + 1);
    notify('Данные сброшены к демо-состоянию', 'ok');
    checkConn(DEFAULT_CONFIG);
  };

  const setMatrix = (rows: Requirement[]) => {
    setMatrixState(rows);
    save('matrix', rows);
  };

  // Подключено ли приложение (для гейта вкладок)
  const connected = config.demoMode || (conn.jira === 'ok' && conn.conf === 'ok');
  const newReqCount = load<NewRequirement[] | null>('newReqs', null)?.length ?? DEMO_NEW_REQS.length;

  const tabBadge: Record<TabKey, number | null> = {
    matrix: matrix.length,
    changes: null,
    coverage: null,
    newreqs: newReqCount,
  };

  return (
    <div className="min-h-screen">
      {/* ---------- Шапка ---------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg0/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-3 lg:px-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-amber/40 bg-amber/10 text-amber shadow-[0_0_24px_rgba(245,168,62,0.15)]">
            <IconLogo size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="font-display truncate text-[15px] font-bold tracking-wide text-ink">
              REQUIREMENTS <span className="text-teal">TRACKER</span>
            </h1>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint">
              Трассировка требований · ТЗ → ЧТЗ → ПМИ → Jira
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            {config.demoMode && <Badge tone="teal">ДЕМО-ДАННЫЕ</Badge>}
            <div className="hidden items-center gap-2 rounded-lg border border-line bg-bg1 px-3 py-1.5 sm:flex">
              <Dot tone={conn.jira === 'checking' ? 'amber' : conn.jira === 'demo' ? 'teal' : conn.jira === 'ok' ? 'grass' : conn.jira === 'error' ? 'coral' : 'dim'} pulse={conn.jira === 'checking'} />
              <span className="text-[11.5px] font-semibold text-dim">Jira</span>
              <span className="mx-1 h-3.5 w-px bg-line" />
              <Dot tone={conn.conf === 'checking' ? 'amber' : conn.conf === 'demo' ? 'teal' : conn.conf === 'ok' ? 'grass' : conn.conf === 'error' ? 'coral' : 'dim'} pulse={conn.conf === 'checking'} />
              <span className="text-[11.5px] font-semibold text-dim">Confluence</span>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- Каркас ---------- */}
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-5 lg:flex-row lg:px-6">
        <Sidebar
          config={config}
          conn={conn}
          onSave={saveConfig}
          onToggleDemo={toggleDemo}
          onCheck={() => checkConn(config)}
          onReset={resetDemo}
        />

        <main className="min-w-0 flex-1">
          {/* Вкладки */}
          <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`relative flex shrink-0 cursor-pointer items-center gap-2 px-4 py-3 text-[13px] font-semibold transition-colors ${
                    active ? 'text-amber' : 'text-faint hover:text-dim'
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden md:inline">{t.label}</span>
                  <span className="md:hidden">{t.label.split(' ')[0]}</span>
                  {tabBadge[t.key] !== null && (
                    <span className={`rounded-full border px-1.5 py-px font-mono text-[10.5px] ${active ? 'border-amber/40 bg-amber/10 text-amber' : 'border-line bg-bg2 text-faint'}`}>
                      {tabBadge[t.key]}
                    </span>
                  )}
                  {active && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-amber shadow-[0_0_10px_rgba(245,168,62,0.6)]" />}
                </button>
              );
            })}
          </nav>

          {/* Содержимое вкладки */}
          {!connected ? (
            <div className="tab-enter rounded-xl border border-line bg-bg1/90">
              <EmptyState
                icon={<IconLock size={26} />}
                title="Нет подключения к Jira и Confluence"
                sub={
                  <>
                    Введите логин и пароль в панели слева и нажмите «Проверить связь»,
                    либо включите <span className="font-semibold text-teal">демо-режим</span> —
                    приложение покажет полный функционал на эмулированных данных.
                  </>
                }
              />
            </div>
          ) : (
            <div key={`${tab}-${resetKey}`} className="tab-enter">
              {tab === 'matrix' && <TraceTab matrix={matrix} setMatrix={setMatrix} notify={notify} />}
              {tab === 'changes' && <ChangeTab matrix={matrix} notify={notify} />}
              {tab === 'coverage' && <CoverageTab matrix={matrix} notify={notify} />}
              {tab === 'newreqs' && <NewReqTab matrix={matrix} notify={notify} />}
            </div>
          )}
        </main>
      </div>

      <ToastHost toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}
