// ============================================================
// Вкладка 1 «Матрица трассировки»:
// загрузка Excel, проверки через Confluence/Jira API,
// цветовая подсветка покрытия, статистика, экспорт
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Requirement } from '../types';
import { apiCheckJira, apiCheckPage, type JiraCheckResult, type PageCheckResult } from '../lib/mockApi';
import { downloadTemplate, exportMatrix, parseMatrixFile } from '../lib/excel';
import { REQ_STATUS_LABEL } from '../data/demo';
import {
  Badge, Button, EmptyState, Panel, Reveal, Spinner, Stat, Switch, inputCls, selectCls,
} from './ui';
import {
  IconAlert, IconCheck, IconDoc, IconDownload, IconGrid, IconJira, IconLink,
  IconRefresh, IconSearch, IconUpload, IconX,
} from './icons';

type ToneKey = 'coral' | 'amber' | 'grass' | 'sky';

/** Правило подсветки строки: красный — нет тест-кейса, жёлтый — нет задачи, зелёный — полное покрытие */
function rowTone(r: Requirement): ToneKey {
  if (!r.testCase) return 'coral';
  if (!r.jiraKey) return 'amber';
  if (r.status === 'done') return 'grass';
  return 'sky';
}

const toneRowCls: Record<ToneKey, string> = {
  coral: 'border-l-coral bg-coral/[0.05]',
  amber: 'border-l-amber bg-amber/[0.04]',
  grass: 'border-l-grass bg-grass/[0.03]',
  sky: 'border-l-sky bg-transparent',
};

interface RowCheck {
  page: 'ok' | 'missing' | 'pending';
  jira: 'ok' | 'missing' | 'none' | 'pending';
  jiraStatus?: string;
}

export function TraceTab({
  matrix,
  setMatrix,
  notify,
}: {
  matrix: Requirement[];
  setMatrix: (rows: Requirement[]) => void;
  notify: (msg: string, tone?: 'ok' | 'warn' | 'err') => void;
}) {
  const [checks, setChecks] = useState<Record<string, RowCheck>>({});
  const [checking, setChecking] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [parsing, setParsing] = useState(false);
  const didRun = useRef(false);

  // ---------- Проверка ссылок через API (Confluence + Jira) ----------
  const runChecks = async (rows: Requirement[]) => {
    if (!rows.length) return;
    setChecking(true);
    const next: Record<string, RowCheck> = {};
    await Promise.all(
      rows.map(async (r) => {
        try {
          const [page, jira] = await Promise.all([
            r.page ? apiCheckPage(r.page) : Promise.resolve({ exists: false } as PageCheckResult),
            r.jiraKey ? apiCheckJira(r.jiraKey) : Promise.resolve({ exists: false } as JiraCheckResult),
          ]);
          next[r.id] = {
            page: r.page ? (page.exists ? 'ok' : 'missing') : 'missing',
            jira: r.jiraKey ? (jira.exists ? 'ok' : 'missing') : 'none',
            jiraStatus: jira.exists ? jira.status : undefined,
          };
        } catch {
          next[r.id] = { page: 'missing', jira: r.jiraKey ? 'missing' : 'none' };
        }
      }),
    );
    setChecks(next);
    setChecking(false);
    const missing = rows.filter(
      (r) => next[r.id] && (next[r.id].page === 'missing' || next[r.id].jira === 'missing'),
    ).length;
    notify(
      missing
        ? `Проверка завершена: ${missing} требов. со ссылками, которые не найдены в Jira/Confluence`
        : 'Проверка завершена: все страницы и задачи найдены',
      missing ? 'warn' : 'ok',
    );
  };

  // Автопроверка при первой загрузке матрицы
  useEffect(() => {
    if (matrix.length && !didRun.current) {
      didRun.current = true;
      runChecks(matrix);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrix]);

  // ---------- Загрузка Excel ----------
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    try {
      const rows = await parseMatrixFile(file);
      setMatrix(rows);
      notify(`Матрица загружена: ${rows.length} требований из «${file.name}»`, 'ok');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Не удалось прочитать файл Excel', 'err');
    } finally {
      setParsing(false);
    }
  };

  // ---------- Статистика покрытия ----------
  const stats = useMemo(() => {
    const total = matrix.length;
    const withTests = matrix.filter((r) => r.testCase).length;
    const withJira = matrix.filter((r) => r.jiraKey).length;
    const done = matrix.filter((r) => r.status === 'done').length;
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
    return { total, withTests, withJira, done, pctTests: pct(withTests), pctJira: pct(withJira), pctDone: pct(done) };
  }, [matrix]);

  // ---------- Фильтрация ----------
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matrix.filter((r) => {
      if (q && !`${r.id} ${r.text} ${r.page} ${r.jiraKey} ${r.testCase} ${r.tz}`.toLowerCase().includes(q)) return false;
      const c = checks[r.id];
      const linkMissing = !!c && (c.page === 'missing' || c.jira === 'missing');
      const tone = rowTone(r);
      if (onlyProblems && tone !== 'coral' && tone !== 'amber' && !linkMissing) return false;
      switch (filter) {
        case 'red': return tone === 'coral';
        case 'yellow': return tone === 'amber';
        case 'green': return tone === 'grass';
        case 'sky': return tone === 'sky';
        case 'done': return r.status === 'done';
        case 'progress': return r.status === 'progress';
        case 'todo': return r.status === 'todo';
        case 'broken': return linkMissing;
        default: return true;
      }
    });
  }, [matrix, query, filter, onlyProblems, checks]);

  if (matrix.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={<IconGrid size={26} />}
          title="Матрица трассировки пуста"
          sub="Загрузите Excel-файл со структурой: ID, Требование, ТЗ пункт, ЧТЗ раздел, Фиче-страница, Тест-кейс, Jira задача, Статус."
          action={
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#2a1a04] transition-colors hover:bg-[#ffb955]">
              <IconUpload size={15} />
              Загрузить матрицу
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Статистика покрытия */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Всего требований" value={stats.total} tone="teal" icon={<IconGrid size={17} />} />
        <Stat label="С тест-кейсами" value={stats.pctTests} suffix="%" sub={`${stats.withTests} из ${stats.total} покрыто тестами ПМИ`} tone="sky" icon={<IconDoc size={17} />} delay={60} />
        <Stat label="С задачами в Jira" value={stats.pctJira} suffix="%" sub={`${stats.withJira} из ${stats.total} заведено в Jira`} tone="amber" icon={<IconJira size={17} />} delay={120} />
        <Stat label="Реализовано" value={stats.pctDone} suffix="%" sub={`${stats.done} из ${stats.total} закрыто разработкой`} tone="grass" icon={<IconCheck size={17} />} delay={180} />
      </div>

      {/* Матрица */}
      <Reveal>
        <Panel
          icon={<IconGrid size={17} />}
          title="Матрица трассировки"
          sub="ТЗ → ЧТЗ → фиче-страница → тест-кейс → задача Jira"
          pad={false}
          actions={
            <>
              <Button size="sm" variant="accent" onClick={() => runChecks(matrix)} disabled={checking}>
                {checking ? <Spinner size={13} /> : <IconRefresh size={13} />}
                Проверить связи
              </Button>
              <Button size="sm" variant="ghost" onClick={downloadTemplate}>
                <IconDownload size={13} />
                Шаблон
              </Button>
            </>
          }
        >
          {/* Легенда подсветки */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line/70 px-5 py-3">
            <Badge tone="coral"><span className="h-1.5 w-1.5 rounded-full bg-coral" />нет тест-кейса</Badge>
            <Badge tone="amber"><span className="h-1.5 w-1.5 rounded-full bg-amber" />нет задачи в Jira</Badge>
            <Badge tone="grass"><span className="h-1.5 w-1.5 rounded-full bg-grass" />полностью покрыто</Badge>
            <Badge tone="sky"><span className="h-1.5 w-1.5 rounded-full bg-sky" />в работе</Badge>
            <span className="ml-auto text-[12px] text-faint">
              показано <span className="font-mono text-dim">{visible.length}</span> из <span className="font-mono text-dim">{matrix.length}</span>
            </span>
          </div>

          {/* Панель фильтров */}
          <div className="flex flex-wrap items-center gap-3 border-b border-line/70 px-5 py-3">
            <div className="relative min-w-[220px] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"><IconSearch size={15} /></span>
              <input
                className={inputCls + ' pl-9'}
                placeholder="Поиск: REQ-001, текст, страница, задача…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select className={selectCls} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Все строки</option>
              <option value="red">Проблема: нет тест-кейса</option>
              <option value="yellow">Проблема: нет задачи Jira</option>
              <option value="green">Полностью покрытые</option>
              <option value="sky">В работе</option>
              <option value="broken">Ссылки не найдены в API</option>
              <option value="done">Статус: реализовано</option>
              <option value="progress">Статус: в работе</option>
              <option value="todo">Статус: не начато</option>
            </select>
            <Switch checked={onlyProblems} onChange={setOnlyProblems} label="Только проблемы" />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-[12.5px] font-semibold text-dim transition-colors hover:border-teal/50 hover:text-teal">
              {parsing ? <Spinner size={13} /> : <IconUpload size={14} />}
              Загрузить Excel
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>

          {/* Таблица */}
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left">
              <thead className="sticky top-0 z-10">
                <tr className="bg-bg2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">
                  <th className="px-5 py-2.5">ID</th>
                  <th className="px-3 py-2.5">Требование</th>
                  <th className="px-3 py-2.5">ТЗ</th>
                  <th className="px-3 py-2.5">ЧТЗ</th>
                  <th className="px-3 py-2.5">Фиче-страница</th>
                  <th className="px-3 py-2.5">Тест-кейс</th>
                  <th className="px-3 py-2.5">Jira</th>
                  <th className="px-5 py-2.5 text-right">Статус</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const tone = rowTone(r);
                  const c = checks[r.id];
                  return (
                    <tr key={r.id} className={`mx-row border-b border-line/50 border-l-[3px] align-top ${toneRowCls[tone]}`}>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-[12px] font-semibold text-ink">{r.id}</td>
                      <td className="max-w-[300px] px-3 py-3 text-[13px] leading-snug text-ink">{r.text}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-[11.5px] text-dim">{r.tz}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-[11.5px]">
                        {r.chtz ? (
                          <span className="text-dim">{r.chtz}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-coral" title="Требование не отражено в ЧТЗ — пробел">
                            <IconAlert size={12} /> пробел
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-dim">
                          {r.page}
                          {c && (c.page === 'ok'
                            ? <span className="text-teal" title="Страница найдена в Confluence"><IconCheck size={12} /></span>
                            : <span className="text-coral" title="Страница не найдена в Confluence"><IconX size={12} /></span>)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px]">
                        {r.testCase ? <span className="text-sky">{r.testCase}</span> : <span className="font-semibold text-coral">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {r.jiraKey ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="font-mono text-[12px] text-amber">{r.jiraKey}</span>
                            {c && (c.jira === 'ok'
                              ? <span className="text-[10.5px] text-faint">{c.jiraStatus}</span>
                              : c.jira === 'missing' && <span className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-coral"><IconAlert size={11} />не найдена</span>)}
                          </span>
                        ) : (
                          <span className="font-mono font-semibold text-amber">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <Badge tone={r.status === 'done' ? 'grass' : r.status === 'progress' ? 'sky' : 'dim'}>
                          {REQ_STATUS_LABEL[r.status]}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-[13px] text-faint">
                      Ничего не найдено — измените фильтры или поисковый запрос.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Экспорт */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 px-5 py-4">
            <p className="flex items-center gap-2 text-[12.5px] text-faint">
              <IconLink size={14} />
              Источник: <span className="font-mono text-dim">data/traceability_matrix.xlsx</span>
            </p>
            <Button variant="primary" onClick={() => { exportMatrix(matrix); notify('Матрица экспортирована в traceability_matrix.xlsx', 'ok'); }}>
              <IconDownload size={15} />
              Экспорт матрицы в Excel
            </Button>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
