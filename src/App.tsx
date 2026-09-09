// ============================================================
// RMS · Requirements Tracker — корневой компонент.
// HashRouter (готов к упаковке в Tauri/Electron), сайдбар с
// мультипроектностью и настройками, 6 табов.
// При старте автоматически определяется источник данных:
// backend (FastAPI через прокси /api) или демо-хранилище.
// ============================================================

import { motion } from 'framer-motion';
import { Loader2, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { ToastHost } from './components/ui';
import { ChtzPage } from './features/ChtzPage';
import { FeaturesPage } from './features/FeaturesPage';
import { MatrixPage } from './features/MatrixPage';
import { StubPage } from './features/StubPage';
import { TzPage } from './features/TzPage';
import { initStore } from './services/db';

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
        <Route path="/" element={<Navigate to="/matrix" replace />} />
        <Route path="/tz" element={<TzPage />} />
        <Route path="/matrix" element={<MatrixPage />} />
        <Route path="/chtz" element={<ChtzPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/monitor" element={<StubPage path="/monitor" />} />
        <Route path="/coverage" element={<StubPage path="/coverage" />} />
        <Route path="*" element={<Navigate to="/matrix" replace />} />
      </Routes>
    </motion.div>
  );
}

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-xl border border-amber/40 bg-amber/10 text-amber shadow-[0_0_40px_rgba(245,168,62,0.25)]">
          <Zap size={26} />
        </span>
        <div className="flex items-center gap-2 text-[13px] font-semibold text-dim">
          <Loader2 size={15} className="spin text-teal" />
          Подключение к источнику данных…
        </div>
        <p className="max-w-[340px] text-center text-[11.5px] leading-relaxed text-faint">
          Проверяем FastAPI на :8000 (прокси /api). Если backend не запущен — приложение
          откроется в демо-режиме с локальной базой.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void initStore().finally(() => setReady(true));
  }, []);

  if (!ready) return <Splash />;

  return (
    <HashRouter>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 pb-10 pt-16 lg:px-8 lg:pt-8">
          <div className="mx-auto max-w-[1280px]">
            <AnimatedRoutes />
          </div>
        </main>
      </div>
      <ToastHost />
    </HashRouter>
  );
}
