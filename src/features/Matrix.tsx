// ============================================================
// Матрица трассировки: ТЗ → ЧТЗ → фиче-страница → ПМИ → Jira.
// Сортировка, фильтры, подсветка проблем, синхронизация с Jira,
// экспорт в Excel. Редактирование — в RequirementDrawer.
// ============================================================

import { ArrowDown, ArrowUp, Download, Loader2, RefreshCw, Search, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Input, PageHeader, Panel, Reveal, Select, toast, type Tone } from '../components/ui';
import {
  PRIORITY_META, REQ_STATUS_META, fmtDate, rowProblems, testsByRequirement,
} from '../domain/lifecycle';
import type { ReqStatus, Requirement } from '../domain/types';
import { exportMatrix } from '../lib/excel';
import { syncJiraIssues } from '../services/integrations';
import { setJiraIssues, saveRequirement, useApp } from '../services/db';
import { RequirementDrawer } from './RequirementDrawer';

type SortKey = 'code' | 'title' | 'tzClause' | 'priority' | 'status';

const priorityOrder = { must: 0, should: 1, could: 2 } as const;
const statusOrder = { draft: 0, approved: 1, in_dev: 2, in_test: 3, done: 4 } as const;

export function Matrix() {
  const state = useApp();
  const [query, setQuery] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('code');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [syncing, setSyncing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const tMap = useMemo(() => testsByRequirement(state), [state]);
  const jiraMap = useMemo(() => new Map(state.jiraIssues.map((i) => [i.key, i])), [state.jiraIssues]);
  const fMap = useMemo(() => new Map(state.features.map((f) => [f.id, f])), [state.features]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = state.requirements.filter((r) => {
      if (q) {
        const f = fMap.get(r.featureId);
        const hay = `${r.code} ${r.title} ${r.tzClause} ${r.chtzSection} ${r.jiraKey} ${f?.code ?? ''} ${f?.title ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fStatus !== 'all' && r.status !== fStatus) return false;
      if (problemsOnly) {
        const p = rowProblems(r, tMap);
        if (!p.noTests && !p.noJira && !p.gap) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      let res = 0;
      switch (sortKey) {
        case 'code': res = a.code.localeCompare(b.code); break;
        case 'title': res = a.title.localeCompare(b.title, 'ru'); break;
        case 'tzClause': res = a.tzClause.localeCompare(b.tzClause, 'ru', { numeric: true }); break;
        case 'priority': res = priorityOrder[a.priority] - priorityOrder[b.priority]; break;
        case 'status': res = statusOrder[a.status] - statusOrder[b.status]; break;
      }
      return res * sortDir;
    });
  }, [state.requirements, query, fStatus, problemsOnly, sortKey, sortDir, tMap, fMap]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
  };

  const onSync = async () => {
    setSyncing(true);
    try {
      const keys = [...new Set(state.requirements.map((r) => r.jiraKey).filter(Boolean))];
      const issues = await syncJiraIssues(keys);
      setJiraIssues(issues);
      const done = issues.filter((i) => i.status === 'Готово').length;
      toast(`Синхронизация с Jira завершена: ${issues.length} задач, из них готово — ${done}`, 'ok');
    } catch {
      toast('Не удалось синхронизироваться с Jira', 'err');
    } finally {
      setSyncing(false);
    }
  };

  const onExport = () => {
    exportMatrix(rows, tMap);
    toast(`Матрица экспортирована: ${rows.length} строк в traceability_matrix.xlsx`, 'ok');
  };

  const setRowStatus = (r: Requirement, status: ReqStatus) => {
    saveRequirement({ ...r, status, updatedAt: new Date().toISOString() });
    toast(`${r.code}: статус → «${REQ_STATUS_META[status].label}»`, 'ok');
  };

  const Th = ({ label, k, className }: { label: string; k?: SortKey; className?: string }) => (
    <th className={`px-3 py-2.5 ${className ?? ''}`}>
      {k ? (
        <button
          onClick={() => toggleSort(k)}
          className={`inline-flex cursor-pointer items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] transition-colors hover:text-teal ${sortKey === k ? 'text-teal' : ''}`}
        >
          {label}
          {sortKey === k ? (sortDir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null}
        </button>
      ) : (
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em]">{label}</span>
      )}
    </th>
  );

  const counts = useMemo(() => {
    let red = 0, amber = 0, green = 0;
    for (const r of state.requirements) {
      const p = rowProblems(r, tMap);
      if (p.noTests) red++;
      else if (p.noJira) amber++;
      else if (r.status === 'done') green++;
    }
    return { red, amber, green };
  }, [state.requirements, tMap]);

  return (
    <div>
      <PageHeader
        title="Матрица трассировки"
        sub="Единая точка правды: каждое требование прослеживается от пункта ТЗ до задачи в Jira и результата тестирования."
        actions={
          <>
            <Button onClick={onSync} disabled={syncing}>
              {syncing ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
              Синхронизировать Jira
            </Button>
            <Button variant="primary" onClick={onExport}>
              <Download size={15} />
              Экспорт в Excel
            </Button>
          </>
        }
      />

      <Reveal>
        <Panel pad={false} icon={<Table2 size={16} />} title={`${rows.length} из ${state.requirements.length} требований`}
          sub="Клик по строке — редактирование; статус меняется прямо в таблице">
          {/* Легенда */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line/70 px-5 py-3">
            <Badge tone="coral"><span className="h-1.5 w-1.5 rounded-full bg-coral" />нет тест-кейса · {counts.red}</Badge>
            <Badge tone="amber"><span className="h-1.5 w-1.5 rounded-full bg-amber" />нет задачи Jira · {counts.amber}</Badge>
            <Badge tone="grass"><span className="h-1.5 w-1.5 rounded-full bg-grass" />реализовано · {counts.green}</Badge>
            <Badge tone="sky"><span className="h-1.5 w-1.5 rounded-full bg-sky" />в работе</Badge>
          </div>

          {/* Фильтры */}
          <div className="flex flex-wrap items-center gap-3 border-b border-line/70 px-5 py-3">
            <div className="relative min-w-[240px] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"><Search size={15} /></span>
              <Input className="pl-9" placeholder="Поиск: REQ-001, текст, FS-001, ASU-301…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Select className="w-auto" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="all">Все статусы</option>
              {(Object.keys(REQ_STATUS_META) as ReqStatus[]).map((s) => (
                <option key={s} value={s}>{REQ_STATUS_META[s].label}</option>
              ))}
            </Select>
            <button
              onClick={() => setProblemsOnly((v) => !v)}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition-all ${
                problemsOnly
                  ? 'border-coral/50 bg-coral/10 text-coral'
                  : 'border-line bg-bg2/60 text-faint hover:text-dim'
              }`}
            >
              Только проблемы
            </button>
          </div>

          {/* Таблица */}
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead className="sticky top-0 z-10">
                <tr className="bg-bg2 text-faint">
                  <Th label="ID" k="code" className="pl-5" />
                  <Th label="Требование" k="title" />
                  <Th label="ТЗ" k="tzClause" />
                  <Th label="ЧТЗ" />
                  <Th label="Фича" />
                  <Th label="Тесты ПМИ" />
                  <Th label="Jira" />
                  <Th label="Приоритет" k="priority" />
                  <Th label="Статус" k="status" />
                  <Th label="Изм." className="pr-5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const p = rowProblems(r, tMap);
                  const tone: Tone = p.noTests ? 'coral' : p.noJira ? 'amber' : r.status === 'done' ? 'grass' : 'sky';
                  const borderCls = { coral: 'border-l-coral', amber: 'border-l-amber', grass: 'border-l-grass', sky: 'border-l-sky' }[tone];
                  const f = fMap.get(r.featureId);
                  const jira = r.jiraKey ? jiraMap.get(r.jiraKey) : undefined;
                  const tests = tMap.get(r.id) ?? [];
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setOpenId(r.id)}
                      className={`mx-row row-in cursor-pointer border-b border-line/50 border-l-[3px] align-top ${borderCls}`}
                      style={{ animationDelay: `${Math.min(idx, 12) * 28}ms` }}
                    >
                      <td className="whitespace-nowrap py-3 pl-5 pr-3 font-mono text-[12px] font-bold text-ink">
                        {r.code}
                        {r.source === 'new' && <span className="ml-1.5 align-middle text-[10px] font-semibold text-teal">NEW</span>}
                      </td>
                      <td className="max-w-[280px] px-3 py-3 text-[13px] leading-snug text-ink">{r.title}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-[11.5px] text-dim">{r.tzClause}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-[11.5px]">
                        {r.chtzSection
                          ? <span className="text-dim">{r.chtzSection}</span>
                          : p.gap
                            ? <Badge tone="coral">пробел</Badge>
                            : <span className="text-faint">н/д</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {f
                          ? <span className="rounded border border-line bg-bg2 px-1.5 py-0.5 font-mono text-[11px] text-sky">{f.code}</span>
                          : <span className="text-faint">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {tests.length > 0 ? (
                          <span className="font-mono text-[11.5px] text-sky">{tests.map((t) => t.code).join(', ')}</span>
                        ) : (
                          <span className="font-semibold text-coral">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {r.jiraKey ? (
                          <span className="inline-flex items-baseline gap-1.5">
                            <span className="font-mono text-[11.5px] font-semibold text-amber">{r.jiraKey}</span>
                            <span className={`text-[10.5px] ${jira?.status === 'Готово' ? 'text-grass' : 'text-faint'}`}>{jira?.status ?? '…'}</span>
                          </span>
                        ) : (
                          <span className="font-mono font-semibold text-amber">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <Badge tone={PRIORITY_META[r.priority].tone as Tone}>{PRIORITY_META[r.priority].label}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Select
                          className="w-[130px] px-2 py-1.5 text-[12px]"
                          value={r.status}
                          onChange={(e) => setRowStatus(r, e.target.value as ReqStatus)}
                        >
                          {(Object.keys(REQ_STATUS_META) as ReqStatus[]).map((s) => (
                            <option key={s} value={s}>{REQ_STATUS_META[s].label}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 pr-5 font-mono text-[10.5px] text-faint">{fmtDate(r.updatedAt)}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-[13px] text-faint">
                      Ничего не найдено — измените фильтры или поисковый запрос.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>

      <RequirementDrawer reqId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
