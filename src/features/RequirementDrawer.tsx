// ============================================================
// Форма создания/редактирования атомарного требования.
// При создании — живой предпросмотр автоключа REQ-KEY-TYPE-NNNN.
// «💾 Сохранить» обновляет updated_at → статусы актуальности
// сбрасываются (как в спецификации).
// ============================================================

import { Save, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Drawer, Field, InfoNote, Input, Select, Textarea, toast, type Tone } from '../components/ui';
import { REQ_TYPE_LABEL, REQ_TYPE_TONE, fsStatus, nextReqKey, testsStatus, VALIDITY_META } from '../domain/logic';
import type { ReqType, Requirement, RequirementDraft } from '../domain/types';
import { addRequirement, updateRequirement, useApp } from '../services/db';

const empty: RequirementDraft = {
  reqType: 'FUNCTIONAL', title: '', description: '', linkTz: '', linkChtz: '',
  release: '1.0', notes: '', dependencies: '',
};

export function RequirementDrawer({ open, req, onClose }: { open: boolean; req: Requirement | null; onClose: () => void }) {
  const state = useApp();
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  const [draft, setDraft] = useState<RequirementDraft>(empty);

  useEffect(() => {
    if (req) {
      setDraft({
        reqType: req.reqType, title: req.title, description: req.description,
        linkTz: req.linkTz, linkChtz: req.linkChtz, release: req.release,
        notes: req.notes, dependencies: req.dependencies,
      });
    } else {
      setDraft(empty);
    }
  }, [req]);

  const projectReqs = state.requirements.filter((r) => r.projectId === state.activeProjectId);
  const previewKey = req ? req.reqKey : nextReqKey(projectReqs, project?.jiraKey ?? 'PRJ', draft.reqType);

  const set = <K extends keyof RequirementDraft>(k: K, v: RequirementDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const onSave = () => {
    if (!draft.title.trim()) {
      toast('Название требования обязательно', 'err');
      return;
    }
    if (req) {
      updateRequirement(req.id, draft);
      toast(`${req.reqKey} сохранено: updated_at обновлён, статусы актуальности сброшены`, 'warn');
    } else {
      const created = addRequirement(state.activeProjectId, draft);
      toast(`Создано требование ${created.reqKey}`, 'ok');
    }
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          {req ? 'Редактирование требования' : '➕ Новое требование'}
          <Badge tone="dim" className="font-mono">{previewKey}</Badge>
        </span>
      }
      sub={req
        ? `Создано ${new Date(req.createdAt).toLocaleDateString('ru-RU')} · сохранение сбросит статусы актуальности`
        : `Проект «${project?.name ?? ''}» · ID будет сгенерирован автоматически`}
      width={600}
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        {!req && (
          <InfoNote>
            Автогенерация ID: <span className="font-mono text-teal">REQ-{project?.jiraKey ?? 'KEY'}-{'{BUS|FUNC|NFUNC}'}-{'{NNNN}'}</span> —
            номер выдаётся по порядку внутри проекта и типа.
          </InfoNote>
        )}
        {req && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line/70 bg-bg2/40 px-3.5 py-2.5">
            <span className="text-[11.5px] text-faint">Текущие статусы:</span>
            <Badge tone={VALIDITY_META[fsStatus(req)].tone as Tone}>{`ФС: ${VALIDITY_META[fsStatus(req)].label}`}</Badge>
            <Badge tone={VALIDITY_META[testsStatus(req)].tone as Tone}>{`Тесты: ${VALIDITY_META[testsStatus(req)].label}`}</Badge>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Тип требования">
            <Select value={draft.reqType} onChange={(e) => set('reqType', e.target.value as ReqType)}>
              {(Object.keys(REQ_TYPE_LABEL) as ReqType[]).map((t) => (
                <option key={t} value={t}>{REQ_TYPE_LABEL[t]} · {t === 'BUSINESS' ? 'BUS' : t === 'FUNCTIONAL' ? 'FUNC' : 'NFUNC'}</option>
              ))}
            </Select>
          </Field>
          <Field label="Релиз">
            <Input value={draft.release} placeholder="1.0" onChange={(e) => set('release', e.target.value)} />
          </Field>
        </div>

        <Field label="Название">
          <Input
            autoFocus
            placeholder="Краткая суть требования"
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>

        <Field label="Описание">
          <Textarea
            className="min-h-[110px] resize-y"
            placeholder="Полная формулировка, критерии приёмки…"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Ссылка на ТЗ">
            <Input className="font-mono text-[12.5px]" placeholder="ТЗ §3.1" value={draft.linkTz} onChange={(e) => set('linkTz', e.target.value)} />
          </Field>
          <Field label="Ссылка на ЧТЗ">
            <Input className="font-mono text-[12.5px]" placeholder="ЧТЗ 4.1" value={draft.linkChtz} onChange={(e) => set('linkChtz', e.target.value)} />
          </Field>
        </div>

        <Field label="Зависимости (ключи требований через запятую)">
          <Input className="font-mono text-[12.5px]" placeholder="REQ-LC-FUNC-0001" value={draft.dependencies} onChange={(e) => set('dependencies', e.target.value)} />
        </Field>

        <Field label="Примечание">
          <Textarea className="min-h-[64px] resize-y" placeholder="Ограничения, вопросы, договорённости…" value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        {!req && (
          <p className="flex items-center gap-2 rounded-lg border border-teal/30 bg-teal/[0.06] px-3.5 py-2.5 text-[12.5px] text-dim">
            <Sparkles size={14} className="shrink-0 text-teal" />
            Будет создано: <span className="font-mono font-bold text-teal">{previewKey}</span>
            <Badge tone={REQ_TYPE_TONE[draft.reqType] as Tone}>{REQ_TYPE_LABEL[draft.reqType]}</Badge>
          </p>
        )}

        <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-2.5 border-t border-line/70 bg-bg1 px-6 py-4">
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={onSave}>
            <Save size={14} />
            💾 Сохранить
          </Button>
        </div>
      </div>
    </Drawer>
  );
}


