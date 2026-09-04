// ============================================================
// Таб 2 · Матрица атомарных требований (Итерация 1):
// CRUD, автогенерация ID, сортировка, фильтры по типу/релизу,
// вычисляемые статусы актуальности (🟢/⚠/🔴), история, импорт/экспорт.
// ============================================================

import {
  ArrowDown, ArrowUp, ArrowUpDown, CheckCheck, Download, History, Pencil, Plus,
  Search, Table2, Trash2, Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Dialog, EmptyState, PageHeader, Panel, Reveal, Select, Stat, toast, type Tone } from '../components/ui';
import {
  REQ_TYPE_LABEL, REQ_TYPE_TONE, VALIDITY_META, fmtDate, fsStatus, testsStatus,
} from '../domain/logic';
import type { ReqType, Requirement, Validity } from '../domain/types';
import { exportMatrix } from '../lib/excel';
import { deleteRequirement, useApp, validateRequirement } from '../services/db';
import { HistoryDialog } from './HistoryDialog';
import { ImportDialog } from './ImportDialog';
import { RequirementDrawer } from './RequirementDrawer';

type SortKey = 'reqKey' | 'reqType' | 'title' | 'release' | 'fs' | 'tests';

const VALIDITY_ORDER: Record<Validity, number> = { none: 0, stale: 1, ok: 2 };

/** Наихудший из двух статусов — определяет цвет строки */
function worstStatus(r: Requirement): Validity {
  const a = fsStatus(r);
  const b = testsStatus(r);
  return VALIDITY_ORDER[a] <= VALIDITY_ORDER[b] ? a : b;
}

const rowCls: Record<Validity, string> = {
  none: 'border-l-coral bg-coral/[0.045]',
  stale: 'border-l-amber bg-amber/[0.04]',
  ok: 'border-l-grass bg-grass/[0.03]',
};

function ValidityChip({ v }: { v: Validity }) {
  const meta = VALIDITY_META[v];
  return (
    <Badge tone={meta.tone as Tone}>
      <span className={`h-1.5 w-1.5 rounded-full ${v === 'ok' ? 'bg-grass' : v === 'stale' ? 'bg-amber' : 'bg-coral'}`} />
      {meta.label}
    </Badge>
  );
}

const COLUMNS: Array<{ key: SortKey | null; label: string; sortable?: boolean }> = [
  { key: 'reqKey', label: 'ID', sortable: true },
  { key: 'reqType', label: 'Тип', sortable: true },
  { key: 'title', label: 'Название', sortable: true },
  { key: null, label: 'Описание' },
  { key: null, label: 'ТЗ' },
  { key: null, label: 'ЧТЗ' },
  { key: 'release', label: 'Релиз', sortable: true },
  { key: null, label: 'Примечание' },
  { key: null, label: 'Зависимости' },
  { key: 'fs', label: 'Статус ФС', sortable: true },
  { key: 'tests', label: 'Статус тестов', sortable: true },
  { key: null, label: '' },
];

export function MatrixPage() {
  const state = useApp();
  const project = state.projects.find((p) => p.id === state.activeProjectId);

  const [query, setQuery] = useState('');
  const [fType, setFType] = useState('all');
  const [fRelease, setFRelease] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'reqKey', dir: 1 });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editReq, setEditReq] = useState<Requirement | null>(null);
  const [historyReq, setHistoryReq] = useState<Requirement | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteReq, setDeleteReq] = useState<Requirement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep-link из Таба 1 и Таба 3: /matrix?req=REQ-LC-FUNC-0001 → открыть карточку требования
  useEffect(() => {
    const key = searchParams.get('req');
    if (!key) return;
    const found = state.requirements.find((r) => r.reqKey.toLowerCase() === key.toLowerCase());
    if (found) { setEditReq(found); setDrawerOpen(true); }
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, state.requirements]);

  const rows = useMemo(() => state.requirements.filter((r) => r.projectId === state.activeProjectId), [state]);

  const releases = useMemo(() => [...new Set(rows.map((r) => r.release).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.reqKey} ${r.title} ${r.description} ${r.dependencies} ${r.notes}`.toLowerCase().includes(q)) return false;
      if (fType !== 'all' && r.reqType !== fType) return false;
      if (fRelease !== 'all' && r.release !== fRelease) return false;
      if (fStatus !== 'all' && worstStatus(r) !== fStatus) return false;
      return true;
    });
  }, [rows, query, fType, fRelease, fStatus]);

  const sorted = useMemo(() => {
    const val = (r: Requirement): string | number => {
      switch (sort.key) {
        case 'reqKey': return r.reqKey;
        case 'reqType': return r.reqType;
        case 'title': return r.title.toLowerCase();
        case 'release': return r.release;
        case 'fs': return VALIDITY_ORDER[fsStatus(r)];
        case 'tests': return VALIDITY_ORDER[testsStatus(r)];
      }
    };
    return [...filtered].sort((a, b) => {
      const av = val(a); const bv = val(b);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ru', { numeric: true });
      return cmp * sort.dir;
    });
  }, [filtered, sort]);

  const stats = useMemo(() => ({
    total: rows.length,
    bus: rows.filter((r) => r.reqType === 'BUSINESS').length,
    func: rows.filter((r) => r.reqType === 'FUNCTIONAL').length,
    nfunc: rows.filter((r) => r.reqType === 'NON_FUNCTIONAL').length,
    ok: rows.filter((r) => worstStatus(r) === 'ok').length,
    stale: rows.filter((r) => worstStatus(r) === 'stale').length,
    none: rows.filter((r) => worstStatus(r) === 'none').length,
  }), [rows]);

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  };

  const openCreate = () => { setEditReq(null); setDrawerOpen(true); };
  const openEdit = (r: Requirement) => { setEditReq(r); setDrawerOpen(true); };

  return (
    <div>
      <PageHeader
        title="Матрица атомарных требований"
        sub={`Проект «${project?.name ?? '—'}» · ключ ${project?.jiraKey ?? '—'} · ${stats.total} требований в baseline`}
        actions={
          <>
            <Button onClick={() => setImportOpen(true)}><Upload size={14} />Импорт</Button>
            <Button
              onClick={() => { exportMatrix(sorted); toast(`Экспортировано строк: ${sorted.length}`, 'ok'); }}
              disabled={sorted.length === 0}
            >
              <Download size={14} />Экспорт
            </Button>
            <Button variant="primary" onClick={openCreate}><Plus size={15} />Добавить требование</Button>
          </>
        }
      />

      {/* Метрики */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <Stat label="Всего" value={stats.total} tone="teal" icon={<Table2 size={16} />} />
        <Stat label="Бизнес" value={stats.bus} tone="sky" sub="BUS" delay={40} />
        <Stat label="Функциональные" value={stats.func} tone="teal" sub="FUNC" delay={80} />
        <Stat label="Нефункциональные" value={stats.nfunc} tone="amber" sub="NFUNC" delay={120} />
        <Stat label="Актуально" value={stats.ok} tone="grass" sub="🟢 валидировано" delay={160} />
        <Stat label="Требует проверки" value={stats.stale} tone="amber" sub="⚠ изменилось" delay={200} />
        <Stat label="Не создано" value={stats.none} tone="coral" sub="🔴 нет ФС/тестов" delay={240} />
      </div>

      <Reveal className="mt-5">
        <Panel pad={false}>
          {/* Фильтры */}
          <div className="flex flex-wrap items-center gap-2.5 border-b border-line/70 px-5 py-3.5">
            <div className="relative min-w-[220px] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"><Search size={14} /></span>
              <input
                className="w-full rounded-lg border border-line bg-bg2/80 py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-teal/60"
                placeholder="Поиск по ID, названию, описанию…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select className="w-auto" value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="all">Все типы</option>
              {(Object.keys(REQ_TYPE_LABEL) as ReqType[]).map((t) => (
                <option key={t} value={t}>{REQ_TYPE_LABEL[t]}</option>
              ))}
            </Select>
            <Select className="w-auto" value={fRelease} onChange={(e) => setFRelease(e.target.value)}>
              <option value="all">Все релизы</option>
              {releases.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            <Select className="w-auto" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="all">Любой статус</option>
              <option value="ok">🟢 Актуально</option>
              <option value="stale">⚠ Требует проверки</option>
              <option value="none">🔴 Не создано</option>
            </Select>
            <span className="ml-auto font-mono text-[11.5px] text-faint">
              {sorted.length} / {rows.length}
            </span>
          </div>

          {/* Таблица */}
          {sorted.length === 0 ? (
            <EmptyState
              icon={<Table2 size={24} />}
              title={rows.length === 0 ? 'В проекте пока нет требований' : 'Ничего не найдено'}
              sub={rows.length === 0
                ? 'Добавьте первое требование кнопкой сверху или импортируйте таблицу из Excel/CSV.'
                : 'Измените фильтры или поисковый запрос.'}
              action={rows.length === 0 ? (
                <div className="flex gap-2">
                  <Button variant="primary" onClick={openCreate}><Plus size={14} />Добавить</Button>
                  <Button onClick={() => setImportOpen(true)}><Upload size={14} />Импортировать</Button>
                </div>
              ) : undefined}
            />
          ) : (
            <div className="max-h-[600px] overflow-auto">
              <table className="w-full min-w-[1180px] border-collapse text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-bg2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-faint">
                    {COLUMNS.map((c) => (
                      <th key={c.label || 'actions'} className="whitespace-nowrap px-3 py-2.5 first:pl-5 last:pr-5">
                        {c.sortable && c.key ? (
                          <button
                            onClick={() => toggleSort(c.key!)}
                            className={`flex cursor-pointer items-center gap-1 transition-colors hover:text-teal ${sort.key === c.key ? 'text-teal' : ''}`}
                          >
                            {c.label}
                            {sort.key === c.key
                              ? (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
                              : <ArrowUpDown size={11} className="opacity-40" />}
                          </button>
                        ) : c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => {
                    const worst = worstStatus(r);
                    const fs = fsStatus(r);
                    const ts = testsStatus(r);
                    return (
                      <tr
                        key={r.id}
                        className={`mx-row row-in cursor-pointer border-b border-line/50 border-l-[3px] align-top ${rowCls[worst]}`}
                        style={{ animationDelay: `${Math.min(i * 25, 400)}ms` }}
                        onClick={() => openEdit(r)}
                      >
                        <td className="whitespace-nowrap px-3 py-3 pl-5 font-mono text-[11.5px] font-bold text-ink">{r.reqKey}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <Badge tone={REQ_TYPE_TONE[r.reqType] as Tone}>{REQ_TYPE_LABEL[r.reqType]}</Badge>
                        </td>
                        <td className="max-w-[220px] px-3 py-3 text-[13px] font-medium leading-snug text-ink">{r.title}</td>
                        <td className="max-w-[200px] px-3 py-3">
                          <p className="line-clamp-2 text-[12px] leading-snug text-faint" title={r.description}>{r.description || '—'}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-[11.5px] text-dim">{r.linkTz || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-[11.5px]">
                          {r.linkChtz ? <span className="text-dim">{r.linkChtz}</span> : <span className="font-semibold text-coral">пробел</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-[11.5px] text-sky">{r.release || '—'}</td>
                        <td className="max-w-[140px] px-3 py-3">
                          <p className="line-clamp-2 text-[11.5px] text-faint" title={r.notes}>{r.notes || '—'}</p>
                        </td>
                        <td className="max-w-[140px] px-3 py-3">
                          <p className="line-clamp-2 font-mono text-[10.5px] text-faint" title={r.dependencies}>{r.dependencies || '—'}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3"><ValidityChip v={fs} /></td>
                        <td className="whitespace-nowrap px-3 py-3"><ValidityChip v={ts} /></td>
                        <td className="whitespace-nowrap px-3 py-3 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5 opacity-60 transition-opacity hover:opacity-100">
                            {fs !== 'ok' && (
                              <button
                                title="Подтвердить актуальность по ФС"
                                onClick={() => { validateRequirement(r.id, 'fs'); toast(`${r.reqKey}: актуальность по ФС подтверждена`, 'ok'); }}
                                className="cursor-pointer rounded p-1.5 text-faint transition-colors hover:bg-grass/10 hover:text-grass"
                              >
                                <CheckCheck size={14} />
                              </button>
                            )}
                            {ts !== 'ok' && (
                              <button
                                title="Подтвердить актуальность по тестам"
                                onClick={() => { validateRequirement(r.id, 'tests'); toast(`${r.reqKey}: актуальность по тестам подтверждена`, 'ok'); }}
                                className="cursor-pointer rounded p-1.5 text-faint transition-colors hover:bg-grass/10 hover:text-grass"
                              >
                                <CheckCheck size={14} />
                              </button>
                            )}
                            <button
                              title="📜 История изменений"
                              onClick={() => setHistoryReq(r)}
                              className="cursor-pointer rounded p-1.5 text-faint transition-colors hover:bg-teal/10 hover:text-teal"
                            >
                              <History size={14} />
                            </button>
                            <button
                              title="Редактировать"
                              onClick={() => openEdit(r)}
                              className="cursor-pointer rounded p-1.5 text-faint transition-colors hover:bg-teal/10 hover:text-teal"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              title="Удалить"
                              onClick={() => setDeleteReq(r)}
                              className="cursor-pointer rounded p-1.5 text-faint transition-colors hover:bg-coral/10 hover:text-coral"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Легенда */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line/70 px-5 py-3 text-[11.5px] text-faint">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-grass" />🟢 Актуально — last_validated ≥ updated_at</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber" />⚠ Требует проверки — требование изменилось</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-coral" />🔴 Не создано — нет ссылки на ФС/тесты</span>
            <span className="ml-auto">Обновлено: {rows.length ? fmtDate([...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0].updatedAt) : '—'}</span>
          </div>
        </Panel>
      </Reveal>

      {/* Модалки */}
      <RequirementDrawer open={drawerOpen} req={editReq} onClose={() => setDrawerOpen(false)} />
      <HistoryDialog req={historyReq} onClose={() => setHistoryReq(null)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />

      <Dialog open={!!deleteReq} onClose={() => setDeleteReq(null)} title="Удалить требование?" width={420}>
        {deleteReq && (
          <>
            <p className="text-[13px] leading-relaxed text-dim">
              <span className="font-mono font-bold text-ink">{deleteReq.reqKey}</span> · «{deleteReq.title}» будет удалено
              вместе с историей изменений. Действие необратимо.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <Button onClick={() => setDeleteReq(null)}>Отмена</Button>
              <Button
                variant="danger"
                onClick={() => {
                  deleteRequirement(deleteReq.id);
                  toast(`${deleteReq.reqKey} удалено`, 'warn');
                  setDeleteReq(null);
                }}
              >
                <Trash2 size={14} />
                Удалить
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
