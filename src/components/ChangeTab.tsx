// ============================================================
// Вкладка 2 «Контроль изменений»:
// загрузка фиче-страниц Confluence, снапшоты (data/snapshots/),
// diff (difflib), список действий, журнал изменений
// ============================================================

import { useMemo, useState } from 'react';
import type { ChangeJournalEntry, PageSnapshot, Requirement } from '../types';
import { apiFetchPage } from '../lib/mockApi';
import { diffLines, diffStats, toChunks, type DiffChunk } from '../lib/diff';
import { buildSeedSnapshots } from '../data/demo';
import { load, save } from '../lib/storage';
import { exportChangeJournal } from '../lib/excel';
import { Badge, Button, EmptyState, Panel, Reveal, Spinner, inputCls } from './ui';
import {
  IconBolt, IconBook, IconCheck, IconClock, IconDiff, IconDoc, IconDownload, IconInfo, IconSave,
} from './icons';

interface PageResult {
  pageId: string;
  confluenceId: string;
  title: string;
  fromV: number;       // 0 = базового снапшота ещё не было
  toV: number;
  changed: boolean;
  baselineOnly: boolean;
  chunks: DiffChunk[];
  adds: number;
  dels: number;
  actions: string[];
  sel: boolean[];
  affectedReqs: string[];
  fetchedAt: string;
  error?: string;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/** Формирование списка действий по итогам изменений страницы */
function buildActions(
  pageId: string,
  title: string,
  addedText: string,
  dels: number,
  affected: Requirement[],
): string[] {
  const actions: string[] = [];
  const withTests = affected.filter((r) => r.testCase);
  if (withTests.length > 0) {
    actions.push(`Обновить тест-кейсы для требований: ${withTests.map((r) => r.id).join(', ')}`);
  }
  const keys = [...new Set(affected.map((r) => r.jiraKey).filter(Boolean))];
  actions.push(
    `Уведомить разработчика о изменениях в ${pageId} (задачи Jira: ${keys.join(', ') || 'не привязаны'})`,
  );
  actions.push(`QA: пересмотреть раздел ПМИ «${title}» — чек-листы могли устареть`);
  if (/интеграц|REST|1С/i.test(addedText)) {
    actions.push('Оценить влияние изменений на интеграцию с «1С:Университет»');
  }
  if (dels > 0) {
    actions.push(`Проверить, не потеряны ли связанные требования (удалено строк: ${dels})`);
  }
  return actions;
}

export function ChangeTab({
  matrix,
  notify,
}: {
  matrix: Requirement[];
  notify: (msg: string, tone?: 'ok' | 'warn' | 'err') => void;
}) {
  const [idsInput, setIdsInput] = useState('FS-001, FS-004');
  const [snapshots, setSnapshots] = useState<Record<string, PageSnapshot[]>>(() => {
    const stored = load<Record<string, PageSnapshot[]> | null>('snapshots', null);
    return stored ?? buildSeedSnapshots();
  });
  const [results, setResults] = useState<Record<string, PageResult>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [journal, setJournal] = useState<ChangeJournalEntry[]>(() => load<ChangeJournalEntry[]>('journal', []));
  const [journalOpen, setJournalOpen] = useState(false);

  // ---------- Загрузка страниц и сравнение со снапшотами ----------
  const fetchPages = async () => {
    const ids = idsInput
      .split(/[,;\n]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (ids.length === 0) {
      notify('Введите хотя бы один ID фиче-страницы', 'warn');
      return;
    }
    setFetching(true);
    const nextSnaps = { ...snapshots };
    const nextResults: Record<string, PageResult> = {};
    let changedCount = 0;

    for (const id of ids) {
      const hist = nextSnaps[id] ?? [];
      const last = hist[hist.length - 1];
      const nextIndex = last ? last.version : 0; // версии нумеруются с 1
      try {
        const page = await apiFetchPage(id, nextIndex);
        let res: PageResult;
        if (!last) {
          // Первый снимок — сохраняем baseline
          res = {
            pageId: page.pageId, confluenceId: page.confluenceId, title: page.title,
            fromV: 0, toV: page.version, changed: false, baselineOnly: true,
            chunks: [], adds: 0, dels: 0, actions: [], sel: [], affectedReqs: [],
            fetchedAt: new Date().toISOString(),
          };
        } else if (last.content === page.content) {
          res = {
            pageId: page.pageId, confluenceId: page.confluenceId, title: page.title,
            fromV: last.version, toV: page.version, changed: false, baselineOnly: false,
            chunks: [], adds: 0, dels: 0, actions: [], sel: [], affectedReqs: [],
            fetchedAt: new Date().toISOString(),
          };
        } else {
          const dl = diffLines(last.content.split('\n'), page.content.split('\n'));
          const { adds, dels } = diffStats(dl);
          const affected = matrix.filter((r) => r.page.toUpperCase() === page.pageId);
          const addedText = dl.filter((l) => l.type === 'add').map((l) => l.text).join('\n');
          const actions = buildActions(page.pageId, page.title, addedText, dels, affected);
          res = {
            pageId: page.pageId, confluenceId: page.confluenceId, title: page.title,
            fromV: last.version, toV: page.version, changed: true, baselineOnly: false,
            chunks: toChunks(dl), adds, dels, actions, sel: actions.map(() => true),
            affectedReqs: affected.map((r) => r.id),
            fetchedAt: new Date().toISOString(),
          };
          changedCount++;
        }
        // Сохраняем снапшот (аналог data/snapshots/{pageId}_{date}.txt)
        const snap: PageSnapshot = {
          pageId: page.pageId, title: page.title, version: page.version,
          date: new Date().toISOString(), content: page.content,
        };
        nextSnaps[page.pageId] = [...(nextSnaps[page.pageId] ?? []), snap];
        nextResults[page.pageId] = res;
      } catch (e) {
        nextResults[id] = {
          pageId: id, confluenceId: '', title: '', fromV: 0, toV: 0, changed: false,
          baselineOnly: false, chunks: [], adds: 0, dels: 0, actions: [], sel: [],
          affectedReqs: [], fetchedAt: new Date().toISOString(),
          error: e instanceof Error ? e.message : 'Ошибка загрузки страницы',
        };
      }
    }

    setSnapshots(nextSnaps);
    save('snapshots', nextSnaps);
    setResults(nextResults);
    const firstChanged = Object.values(nextResults).find((r) => r.changed)?.pageId
      ?? Object.keys(nextResults)[0] ?? null;
    setSelected(firstChanged);
    setFetching(false);
    notify(
      changedCount > 0
        ? `Проверено страниц: ${ids.length}. Изменения обнаружены: ${changedCount}`
        : `Проверено страниц: ${ids.length}. Изменений не найдено`,
      changedCount > 0 ? 'warn' : 'ok',
    );
  };

  // ---------- Сохранение изменений в журнал ----------
  const saveToJournal = (res: PageResult) => {
    const chosen = res.actions.filter((_, i) => res.sel[i]);
    if (chosen.length === 0) {
      notify('Отметьте хотя бы одно действие для журнала', 'warn');
      return;
    }
    const entry: ChangeJournalEntry = {
      id: `${Date.now()}-${res.pageId}`,
      ts: new Date().toISOString(),
      pageId: res.pageId,
      title: res.title,
      fromVersion: res.fromV,
      toVersion: res.toV,
      adds: res.adds,
      dels: res.dels,
      actions: chosen,
      affectedReqs: res.affectedReqs,
    };
    const next = [entry, ...journal];
    setJournal(next);
    save('journal', next);
    notify(`Изменения ${res.pageId} сохранены в журнал (${chosen.length} действий)`, 'ok');
  };

  const toggleAction = (pageId: string, idx: number) => {
    setResults((rs) => {
      const r = rs[pageId];
      if (!r) return rs;
      const sel = r.sel.map((v, i) => (i === idx ? !v : v));
      return { ...rs, [pageId]: { ...r, sel } };
    });
  };

  const res = selected ? results[selected] : null;
  const hist = selected ? (snapshots[selected] ?? []) : [];

  const pagesInMatrix = useMemo(
    () => [...new Set(matrix.map((r) => r.page).filter(Boolean))].sort(),
    [matrix],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Ввод ID и загрузка */}
      <Reveal>
        <Panel
          icon={<IconDiff size={17} />}
          title="Контроль изменений фиче-страниц"
          sub="Скачивание текущей версии из Confluence, снапшот и diff с предыдущей версией"
          actions={
            <Button variant="primary" onClick={fetchPages} disabled={fetching}>
              {fetching ? <Spinner size={14} /> : <IconBolt size={14} />}
              Скачать и сравнить
            </Button>
          }
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                ID фиче-страниц (через запятую)
              </p>
              <input
                className={inputCls + ' font-mono text-[13px]'}
                value={idsInput}
                onChange={(e) => setIdsInput(e.target.value)}
                placeholder="FS-001, FS-004 или 8451201"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {pagesInMatrix.map((p) => (
                <button
                  key={p}
                  onClick={() => setIdsInput((v) =>
                    v.split(',').map((s) => s.trim()).includes(p) ? v : (v ? `${v}, ${p}` : p),
                  )}
                  className="cursor-pointer rounded-md border border-line bg-bg2 px-2.5 py-1.5 font-mono text-[11.5px] text-dim transition-colors hover:border-teal/50 hover:text-teal"
                >
                  + {p}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-line/70 bg-bg2/50 px-3 py-2.5 text-[12px] leading-relaxed text-faint">
            <span className="mt-0.5 text-teal"><IconInfo size={14} /></span>
            Демо-режим: каждая проверка имитирует правки аналитика на странице (уточнения заказчика).
            Для FS-001 и FS-004 уже сохранены снапшоты версии 1 — первое же сравнение покажет diff.
          </p>
        </Panel>
      </Reveal>

      {/* Результаты проверки */}
      {Object.keys(results).length > 0 && (
        <div className="grid gap-5 xl:grid-cols-5">
          {/* Список страниц и снапшоты */}
          <Reveal className="xl:col-span-2" delay={60}>
            <Panel icon={<IconBook size={16} />} title="Проверенные страницы" sub="Снапшоты хранятся в data/snapshots/" pad={false}>
              <div className="flex flex-col divide-y divide-line/60">
                {Object.values(results).map((r) => (
                  <button
                    key={r.pageId}
                    onClick={() => setSelected(r.pageId)}
                    className={`flex cursor-pointer items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-bg2/70 ${selected === r.pageId ? 'bg-bg2/80' : ''}`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${r.error ? 'bg-coral' : r.changed ? 'bg-amber pulse-dot text-amber' : 'bg-grass'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[12.5px] font-semibold text-ink">{r.pageId}</span>
                        {r.title && <span className="truncate text-[12.5px] text-dim">{r.title}</span>}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-faint">
                        {r.error
                          ? <span className="text-coral">{r.error}</span>
                          : r.baselineOnly
                            ? `Baseline v${r.toV} сохранён · ${fmtDate(r.fetchedAt)}`
                            : r.changed
                              ? `v${r.fromV} → v${r.toV}: +${r.adds} −${r.dels} строк`
                              : `Без изменений (v${r.toV})`}
                      </span>
                    </span>
                    {r.changed && <Badge tone="amber">изменилось</Badge>}
                  </button>
                ))}
              </div>

              {/* История снапшотов выбранной страницы */}
              {selected && hist.length > 0 && (
                <div className="border-t border-line/70 px-5 py-4">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                    <IconClock size={13} /> Снапшоты {selected}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {[...hist].reverse().map((s, i) => (
                      <div key={s.date + s.version} className="flex items-center gap-2.5 rounded-md border border-line/60 bg-bg2/50 px-3 py-2">
                        <span className="font-mono text-[11.5px] font-semibold text-teal">v{s.version}</span>
                        <span className="text-[12px] text-dim">{fmtDate(s.date)}</span>
                        {i === 0 && <Badge tone="teal" className="ml-auto">текущий</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </Reveal>

          {/* Diff и действия */}
          <Reveal className="xl:col-span-3" delay={120}>
            <Panel
              icon={<IconDiff size={16} />}
              title={res && !res.error ? `${res.pageId} · ${res.title}` : 'Результат сравнения'}
              sub={res && !res.error
                ? `Confluence ID ${res.confluenceId} · версия v${res.fromV || '—'} → v${res.toV} · снято ${fmtDate(res.fetchedAt)}`
                : ' '}
              pad={false}
              actions={
                res && res.changed ? (
                  <span className="flex items-center gap-2">
                    <Badge tone="grass">+{res.adds}</Badge>
                    <Badge tone="coral">−{res.dels}</Badge>
                  </span>
                ) : undefined
              }
            >
              {!res && (
                <EmptyState icon={<IconDiff size={24} />} title="Выберите страницу" sub="Слева — результаты проверки страниц." />
              )}
              {res?.error && (
                <EmptyState icon={<IconDiff size={24} />} title="Ошибка загрузки" sub={res.error} />
              )}
              {res && !res.error && !res.changed && (
                <EmptyState
                  icon={<IconCheck size={24} />}
                  title={res.baselineOnly ? `Baseline-снапшот v${res.toV} сохранён` : `Изменений нет (v${res.toV})`}
                  sub={res.baselineOnly
                    ? 'Повторно скачайте страницу, когда аналитик внесёт правки — приложение покажет diff.'
                    : 'Содержимое страницы совпадает с последним снапшотом. Команда синхронизирована.'}
                />
              )}
              {res && !res.error && res.changed && (
                <div>
                  {/* Diff */}
                  <div className="max-h-[380px] overflow-auto border-b border-line/70 bg-bg0/50 px-5 py-4">
                    <div className="rounded-lg border border-line/70 bg-bg1 overflow-hidden">
                      {res.chunks.map((chunk, ci) => (
                        <div key={ci}>
                          {ci > 0 && (
                            <div className="dl-gap border-y border-line/50 px-4 py-1 text-center font-mono text-[11px]">
                              ··· неизменённые строки ···
                            </div>
                          )}
                          {chunk.lines.map((l, li) => (
                            <div
                              key={li}
                              className={`flex gap-3 px-4 py-[3px] font-mono text-[12px] leading-relaxed ${
                                l.type === 'add' ? 'dl-add' : l.type === 'del' ? 'dl-del' : 'dl-same'
                              }`}
                            >
                              <span className="w-3 shrink-0 select-none font-bold">
                                {l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '}
                              </span>
                              <span className="whitespace-pre-wrap break-words">{l.text || ' '}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Список действий */}
                  <div className="px-5 py-4">
                    <p className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                      <IconBolt size={13} /> Требуемые действия по синхронизации команды
                    </p>
                    <div className="flex flex-col gap-2">
                      {res.actions.map((a, i) => (
                        <button
                          key={i}
                          onClick={() => toggleAction(res.pageId, i)}
                          className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-[13px] transition-all ${
                            res.sel[i]
                              ? 'border-teal/40 bg-teal/[0.07] text-ink'
                              : 'border-line bg-bg2/40 text-faint line-through decoration-faint/50'
                          }`}
                        >
                          <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${res.sel[i] ? 'border-teal bg-teal text-[#062a23]' : 'border-line2'}`}>
                            {res.sel[i] && <IconCheck size={11} />}
                          </span>
                          {a}
                        </button>
                      ))}
                    </div>
                    {res.affectedReqs.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11.5px] text-faint">Затронутые требования:</span>
                        {res.affectedReqs.map((id) => (
                          <span key={id} className="rounded border border-line bg-bg2 px-1.5 py-0.5 font-mono text-[11px] text-sky">{id}</span>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <Button variant="primary" onClick={() => saveToJournal(res)}>
                        <IconSave size={15} />
                        Сохранить изменения в журнал
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Panel>
          </Reveal>
        </div>
      )}

      {Object.keys(results).length === 0 && (
        <Reveal delay={80}>
          <Panel>
            <EmptyState
              icon={<IconDoc size={24} />}
              title="Проверки ещё не запускались"
              sub="Введите ID фиче-страниц и нажмите «Скачать и сравнить». Приложение зафиксирует снапшот и подсветит правки аналитика, чтобы команда не пропустила изменения."
            />
          </Panel>
        </Reveal>
      )}

      {/* Журнал изменений */}
      <Reveal delay={140}>
        <Panel
          icon={<IconClock size={16} />}
          title="Журнал изменений"
          sub={`${journal.length} записей · уведомления команды о правках фиче-страниц`}
          pad={false}
          actions={
            <>
              <Button size="sm" variant="ghost" onClick={() => setJournalOpen((v) => !v)} disabled={journal.length === 0}>
                {journalOpen ? 'Свернуть' : 'Развернуть'}
              </Button>
              <Button
                size="sm"
                variant="accent"
                onClick={() => { exportChangeJournal(journal); notify('Журнал изменений экспортирован в change_journal.xlsx', 'ok'); }}
                disabled={journal.length === 0}
              >
                <IconDownload size={13} />
                Экспорт журнала
              </Button>
            </>
          }
        >
          {journal.length === 0 ? (
            <p className="px-5 py-6 text-center text-[13px] text-faint">
              Журнал пуст. Сохраните сюда обнаруженные изменения — они станут заданиями для аналитика, QA и разработчиков.
            </p>
          ) : (
            <div className={`divide-y divide-line/60 overflow-hidden transition-all ${journalOpen ? 'max-h-[420px] overflow-y-auto' : 'max-h-[180px]'}`}>
              {journal.map((e) => (
                <div key={e.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] font-semibold text-ink">{e.pageId}</span>
                    <Badge tone="amber">v{e.fromVersion} → v{e.toVersion}</Badge>
                    <Badge tone="grass">+{e.adds}</Badge>
                    <Badge tone="coral">−{e.dels}</Badge>
                    <span className="ml-auto text-[11.5px] text-faint">{fmtDate(e.ts)}</span>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1">
                    {e.actions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12.5px] text-dim">
                        <span className="mt-1 text-teal"><IconCheck size={11} /></span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}
