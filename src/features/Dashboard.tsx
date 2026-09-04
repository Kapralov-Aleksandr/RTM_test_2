// ============================================================
// Дашборд руководителя проекта: живое покрытие по всему
// жизненному циклу, узкие места, синхронизация команды
// ============================================================

import {
  AlertTriangle, BookOpen, CheckCheck, CheckCircle2, FileText, Inbox,
  Layers, ShieldCheck, Sparkles, Ticket, Zap,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Cell, Pie, PieChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Badge, EmptyState, PageHeader, Panel, ProgressBar, Reveal, Stat, toast, type Tone } from '../components/ui';
import {
  NEWREQ_STATUS_META, REQ_STATUS_META, ROLE_LABEL, computeCoverage, coverageByPage,
  fmtDateTime, funnelStages,
} from '../domain/lifecycle';
import type { ReqStatus } from '../domain/types';
import { toggleNotice, useApp } from '../services/db';

const STATUS_HEX: Record<ReqStatus, string> = {
  draft: '#6d8e96', approved: '#5fb0ea', in_dev: '#f5a83e', in_test: '#40d3b6', done: '#5ad98d',
};

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line2 bg-bg2/95 px-3 py-2 text-[11.5px] shadow-xl">
      {label && <p className="mb-1 font-mono font-semibold text-ink">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-dim">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          {p.name}: <span className="font-mono text-ink">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function Dashboard() {
  const state = useApp();
  const cov = useMemo(() => computeCoverage(state), [state]);
  const byPage = useMemo(() => coverageByPage(state), [state]);
  const stages = useMemo(() => funnelStages(state, cov), [state, cov]);
  const maxStage = Math.max(1, ...stages.map((s) => s.value));
  const pct = (n: number) => (cov.total ? Math.round((n / cov.total) * 100) : 0);

  const statusData = useMemo(
    () => (Object.keys(REQ_STATUS_META) as ReqStatus[])
      .map((s) => ({ name: REQ_STATUS_META[s].label, value: state.requirements.filter((r) => r.status === s).length, color: STATUS_HEX[s] }))
      .filter((d) => d.value > 0),
    [state.requirements],
  );

  const pendingNotices = state.notices.filter((n) => !n.done);
  const fcode = (id: string) => state.features.find((f) => f.id === id)?.code ?? '—';
  const topNew = [...state.newReqs].filter((n) => n.status !== 'rejected').sort((a, b) => b.budgetHours - a.budgetHours).slice(0, 3);

  return (
    <div>
      <PageHeader
        title="Обзор проекта"
        sub={`ТЗ ${state.tzDoc.code} · «${state.tzDoc.title}» · ${state.tzDoc.client}`}
        actions={<Badge tone="teal">{state.settings.projectKey} · демо-контур</Badge>}
      />

      {/* Ключевые метрики */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Требований" value={cov.total} sub={`по ${cov.tzClauses} пунктам ТЗ`} tone="teal" icon={<Layers size={17} />} />
        <Stat label="В ЧТЗ" value={pct(cov.withChtz)} suffix="%" sub={`${cov.withChtz} отражено в документации`} tone="sky" icon={<BookOpen size={17} />} delay={60} />
        <Stat label="С тестами" value={pct(cov.withTests)} suffix="%" sub={`${cov.withTests} покрыто кейсами ПМИ`} tone="teal" icon={<ShieldCheck size={17} />} delay={120} />
        <Stat label="В Jira" value={pct(cov.withJira)} suffix="%" sub={`${cov.withJira} заведено задачами`} tone="amber" icon={<Ticket size={17} />} delay={180} />
        <Stat label="Реализовано" value={pct(cov.done)} suffix="%" sub={`${cov.done} из ${cov.total} готово`} tone="grass" icon={<CheckCircle2 size={17} />} delay={240} />
      </div>

      {/* Воронка + статусы */}
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Reveal className="xl:col-span-2">
          <Panel icon={<FileText size={16} />} title="Воронка жизненного цикла" sub="Просачивание требований на каждом переходе — узкие места подсвечены" pad={false}>
            <div className="flex flex-col px-5 py-6">
              {stages.map((s, i) => {
                const widthPct = Math.max(9, (s.value / maxStage) * 100);
                const prev = i > 0 ? stages[i - 1].value : null;
                const conv = prev ? Math.round((s.value / Math.max(1, prev)) * 100) : null;
                return (
                  <div key={s.label}>
                    {i > 0 && (
                      <div className="flex items-center justify-center py-1">
                        <span className={`rounded-full border border-line bg-bg2 px-2 py-0.5 font-mono text-[10.5px] ${conv !== null && conv < 80 ? 'text-amber' : 'text-dim'}`}>
                          ↓ {conv}%
                        </span>
                      </div>
                    )}
                    <div className="group flex items-center gap-4">
                      <span className="w-[150px] shrink-0 text-right text-[12px] font-medium text-dim">{s.label}</span>
                      <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-bg2/40 ring-1 ring-line/50">
                        <div
                          className={`bar-grow absolute inset-y-0 left-0 flex items-center justify-end rounded-md pr-3 ${s.cls} transition-all group-hover:brightness-110`}
                          style={{ width: `${widthPct}%`, animationDelay: `${i * 100}ms` }}
                        >
                          <span className="font-display text-[13px] font-bold text-[#06231d]">{s.value}</span>
                        </div>
                      </div>
                      <span className="w-11 shrink-0 font-mono text-[12px] text-faint">
                        {Math.round((s.value / Math.max(1, cov.total)) * 100)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={80}>
          <Panel icon={<Layers size={16} />} title="Статусы требований" sub="Распределение по жизненному циклу" pad={false}>
            <div className="flex h-[280px] items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} stroke="none">
                    {statusData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 border-t border-line/60 px-4 py-3.5">
              {statusData.map((d) => (
                <span key={d.name} className="flex items-center gap-1.5 text-[11.5px] text-dim">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  {d.name} <span className="font-mono text-faint">{d.value}</span>
                </span>
              ))}
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* По фиче-страницам + синхронизация команды */}
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Reveal className="xl:col-span-2">
          <Panel icon={<BookOpen size={16} />} title="Покрытие по фиче-страницам" sub="Стек: реализовано / в работе / без Jira / без тестов" pad={false}>
            <div className="h-[260px] px-3 py-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byPage} barSize={26}>
                  <XAxis dataKey="code" tick={{ fill: '#6d8e96', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#1d3f4b' }} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(23,55,67,0.4)' }} />
                  <Bar dataKey="done" name="Реализовано" stackId="a" fill="#5ad98d" />
                  <Bar dataKey="inwork" name="В работе" stackId="a" fill="#5fb0ea" />
                  <Bar dataKey="noJira" name="Без задачи Jira" stackId="a" fill="#f5a83e" />
                  <Bar dataKey="noTests" name="Без тестов" stackId="a" fill="#f0695a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={80}>
          <Panel
            icon={<Zap size={16} />}
            title="Синхронизация команды"
            sub={`${pendingNotices.length} ожидающих уведомлений`}
            pad={false}
            actions={pendingNotices.length > 0 ? <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-amber text-amber" /> : undefined}
          >
            {pendingNotices.length === 0 ? (
              <EmptyState
                icon={<CheckCheck size={22} />}
                title="Команда синхронизирована"
                sub="Нет открытых уведомлений об изменениях фиче-страниц."
              />
            ) : (
              <div className="flex max-h-[240px] flex-col divide-y divide-line/60 overflow-y-auto">
                {pendingNotices.map((n) => (
                  <div key={n.id} className="row-in px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Badge tone="amber"><Zap size={11} /> {fcode(n.featureId)}</Badge>
                      <span className="text-[11px] text-faint">{fmtDateTime(n.ts)}</span>
                      <button
                        onClick={() => { toggleNotice(n.id); toast(`Уведомление по ${fcode(n.featureId)} отмечено выполненным`, 'ok'); }}
                        className="ml-auto flex cursor-pointer items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-dim transition-colors hover:border-grass/50 hover:text-grass"
                      >
                        <CheckCheck size={12} /> выполнено
                      </button>
                    </div>
                    <p className="mt-2 text-[12.5px] leading-snug text-dim">{n.message}</p>
                    <div className="mt-2 flex gap-1.5">
                      {n.audience.map((a) => (
                        <span key={a} className="rounded border border-line bg-bg2 px-1.5 py-0.5 text-[10.5px] font-semibold text-faint">{ROLE_LABEL[a]}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </Reveal>
      </div>

      {/* Пробелы / сироты / новые требования */}
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Reveal>
          <Panel icon={<AlertTriangle size={16} />} title="Пробелы: ТЗ без ЧТЗ" sub="Требования, не отражённые в аналитической документации" pad={false}
            actions={<Link to="/matrix" className="text-[12px] font-semibold text-teal transition-colors hover:text-ink">в матрицу →</Link>}>
            {cov.gaps.length === 0 ? (
              <EmptyState icon={<CheckCircle2 size={20} />} title="Пробелов нет" sub="Все требования baseline отражены в ЧТЗ." />
            ) : (
              <div className="flex flex-col divide-y divide-line/60">
                {cov.gaps.map((r) => (
                  <div key={r.id} className="mx-row border-l-[3px] border-l-coral bg-coral/[0.04] px-5 py-3">
                    <p className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-bold text-ink">{r.code}</span>
                      <span className="font-mono text-[11px] text-faint">{r.tzClause}</span>
                    </p>
                    <p className="mt-1 text-[12.5px] leading-snug text-dim">{r.title}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </Reveal>

        <Reveal delay={70}>
          <Panel icon={<AlertTriangle size={16} />} title="Сироты: тесты без требований" sub="Кейсы ПМИ без валидной привязки" pad={false}>
            {cov.orphans.length === 0 ? (
              <EmptyState icon={<CheckCircle2 size={20} />} title="Сирот нет" sub="Все тест-кейсы привязаны к требованиям." />
            ) : (
              <div className="flex flex-col divide-y divide-line/60">
                {cov.orphans.map((t) => (
                  <div key={t.id} className="mx-row border-l-[3px] border-l-amber bg-amber/[0.04] px-5 py-3">
                    <p className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-bold text-ink">{t.code}</span>
                      <Badge tone={t.requirementId ? 'coral' : 'amber'}>
                        {t.requirementId ? `ссылка на ${t.requirementId} битая` : 'привязка не указана'}
                      </Badge>
                    </p>
                    <p className="mt-1 text-[12.5px] leading-snug text-dim">{t.title}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </Reveal>

        <Reveal delay={140}>
          <Panel icon={<Sparkles size={16} />} title="Новые требования · топ по бюджету" sub="Появились после baseline — риск потери под контролем" pad={false}
            actions={<Link to="/new" className="text-[12px] font-semibold text-teal transition-colors hover:text-ink">журнал →</Link>}>
            <div className="flex flex-col divide-y divide-line/60">
              {topNew.map((n) => (
                <div key={n.id} className="mx-row px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] font-bold text-teal">{n.code}</span>
                    <Badge tone={NEWREQ_STATUS_META[n.status].tone as Tone}>{NEWREQ_STATUS_META[n.status].label}</Badge>
                    <span className="ml-auto font-mono text-[11.5px] text-amber">+{n.budgetHours} ч</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-dim">{n.description}</p>
                </div>
              ))}
              <div className="flex items-center justify-between px-5 py-3 text-[12px] text-faint">
                <span className="flex items-center gap-1.5"><Inbox size={13} /> всего в журнале: {state.newReqs.length}</span>
                <ProgressBar value={cov.total ? (cov.done / cov.total) * 100 : 0} tone="grass" className="w-24" />
              </div>
            </div>
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
