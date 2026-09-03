// ============================================================
// Вкладка 3 «Покрытие требований»:
// воронка ТЗ → Требования → Тесты → Задачи → Реализация,
// покрытие по фиче-страницам, «пробелы», «сироты», экспорт
// ============================================================

import { useMemo } from 'react';
import type { PmiTest, Requirement } from '../types';
import { buildPmiRegistry, REQ_STATUS_LABEL } from '../data/demo';
import { exportCoverageReport } from '../lib/excel';
import { Badge, Button, EmptyState, Panel, Reveal } from './ui';
import {
  IconAlert, IconCheck, IconDoc, IconDownload, IconFunnel, IconTarget,
} from './icons';

export function CoverageTab({
  matrix,
  notify,
}: {
  matrix: Requirement[];
  notify: (msg: string, tone?: 'ok' | 'warn' | 'err') => void;
}) {
  // ---------- Расчёты ----------
  const calc = useMemo(() => {
    const tzSet = new Set(matrix.map((r) => r.tz).filter(Boolean));
    const tests = matrix.filter((r) => r.testCase).length;
    const jira = matrix.filter((r) => r.jiraKey).length;
    const done = matrix.filter((r) => r.status === 'done').length;
    const stages = [
      { label: 'Пункты ТЗ', value: tzSet.size, cls: 'bg-sky', text: 'text-sky' },
      { label: 'Атомарные требования', value: matrix.length, cls: 'bg-teal', text: 'text-teal' },
      { label: 'Покрыто тестами', value: tests, cls: 'bg-sky', text: 'text-sky' },
      { label: 'Заведено в Jira', value: jira, cls: 'bg-amber', text: 'text-amber' },
      { label: 'Реализовано', value: done, cls: 'bg-grass', text: 'text-grass' },
    ];
    const max = Math.max(1, ...stages.map((s) => s.value));

    // По фиче-страницам
    const pages = [...new Set(matrix.map((r) => r.page).filter(Boolean))].sort();
    const byPage = pages.map((p) => {
      const rows = matrix.filter((r) => r.page === p);
      const noTest = rows.filter((r) => !r.testCase).length;
      const noJira = rows.filter((r) => r.testCase && !r.jiraKey).length;
      const inwork = rows.filter((r) => r.testCase && r.jiraKey && r.status !== 'done').length;
      const doneP = rows.filter((r) => r.status === 'done').length;
      return { page: p, total: rows.length, noTest, noJira, inwork, done: doneP };
    }).sort((a, b) => b.total - a.total);

    // «Пробелы»: есть в ТЗ, но не отражены в ЧТЗ
    const gaps = matrix.filter((r) => r.tz && !r.chtz);

    // «Сироты»: тест-кейсы ПМИ без привязки к требованиям
    const pmi: PmiTest[] = buildPmiRegistry(matrix);
    const ids = new Set(matrix.map((r) => r.id));
    const orphans = pmi.filter((t) => !t.req || !ids.has(t.req));

    return { stages, max, byPage, gaps, orphans, tzCount: tzSet.size, tests, jira, done };
  }, [matrix]);

  // ---------- Экспорт отчёта ----------
  const doExport = () => {
    const pct = (n: number) => (matrix.length ? `${Math.round((n / matrix.length) * 100)}%` : '0%');
    exportCoverageReport({
      summary: [
        { 'Показатель': 'Пунктов ТЗ', 'Значение': String(calc.tzCount) },
        { 'Показатель': 'Всего атомарных требований', 'Значение': String(matrix.length) },
        { 'Показатель': 'Покрыто тест-кейсами', 'Значение': `${calc.tests} (${pct(calc.tests)})` },
        { 'Показатель': 'Заведено задач в Jira', 'Значение': `${calc.jira} (${pct(calc.jira)})` },
        { 'Показатель': 'Реализовано', 'Значение': `${calc.done} (${pct(calc.done)})` },
        { 'Показатель': 'Пробелов (нет раздела ЧТЗ)', 'Значение': String(calc.gaps.length) },
        { 'Показатель': 'Сирот (тестов без требований)', 'Значение': String(calc.orphans.length) },
      ],
      matrix: matrix.map((r) => ({
        'ID': r.id,
        'Требование': r.text,
        'ТЗ': r.tz,
        'ЧТЗ': r.chtz || '—',
        'Фиче-страница': r.page,
        'Тест-кейс': r.testCase || '—',
        'Jira': r.jiraKey || '—',
        'Статус': REQ_STATUS_LABEL[r.status],
        'Покрытие': !r.testCase ? 'Нет тест-кейса' : !r.jiraKey ? 'Нет задачи Jira' : r.status === 'done' ? 'Полное' : 'В работе',
      })),
      byPage: calc.byPage.map((p) => ({
        'Фиче-страница': p.page,
        'Всего требований': p.total,
        'Реализовано': p.done,
        'В работе': p.inwork,
        'Без задачи Jira': p.noJira,
        'Без тест-кейса': p.noTest,
      })),
      gaps: calc.gaps.map((r) => ({
        'ID': r.id, 'Требование': r.text, 'ТЗ пункт': r.tz, 'Фиче-страница': r.page,
      })),
      orphans: calc.orphans.map((t) => ({
        'Тест-кейс': t.code, 'Название': t.title, 'Привязка': t.req || '(пусто)',
      })),
    });
    notify('Отчёт о покрытии экспортирован в coverage_report.xlsx (5 листов)', 'ok');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 xl:grid-cols-5">
        {/* Воронка покрытия */}
        <Reveal className="xl:col-span-3">
          <Panel
            icon={<IconFunnel size={17} />}
            title="Воронка покрытия"
            sub="Путь требования: ТЗ → атомарные требования → тесты → задачи → реализация"
            pad={false}
          >
            <div className="flex flex-col px-5 py-6">
              {calc.stages.map((s, i) => {
                const widthPct = Math.max(10, (s.value / calc.max) * 100);
                const prev = i > 0 ? calc.stages[i - 1].value : null;
                const conv = prev ? Math.round((s.value / Math.max(1, prev)) * 100) : null;
                return (
                  <div key={s.label}>
                    {i > 0 && (
                      <div className="flex items-center justify-center gap-2 py-1">
                        <span className="font-mono text-[11px] text-faint">↓</span>
                        <span className={`rounded-full border border-line bg-bg2 px-2 py-0.5 font-mono text-[10.5px] ${conv !== null && conv < 80 ? 'text-amber' : 'text-dim'}`}>
                          {conv}%
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <span className="w-[150px] shrink-0 text-right text-[12px] font-medium text-dim">{s.label}</span>
                      <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-bg2/40">
                        <div
                          className={`funnel-grow absolute inset-y-0 left-0 flex items-center justify-end rounded-md ${s.cls} pr-3`}
                          style={{ width: `${widthPct}%`, animationDelay: `${i * 110}ms`, opacity: 0.9 }}
                        >
                          <span className="font-display text-[13px] font-bold text-[#06231d]">{s.value}</span>
                        </div>
                      </div>
                      <span className={`w-12 shrink-0 font-mono text-[12px] font-semibold ${s.text}`}>
                        {matrix.length ? Math.round((s.value / matrix.length) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                );
              })}
              <p className="mt-5 border-t border-line/60 pt-4 text-[12px] leading-relaxed text-faint">
                Узкое место: на каждом переходе виден процент «просачивания». Значения ниже 80% подсвечены янтарным —
                это сигнал проверить соответствующий этап жизненного цикла требования.
              </p>
            </div>
          </Panel>
        </Reveal>

        {/* Покрытие по фиче-страницам */}
        <Reveal className="xl:col-span-2" delay={80}>
          <Panel
            icon={<IconTarget size={16} />}
            title="По фиче-страницам"
            sub="Степень покрытия требований в каждой фиче"
            pad={false}
          >
            <div className="flex flex-col gap-4 px-5 py-5">
              {calc.byPage.map((p, i) => {
                const seg = (n: number) => `${(n / p.total) * 100}%`;
                return (
                  <div key={p.page} className="group">
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="font-mono text-[12.5px] font-semibold text-ink transition-colors group-hover:text-teal">{p.page}</span>
                      <span className="font-mono text-[11.5px] text-faint">
                        <span className="text-grass">{p.done}</span>/{p.total} реализовано
                      </span>
                    </div>
                    <div className="flex h-3 overflow-hidden rounded-full bg-bg2/60 ring-1 ring-line/60">
                      <span className="bar-grow bg-grass transition-transform group-hover:brightness-110" style={{ width: seg(p.done), animationDelay: `${i * 70}ms` }} title={`Реализовано: ${p.done}`} />
                      <span className="bar-grow bg-sky" style={{ width: seg(p.inwork), animationDelay: `${i * 70 + 40}ms` }} title={`В работе: ${p.inwork}`} />
                      <span className="bar-grow bg-amber" style={{ width: seg(p.noJira), animationDelay: `${i * 70 + 80}ms` }} title={`Без задачи Jira: ${p.noJira}`} />
                      <span className="bar-grow bg-coral" style={{ width: seg(p.noTest), animationDelay: `${i * 70 + 120}ms` }} title={`Без тест-кейса: ${p.noTest}`} />
                    </div>
                  </div>
                );
              })}
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line/60 pt-3.5 text-[11.5px] text-faint">
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-grass" />реализовано</span>
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-sky" />в работе</span>
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber" />нет задачи</span>
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-coral" />нет тестов</span>
              </div>
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* Пробелы и сироты */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Reveal delay={60}>
          <Panel
            icon={<IconDoc size={16} />}
            title="Пробелы: ТЗ без ЧТЗ"
            sub="Требования из ТЗ, не отражённые в аналитической документации"
            pad={false}
            actions={<Badge tone={calc.gaps.length ? 'coral' : 'grass'}>{calc.gaps.length}</Badge>}
          >
            {calc.gaps.length === 0 ? (
              <EmptyState icon={<IconCheck size={22} />} title="Пробелов нет" sub="Все требования ТЗ отражены в разделах ЧТЗ." />
            ) : (
              <div className="divide-y divide-line/60">
                {calc.gaps.map((r) => (
                  <div key={r.id} className="mx-row flex items-start gap-3 border-l-[3px] border-l-coral bg-coral/[0.04] px-5 py-3">
                    <span className="mt-0.5 text-coral"><IconAlert size={14} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12px] font-semibold text-ink">{r.id}</span>
                        <span className="font-mono text-[11px] text-faint">{r.tz}</span>
                        <span className="ml-auto rounded border border-line bg-bg2 px-1.5 py-0.5 font-mono text-[10.5px] text-dim">{r.page}</span>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-snug text-dim">{r.text}</p>
                    </div>
                  </div>
                ))}
                <p className="px-5 py-3 text-[12px] text-faint">
                  Действие: аналитику — добавить разделы ЧТЗ в Confluence и указать их в матрице.
                </p>
              </div>
            )}
          </Panel>
        </Reveal>

        <Reveal delay={120}>
          <Panel
            icon={<IconAlert size={16} />}
            title="Сироты: тесты без требований"
            sub="Тест-кейсы ПМИ, не привязанные к атомарным требованиям"
            pad={false}
            actions={<Badge tone={calc.orphans.length ? 'amber' : 'grass'}>{calc.orphans.length}</Badge>}
          >
            {calc.orphans.length === 0 ? (
              <EmptyState icon={<IconCheck size={22} />} title="Сирот нет" sub="Каждый тест-кейс ПМИ привязан к требованию." />
            ) : (
              <div className="divide-y divide-line/60">
                {calc.orphans.map((t) => (
                  <div key={t.code} className="mx-row flex items-start gap-3 border-l-[3px] border-l-amber bg-amber/[0.04] px-5 py-3">
                    <span className="mt-0.5 text-amber"><IconDoc size={14} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12px] font-semibold text-ink">{t.code}</span>
                        <Badge tone={t.req ? 'coral' : 'amber'}>
                          {t.req ? `ссылка на ${t.req} не найдена` : 'привязка не указана'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-snug text-dim">{t.title}</p>
                    </div>
                  </div>
                ))}
                <p className="px-5 py-3 text-[12px] text-faint">
                  Действие: QA — привязать тесты к требованиям в ПМИ либо удалить неактуальные.
                </p>
              </div>
            )}
          </Panel>
        </Reveal>
      </div>

      {/* Экспорт */}
      <Reveal delay={160}>
        <div className="flex items-center justify-between rounded-xl border border-line bg-bg1/90 px-5 py-4">
          <p className="text-[13px] text-faint">
            Отчёт включает сводку, матрицу с колонкой покрытия, разбивку по страницам, пробелы и сирот.
          </p>
          <Button variant="primary" onClick={doExport}>
            <IconDownload size={15} />
            Экспорт отчёта о покрытии
          </Button>
        </div>
      </Reveal>
    </div>
  );
}
