// ============================================================
// Вкладка 4 «Новые требования»:
// журнал требований, появившихся после baseline,
// форма добавления, фильтры, статистика, экспорт
// ============================================================

import { useMemo, useState, type FormEvent } from 'react';
import type { NewReqStatus, NewRequirement, Requirement } from '../types';
import { DEMO_NEW_REQS, NEW_REQ_SOURCES, NEW_REQ_STATUS_LABEL } from '../data/demo';
import { load, save } from '../lib/storage';
import { exportNewRequirements } from '../lib/excel';
import { Badge, Button, EmptyState, Field, Panel, Reveal, Stat, inputCls, selectCls, type Tone } from './ui';
import {
  IconBolt, IconChevron, IconClock, IconDoc, IconDownload, IconJira, IconPlus, IconTrash,
} from './icons';

const statusTone: Record<NewReqStatus, Tone> = {
  approved: 'sky',
  work: 'amber',
  rejected: 'coral',
  implemented: 'grass',
};

const emptyForm = {
  rid: '',
  description: '',
  source: NEW_REQ_SOURCES[0],
  date: new Date().toISOString().slice(0, 10),
  budgetHours: '0',
  termDays: '0',
  page: '',
  jiraKey: '',
  status: 'approved' as NewReqStatus,
};

export function NewReqTab({
  matrix,
  notify,
}: {
  matrix: Requirement[];
  notify: (msg: string, tone?: 'ok' | 'warn' | 'err') => void;
}) {
  const [items, setItems] = useState<NewRequirement[]>(() => {
    const stored = load<NewRequirement[] | null>('newReqs', null);
    return stored ?? DEMO_NEW_REQS;
  });
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(true);
  const [fStatus, setFStatus] = useState('all');
  const [fSource, setFSource] = useState('all');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  const pages = useMemo(() => [...new Set(matrix.map((r) => r.page).filter(Boolean))].sort(), [matrix]);

  const persist = (next: NewRequirement[]) => {
    setItems(next);
    save('newReqs', next);
  };

  // ---------- Добавление ----------
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const rid = form.rid.trim().toUpperCase();
    const description = form.description.trim();
    if (!rid) { notify('Укажите ID требования (например REQ-N05)', 'err'); return; }
    if (!description) { notify('Заполните описание требования', 'err'); return; }
    if (items.some((i) => i.rid.toUpperCase() === rid)) {
      notify(`Требование ${rid} уже есть в журнале`, 'err');
      return;
    }
    const item: NewRequirement = {
      rid,
      description,
      source: form.source,
      date: form.date || new Date().toISOString().slice(0, 10),
      budgetHours: Math.max(0, Number(form.budgetHours) || 0),
      termDays: Math.max(0, Number(form.termDays) || 0),
      page: form.page.trim().toUpperCase(),
      jiraKey: form.jiraKey.trim().toUpperCase(),
      status: form.status,
    };
    persist([item, ...items]);
    setForm({ ...emptyForm, rid: '' });
    notify(`${rid} добавлено в журнал новых требований`, 'ok');
  };

  const remove = (rid: string) => {
    persist(items.filter((i) => i.rid !== rid));
    notify(`${rid} удалено из журнала`, 'warn');
  };

  const changeStatus = (rid: string, status: NewReqStatus) => {
    persist(items.map((i) => (i.rid === rid ? { ...i, status } : i)));
  };

  // ---------- Фильтрация ----------
  const visible = useMemo(() => {
    return items.filter((i) => {
      if (fStatus !== 'all' && i.status !== fStatus) return false;
      if (fSource !== 'all' && i.source !== fSource) return false;
      if (fFrom && i.date < fFrom) return false;
      if (fTo && i.date > fTo) return false;
      return true;
    });
  }, [items, fStatus, fSource, fFrom, fTo]);

  // ---------- Статистика по периоду ----------
  const stats = useMemo(() => {
    const budget = visible.reduce((s, i) => s + i.budgetHours, 0);
    const term = visible.reduce((s, i) => s + i.termDays, 0);
    const done = visible.filter((i) => i.status === 'implemented').length;
    return { count: visible.length, budget, term, done };
  }, [visible]);

  return (
    <div className="flex flex-col gap-5">
      {/* Статистика */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Новых требований" value={stats.count} sub="за выбранный период / по фильтрам" tone="teal" icon={<IconPlus size={16} />} />
        <Stat label="Влияние на бюджет" value={stats.budget} suffix=" ч" sub="суммарная оценка трудозатрат" tone="amber" icon={<IconClock size={16} />} delay={60} />
        <Stat label="Влияние на сроки" value={stats.term} suffix=" дн" sub="суммарный сдвиг сроков проекта" tone="coral" icon={<IconBolt size={16} />} delay={120} />
        <Stat label="Реализовано" value={stats.done} sub={`из ${stats.count} новых требований`} tone="grass" icon={<IconDoc size={16} />} delay={180} />
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        {/* Форма добавления */}
        <Reveal className="xl:col-span-2">
          <Panel
            icon={<IconPlus size={16} />}
            title="Новое требование"
            sub="Появилось после baseline — зафиксируйте, чтобы не потерять"
            pad={false}
            actions={
              <button onClick={() => setFormOpen((v) => !v)} className="cursor-pointer text-faint transition-colors hover:text-ink" aria-label="Свернуть форму">
                <IconChevron size={18} className={`transition-transform ${formOpen ? 'rotate-180' : ''}`} />
              </button>
            }
          >
            {formOpen && (
              <form onSubmit={onSubmit} className="flex flex-col gap-3.5 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ID требования">
                    <input className={inputCls + ' font-mono'} placeholder="REQ-N05" value={form.rid}
                      onChange={(e) => setForm({ ...form, rid: e.target.value })} />
                  </Field>
                  <Field label="Дата">
                    <input type="date" className={inputCls} value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </Field>
                </div>
                <Field label="Описание">
                  <textarea
                    className={inputCls + ' min-h-[76px] resize-y'}
                    placeholder="Что запросил заказчик и почему это важно…"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Источник">
                    <select className={selectCls + ' w-full'} value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value })}>
                      {NEW_REQ_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Статус">
                    <select className={selectCls + ' w-full'} value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as NewReqStatus })}>
                      {(Object.keys(NEW_REQ_STATUS_LABEL) as NewReqStatus[]).map((s) => (
                        <option key={s} value={s}>{NEW_REQ_STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Бюджет (часы)">
                    <input type="number" min={0} className={inputCls + ' font-mono'} value={form.budgetHours}
                      onChange={(e) => setForm({ ...form, budgetHours: e.target.value })} />
                  </Field>
                  <Field label="Сроки (дни)">
                    <input type="number" min={0} className={inputCls + ' font-mono'} value={form.termDays}
                      onChange={(e) => setForm({ ...form, termDays: e.target.value })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Фиче-страница">
                    <>
                      <input list="rt-pages" className={inputCls + ' font-mono'} placeholder="FS-002" value={form.page}
                        onChange={(e) => setForm({ ...form, page: e.target.value })} />
                      <datalist id="rt-pages">
                        {pages.map((p) => <option key={p} value={p} />)}
                      </datalist>
                    </>
                  </Field>
                  <Field label="Задача Jira">
                    <input className={inputCls + ' font-mono'} placeholder="ASU-350" value={form.jiraKey}
                      onChange={(e) => setForm({ ...form, jiraKey: e.target.value })} />
                  </Field>
                </div>
                <Button type="submit" variant="primary" className="mt-1 w-full">
                  <IconPlus size={15} />
                  Добавить в журнал
                </Button>
              </form>
            )}
          </Panel>
        </Reveal>

        {/* Журнал */}
        <Reveal className="xl:col-span-3" delay={80}>
          <Panel
            icon={<IconDoc size={16} />}
            title="Журнал новых требований"
            sub={`${items.length} в журнале · ${visible.length} по фильтрам`}
            pad={false}
            actions={
              <Button
                size="sm"
                variant="accent"
                onClick={() => { exportNewRequirements(visible); notify(`Экспортировано записей: ${visible.length}`, 'ok'); }}
                disabled={visible.length === 0}
              >
                <IconDownload size={13} />
                Экспорт в Excel
              </Button>
            }
          >
            {/* Фильтры */}
            <div className="flex flex-wrap items-center gap-2.5 border-b border-line/70 px-5 py-3">
              <select className={selectCls} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="all">Все статусы</option>
                {(Object.keys(NEW_REQ_STATUS_LABEL) as NewReqStatus[]).map((s) => (
                  <option key={s} value={s}>{NEW_REQ_STATUS_LABEL[s]}</option>
                ))}
              </select>
              <select className={selectCls} value={fSource} onChange={(e) => setFSource(e.target.value)}>
                <option value="all">Все источники</option>
                {NEW_REQ_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="text-[11.5px] text-faint">с</span>
              <input type="date" className={inputCls + ' w-auto px-2.5 py-1.5 text-[12.5px]'} value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
              <span className="text-[11.5px] text-faint">по</span>
              <input type="date" className={inputCls + ' w-auto px-2.5 py-1.5 text-[12.5px]'} value={fTo} onChange={(e) => setFTo(e.target.value)} />
              {(fStatus !== 'all' || fSource !== 'all' || fFrom || fTo) && (
                <button
                  onClick={() => { setFStatus('all'); setFSource('all'); setFFrom(''); setFTo(''); }}
                  className="cursor-pointer text-[12px] font-semibold text-teal transition-colors hover:text-ink"
                >
                  Сбросить
                </button>
              )}
            </div>

            {visible.length === 0 ? (
              <EmptyState
                icon={<IconDoc size={24} />}
                title="Записей не найдено"
                sub="Измените фильтры или добавьте новое требование через форму слева."
              />
            ) : (
              <div className="max-h-[520px] divide-y divide-line/60 overflow-y-auto">
                {visible.map((i) => (
                  <div key={i.rid} className="mx-row group px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12.5px] font-bold text-teal">{i.rid}</span>
                      <Badge tone={statusTone[i.status]}>{NEW_REQ_STATUS_LABEL[i.status]}</Badge>
                      <Badge tone="dim">{i.source}</Badge>
                      <span className="text-[11.5px] text-faint">
                        {new Date(i.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                      <span className="ml-auto flex items-center gap-1.5">
                        <select
                          className="cursor-pointer rounded border border-line bg-bg2 px-1.5 py-1 text-[11px] text-dim outline-none transition-colors hover:border-teal/50"
                          value={i.status}
                          onChange={(e) => changeStatus(i.rid, e.target.value as NewReqStatus)}
                          title="Сменить статус"
                        >
                          {(Object.keys(NEW_REQ_STATUS_LABEL) as NewReqStatus[]).map((s) => (
                            <option key={s} value={s}>{NEW_REQ_STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => remove(i.rid)}
                          className="cursor-pointer rounded p-1 text-faint opacity-0 transition-all hover:bg-coral/10 hover:text-coral group-hover:opacity-100"
                          title="Удалить запись"
                        >
                          <IconTrash size={14} />
                        </button>
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13.5px] leading-snug text-ink">{i.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-faint">
                      <span>Бюджет: <span className="font-mono font-semibold text-amber">+{i.budgetHours} ч</span></span>
                      <span>Сроки: <span className="font-mono font-semibold text-coral">+{i.termDays} дн</span></span>
                      {i.page && <span className="flex items-center gap-1">Страница: <span className="font-mono text-dim">{i.page}</span></span>}
                      {i.jiraKey && (
                        <span className="flex items-center gap-1 text-sky">
                          <IconJira size={12} />
                          <span className="font-mono">{i.jiraKey}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
