// ============================================================
// RMS · Requirements Tracker — корневой компонент.
// HashRouter (готов к упаковке в Tauri/Electron), сайдбар с
// мультипроектностью и настройками, 6 табов (Итерация 1: Таб 2).
// ============================================================

import { motion } from 'framer-motion';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { ToastHost } from './components/ui';
import { MatrixPage } from './features/MatrixPage';
import { StubPage } from './features/StubPage';

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
        <Route path="/matrix" element={<MatrixPage />} />
        <Route path="/tz" element={<StubPage path="/tz" />} />
        <Route path="/chtz" element={<StubPage path="/chtz" />} />
        <Route path="/features" element={<StubPage path="/features" />} />
        <Route path="/monitor" element={<StubPage path="/monitor" />} />
        <Route path="/coverage" element={<StubPage path="/coverage" />} />
        <Route path="*" element={<Navigate to="/matrix" replace />} />
      </Routes>
    </motion.div>
  );
}

export default function App() {
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
