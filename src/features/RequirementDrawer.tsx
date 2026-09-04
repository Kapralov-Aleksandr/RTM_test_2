// ============================================================
// Шторка редактирования атомарного требования
// (используется матрицей и деревом требований)
// ============================================================

import { Link2, Save, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { Badge, Button, Drawer, Field, Input, Select, toast, type Tone } from '../components/ui';
import {
  PRIORITY_META, REQ_STATUS_META, TEST_STATUS_META, fmtDateTime, testsByRequirement,
} from '../domain/lifecycle';
import type { Priority, ReqStatus, Requirement } from '../domain/types';
import { saveRequirement, useApp } from '../services/db';

export function RequirementDrawer({ reqId, onClose }: { reqId: string | null; onClose: () => void }) {
  const state = useApp();
  const req = state.requirements.find((r) => r.id === reqId) ?? null;
  const [draft, setDraft] = useState<Requirement | null>(req);

  // Перезагружаем черновик при смене требования
  useEffect(() => {
    setDraft(state.requirements.find((r) => r.id === reqId) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqId]);

  if (!reqId || !req || !draft) {
    return <Drawer open={false} onClose={onClose} title="">{null}</Drawer>;
  }

  const feature = state.features.find((f) => f.id === draft.featureId);
  const tests = (testsByRequirement(state).get(req.id) ?? []);
  const newReq = req.newReqId ? state.newReqs.find((n) => n.id === req.newReqId) : null;

  const onSave = () => {
    if (!draft.title.trim()) {
      toast('Название требования не может быть пустым', 'err');
      return;
    }
    saveRequirement({ ...draft, title: draft.title.trim(), updatedAt: new Date().toISOString() });
    toast(`${draft.code} сохранено. Матрица и покрытие пересчитаны.`, 'ok');
    onClose();
  };

  return (
    <Drawer
      open={!!reqId}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <span className="font-mono text-teal">{req.code}</span>
          <span className="truncate">{req.title}</span>
        </span>
      }
      sub={`Изменено ${fmtDateTime(req.updatedAt)} · источник: ${req.source === 'new' ? 'новое требование' : 'baseline ТЗ'}`}
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        <Field label="Название">
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Статус">
            <Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ReqStatus })}>
              {(Object.keys(REQ_STATUS_META) as ReqStatus[]).map((s) => (
                <option key={s} value={s}>{REQ_STATUS_META[s].label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Приоритет (MoSCoW)">
            <Select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as Priority })}>
              {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_META[p].label}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Пункт ТЗ">
            <Input className="font-mono" value={draft.tzClause} onChange={(e) => setDraft({ ...draft, tzClause: e.target.value })} />
          </Field>
          <Field label="Раздел ЧТЗ">
            <Input className="font-mono" placeholder="пробел!" value={draft.chtzSection} onChange={(e) => setDraft({ ...draft, chtzSection: e.target.value })} />
          </Field>
          <Field label="Задача Jira">
            <Input className="font-mono" placeholder="ASU-…" value={draft.jiraKey} onChange={(e) => setDraft({ ...draft, jiraKey: e.target.value.toUpperCase() })} />
          </Field>
        </div>

        <Field label="Фиче-страница (Confluence)">
          <Select value={draft.featureId} onChange={(e) => setDraft({ ...draft, featureId: e.target.value })}>
            <option value="">— не привязано —</option>
            {state.features.map((f) => (
              <option key={f.id} value={f.id}>{f.code} · {f.title}</option>
            ))}
          </Select>
        </Field>

        <Field label="Описание и критерии приёмки (Markdown)">
          <MarkdownEditor value={draft.descriptionMd} onChange={(v) => setDraft({ ...draft, descriptionMd: v })} />
        </Field>

        {/* Связанные артефакты */}
        <div className="rounded-lg border border-line/70 bg-bg2/40 p-4">
          <p className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
            <Link2 size={13} /> Трассировка
          </p>
          <div className="flex flex-col gap-2 text-[12.5px]">
            <div className="flex items-center gap-2">
              <span className="w-[110px] text-faint">Тест-кейсы ПМИ</span>
              {tests.length > 0 ? (
                tests.map((t) => (
                  <Badge key={t.id} tone={TEST_STATUS_META[t.status].tone as Tone}>{t.code}</Badge>
                ))
              ) : (
                <Badge tone="coral">нет покрытия тестами</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-[110px] text-faint">ЧТЗ</span>
              {draft.chtzSection
                ? <Badge tone="sky">{draft.chtzSection}</Badge>
                : <Badge tone="coral">пробел — не отражено в ЧТЗ</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-[110px] text-faint">Jira</span>
              {draft.jiraKey
                ? <Badge tone="amber">{draft.jiraKey}{feature ? '' : ''}</Badge>
                : <Badge tone="amber">задача не заведена</Badge>}
            </div>
            {newReq && (
              <div className="flex items-center gap-2">
                <span className="w-[110px] text-faint">Новое требование</span>
                <Badge tone="teal"><Sparkles size={11} /> {newReq.code} · {newReq.source}</Badge>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 border-t border-line/70 bg-bg1/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11.5px] text-faint">Сохранение пересчитает покрытие во всех отчётах.</p>
            <Button variant="primary" onClick={onSave}>
              <Save size={15} />
              Сохранить
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
