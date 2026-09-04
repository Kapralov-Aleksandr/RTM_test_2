// ============================================================
// Журнал новых требований (после baseline):
// ничего не теряется — каждая запись превращается в атомарное
// требование и попадает в матрицу, дерево и покрытие.
// ============================================================

import {
  CalendarDays, Clock, Download, Inbox, Plus, Sparkles, Trash2, Zap,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Badge, Button, EmptyState, Field, Input, PageHeader, Panel, Reveal, Select, Stat, Textarea, toast, type Tone } from '../components/ui';
import { NEWREQ_SOURCES, NEWREQ_STATUS_META, fmtDate } from '../domain/lifecycle';
import type { NewReqStatus } from '../domain/types';
import { exportNewRequirements } from '../lib/excel';
import { addNewReq, addRequirement, removeNewReq, updateNewReq, useApp } from '../services/db';

const emptyForm = {
  description: '',
  source: NEWREQ_SOURCES[0],
  date: new Date().toISOString().slice(0, 10),
  budgetHours: '0',
  termDays: '0',
  featureId: '',
  jiraKey: '',
  status: 'approved' as NewReqStatus,
};

export function NewReqs() {
  const state = useApp();
  const [form, setForm] = useState(emptyForm);
  const [fStatus, setFStatus] = useState('all');
  const [fSource, setFSource] = useState('all');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  const visible = useMemo(
    () => state.newReqs.filter((n) => {
      if (fStatus !== 'all' && n.status !== fStatus) return false;
      if (fSource !== 'all' && n.source !== fSource) return false;
      if (fFrom && n.date < fFrom) return false;
      if (fTo && n.date > fTo) return false;
      return true;
    }),
    [state.newReqs, fStatus, fSource, fFrom, fTo],
  );

  const stats = useMemo(() => ({
    count: visible.length,
    budget: visible.reduce((s, n) => s + n.budgetHours, 0),
    term: visible.reduce((s, n) => s + n.termDays, 0),
    done: visible.filter((n) => n.status === 'implemented').length,
  }), [visible]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const description = form.description.trim();
    if (!description) {
      toast('Заполните описание нового требования', 'err');
      return;
    }
    const created = addNewReq({
      description,
      source: form.source,
      date: form.date || new Date().toISOString().slice(0, 10),
      budgetHours: Math.max(0, Number(form.budgetHours) || 0),
      termDays: Math.max(0, Number(form.termDays) || 0),
      featureId: form.featureId,
      jiraKey: form.jiraKey.trim().toUpperCase(),
      status: form.status,
    });
    setForm(emptyForm);
    toast(`${created.code} добавлено в журнал`, 'ok');
  };

  /** Превратить запись журнала в атомарное требование */
  const createReq = (id: string) => {
    const nr = state.newReqs.find((n) => n.id === id);
    if (!nr) return;
    const req = addRequirement({
      title: nr.description.length > 90 ? `${nr.description.slice(0, 87)}…` : nr.description,
      descriptionMd: [
        `## Новое требование ${nr.code}`,
        nr.description,
        '',
        `- Источник: **${nr.source}** от ${fmtDate(nr.date)}`,
        `- Влияние на бюджет: **${nr.budgetHours} ч**`,
        `- Влияние на сроки: **${nr.termDays} дн**`,
        '',
        '> Требование добавлено после baseline — проверьте раздел ЧТЗ и тест-кейсы.',
      ].join('\n'),
      tzClause: '—',
      chtzSection: '',
      featureId: nr.featureId,
      jiraKey: nr.jiraKey,
      priority: 'should',
      status: 'draft',
      source: 'new',
      newReqId: nr.id,
    });
    updateNewReq(nr.id, { requirementId: req.id, status: nr.status === 'approved' ? 'in_work' : nr.status });
    toast(`Создано атомарное требование ${req.code} — оно появилось в матрице и дереве`, 'ok');
  };

  const fcode = (id: string) => state.features.find((f) => f.id === id)?.code ?? '';

  return (
    <div>
      <PageHeader
        title="Новые требования"
        sub="Боль «новые требования теряются» закрыта: каждая запись журнала одним кликом становится атомарным требованием и попадает в трассировку."
        actions={
          <Button variant="primary" onClick={() => { exportNewRequirements(visible, state); toast(`Экспортировано записей: ${visible.length}`, 'ok'); }} disabled={visible.length === 0}>
            <Download size={15} />
            Экспорт в Excel
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Записей" value={stats.count} sub="по текущим фильтрам" tone="teal" icon={<Inbox size={16} />} />
        <Stat label="Бюджет" value={stats.budget} suffix=" ч" sub="суммарное влияние на трудозатраты" tone="amber" icon={<Clock size={16} />} delay={60} />
        <Stat label="Сроки" value={stats.term} suffix=" дн" sub="суммарный сдвиг сроков" tone="coral" icon={<Zap size={16} />} delay={120} />
        <Stat label="Реализовано" value={stats.done} sub={`из ${stats.count} записей`} tone="grass" icon={<Sparkles size={16} />} delay={180} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-5">
        {/* Форма */}
        <Reveal className="xl:col-span-2">
          <Panel icon={<Plus size={16} />} title="Зафиксировать требование" sub="Письмо, совещание, уточнение — сначала в журнал" pad={false}>
            <form onSubmit={onSubmit} className="flex flex-col gap-3.5 p-5">
              <Field label="Описание">
                <Textarea
                  className="min-h-[84px] resize-y"
                  placeholder="Что запросил заказчик и почему это важно…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Источник">
                  <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                    {NEWREQ_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
                <Field label="Дата">
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Бюджет (часы)">
                  <Input type="number" min={0} className="font-mono" value={form.budgetHours} onChange={(e) => setForm({ ...form, budgetHours: e.target.value })} />
                </Field>
                <Field label="Сроки (дни)">
                  <Input type="number" min={0} className="font-mono" value={form.termDays} onChange={(e) => setForm({ ...form, termDays: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Фиче-страница">
                  <Select value={form.featureId} onChange={(e) => setForm({ ...form, featureId: e.target.value })}>
                    <option value="">— не выбрана —</option>
                    {state.features.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.title}</option>)}
                  </Select>
                </Field>
                <Field label="Задача Jira">
                  <Input className="font-mono" placeholder="ASU-…" value={form.jiraKey} onChange={(e) => setForm({ ...form, jiraKey: e.target.value.toUpperCase() })} />
                </Field>
              </div>
              <Field label="Статус">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as NewReqStatus })}>
                  {(Object.keys(NEWREQ_STATUS_META) as NewReqStatus[]).map((s) => (
                    <option key={s} value={s}>{NEWREQ_STATUS_META[s].label}</option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" variant="primary" className="mt-1">
                <Plus size={15} />
                Добавить в журнал
              </Button>
            </form>
          </Panel>
        </Reveal>

        {/* Журнал */}
        <Reveal className="xl:col-span-3" delay={80}>
          <Panel icon={<Inbox size={16} />} title="Журнал" sub={`${state.newReqs.length} всего · ${visible.length} по фильтрам`} pad={false}>
            <div className="flex flex-wrap items-center gap-2.5 border-b border-line/70 px-5 py-3">
              <Select className="w-auto" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="all">Все статусы</option>
                {(Object.keys(NEWREQ_STATUS_META) as NewReqStatus[]).map((s) => (
                  <option key={s} value={s}>{NEWREQ_STATUS_META[s].label}</option>
                ))}
              </Select>
              <Select className="w-auto" value={fSource} onChange={(e) => setFSource(e.target.value)}>
                <option value="all">Все источники</option>
                {NEWREQ_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <span className="text-[11.5px] text-faint">с</span>
              <Input type="date" className="w-auto px-2.5 py-1.5 text-[12.5px]" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
              <span className="text-[11.5px] text-faint">по</span>
              <Input type="date" className="w-auto px-2.5 py-1.5 text-[12.5px]" value={fTo} onChange={(e) => setFTo(e.target.value)} />
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
              <EmptyState icon={<Inbox size={24} />} title="Записей не найдено" sub="Измените фильтры или зафиксируйте новое требование через форму слева." />
            ) : (
              <div className="max-h-[560px] divide-y divide-line/60 overflow-y-auto">
                {visible.map((n) => (
                  <div key={n.id} className="mx-row group px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12.5px] font-bold text-teal">{n.code}</span>
                      <Badge tone={NEWREQ_STATUS_META[n.status].tone as Tone}>{NEWREQ_STATUS_META[n.status].label}</Badge>
                      <Badge tone="dim">{n.source}</Badge>
                      <span className="flex items-center gap-1 text-[11.5px] text-faint"><CalendarDays size={11} />{fmtDate(n.date)}</span>
                      <span className="ml-auto flex items-center gap-1.5">
                        <Select
                          className="w-[130px] px-2 py-1 text-[11.5px]"
                          value={n.status}
                          onChange={(e) => updateNewReq(n.id, { status: e.target.value as NewReqStatus })}
                        >
                          {(Object.keys(NEWREQ_STATUS_META) as NewReqStatus[]).map((s) => (
                            <option key={s} value={s}>{NEWREQ_STATUS_META[s].label}</option>
                          ))}
                        </Select>
                        <button
                          onClick={() => { removeNewReq(n.id); toast(`${n.code} удалено из журнала`, 'warn'); }}
                          className="cursor-pointer rounded p-1.5 text-faint opacity-0 transition-all hover:bg-coral/10 hover:text-coral group-hover:opacity-100"
                          title="Удалить запись"
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13.5px] leading-snug text-ink">{n.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-faint">
                      <span>Бюджет: <span className="font-mono font-semibold text-amber">+{n.budgetHours} ч</span></span>
                      <span>Сроки: <span className="font-mono font-semibold text-coral">+{n.termDays} дн</span></span>
                      {n.featureId && <span>Фича: <span className="font-mono text-dim">{fcode(n.featureId)}</span></span>}
                      {n.jiraKey && <span>Jira: <span className="font-mono text-sky">{n.jiraKey}</span></span>}
                      {n.requirementId ? (
                        <Badge tone="grass">
                          <Sparkles size={11} />
                          {state.requirements.find((r) => r.id === n.requirementId)?.code ?? 'REQ'} создано
                        </Badge>
                      ) : (
                        n.status !== 'rejected' && (
                          <button
                            onClick={() => createReq(n.id)}
                            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-teal/40 bg-teal/[0.07] px-2.5 py-1 text-[11.5px] font-semibold text-teal transition-all hover:bg-teal/15 active:scale-95"
                          >
                            <Plus size={12} />
                            Создать атомарное REQ
                          </button>
                        )
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
