// ============================================================
// RMS — локальная система управления требованиями.
// Оболочка: HashRouter (готов к упаковке в Tauri/Electron),
// сайдбар с навигацией, анимированные переходы между страницами.
// ============================================================

import { motion } from 'framer-motion';
import {
  BookOpen, Inbox, LayoutDashboard, Network, Settings as SettingsIcon, Table2, Zap,
} from 'lucide-react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Badge, ProgressBar, ToastHost } from './components/ui';
import { computeCoverage } from './domain/lifecycle';
import { Dashboard } from './features/Dashboard';
import { FeaturesPage } from './features/FeaturesPage';
import { Matrix } from './features/Matrix';
import { NewReqs } from './features/NewReqs';
import { SettingsPage } from './features/Settings';
import { TreePage } from './features/TreePage';
import { useApp } from './services/db';

const NAV: Array<{ group: string; items: Array<{ to: string; label: string; icon: typeof Table2; end?: boolean }> }> = [
  {
    group: 'Аналитика',
    items: [{ to: '/', label: 'Обзор', icon: LayoutDashboard, end: true }],
  },
  {
    group: 'Требования',
    items: [
      { to: '/matrix', label: 'Матрица', icon: Table2 },
      { to: '/tree', label: 'Дерево ТЗ', icon: Network },
    ],
  },
  {
    group: 'Документация',
    items: [{ to: '/features', label: 'Фиче-страницы', icon: BookOpen }],
  },
  {
    group: 'Управление',
    items: [
      { to: '/new', label: 'Новые требования', icon: Inbox },
      { to: '/settings', label: 'Настройки', icon: SettingsIcon },
    ],
  },
];

function Sidebar() {
  const state = useApp();
  const cov = computeCoverage(state);
  const donePct = cov.total ? Math.round((cov.done / cov.total) * 100) : 0;

  return (
    <aside className="sticky top-0 flex h-screen w-[64px] shrink-0 flex-col border-r border-line bg-bg1/80 backdrop-blur lg:w-[232px]">
      {/* Логотип */}
      <div className="flex items-center gap-3 border-b border-line/70 px-3.5 py-4 lg:px-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber/40 bg-amber/10 text-amber shadow-[0_0_22px_rgba(245,168,62,0.18)]">
          <Zap size={18} />
        </span>
        <div className="hidden min-w-0 lg:block">
          <p className="font-display text-[13.5px] font-bold tracking-wide text-ink">
            RMS<span className="text-teal">·</span>ТРЕБОВАНИЯ
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-faint">трассировка · контроль</p>
        </div>
      </div>

      {/* Навигация */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-4 lg:px-3.5">
        {NAV.map((g) => (
          <div key={g.group} className="mb-5">
            <p className="mb-1.5 hidden px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint/70 lg:block">
              {g.group}
            </p>
            <div className="flex flex-col gap-0.5">
              {g.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    title={item.label}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-all ${
                        isActive ? 'bg-teal/[0.09] text-teal' : 'text-faint hover:bg-bg2/70 hover:text-dim'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-teal transition-all ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                        <Icon size={16} className="shrink-0 transition-transform group-hover:scale-110" />
                        <span className="hidden truncate lg:block">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Мини-метрика */}
      <div className="border-t border-line/70 px-3.5 py-4 lg:px-5">
        <div className="hidden lg:block">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-faint">Реализовано</span>
            <span className="font-mono font-bold text-grass">{donePct}%</span>
          </div>
          <ProgressBar value={donePct} tone="grass" />
          <p className="mt-2 font-mono text-[10.5px] text-faint">{cov.done}/{cov.total} требований</p>
        </div>
        <div className="hidden justify-center lg:flex">
          <Badge tone="teal">ЛОКАЛЬНАЯ БД</Badge>
        </div>
      </div>
    </aside>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 0.9, 0.3, 1] }}
    >
      <Routes location={location}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/matrix" element={<Matrix />} />
        <Route path="/tree" element={<TreePage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/features/:id" element={<FeaturesPage />} />
        <Route path="/new" element={<NewReqs />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </motion.div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-[1240px]">
            <AnimatedRoutes />
          </div>
        </main>
      </div>
      <ToastHost />
    </HashRouter>
  );
}
