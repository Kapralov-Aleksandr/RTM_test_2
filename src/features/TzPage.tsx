// ============================================================
// Таб 1 · Исходное ТЗ заказчика:
// TipTap-редактор, выделение текста → «📌 Зафиксировать как
// требование», голубая подсветка с tooltip, клик → Таб 2,
// загрузка файла ТЗ, сохранение документа и связей в БД.
// ============================================================

import { Download, FileUp, Loader2, Pin, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Editor } from '@tiptap/react';
import { extractMentions, RichEditor } from '../components/Editor';
import {
  Badge, Button, Dialog, Field, InfoNote, Input, PageHeader, Panel, Reveal, Select, toast,
} from '../components/ui';
import { REQ_TYPE_LABEL } from '../domain/logic';
import type { ReqType } from '../domain/types';
import { addRequirement, saveTzDoc, uploadTzAttachment, useApp } from '../services/db';

export function TzPage() {
  const state = useApp();
  const navigate = useNavigate();
  const doc = state.tzDoc;
  const project = state.projects.find((p) => p.id === state.activeProjectId);

  const editorRef = useRef<Editor | null>(null);
  const [title, setTitle] = useState(doc?.title ?? 'Техническое задание');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [capture, setCapture] = useState<{ text: string } | null>(null);
  const [capType, setCapType] = useState<ReqType>('FUNCTIONAL');
  const [capTitle, setCapTitle] = useState('');
  const [mentionCount, setMentionCount] = useState(doc?.mentions.length ?? 0);

  // При смене проекта — сбрасываем локальные поля
  useEffect(() => {
    setTitle(state.tzDoc?.title ?? 'Техническое задание');
    setMentionCount(state.tzDoc?.mentions.length ?? 0);
  }, [state.activeProjectId, state.tzDoc]);

  const projectReqs = state.requirements.filter((r) => r.projectId === state.activeProjectId);

  /** 💾 Сохранить документ + все связи «текст ↔ требование» */
  const onSave = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    setSaving(true);
    try {
      const mentions = extractMentions(editor);
      await saveTzDoc(title.trim() || 'Техническое задание', editor.getHTML(), mentions);
      setMentionCount(mentions.length);
      toast(`ТЗ сохранено: ${mentions.length} фиксаций «текст → требование» записано в tz_requirement_mentions`, 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось сохранить документ', 'err');
    } finally {
      setSaving(false);
    }
  };

  /** 📌 Фиксация: создаём требование и оборачиваем выделение mark-подсветкой */
  const confirmCapture = async () => {
    const editor = editorRef.current;
    if (!editor || !capture) return;
    const name = capTitle.trim();
    if (!name) { toast('Укажите название требования', 'err'); return; }
    try {
      const created = await addRequirement(state.activeProjectId, {
        reqType: capType, title: name,
        description: capture.text.length > 300 ? capture.text.slice(0, 297) + '…' : capture.text,
        linkTz: `ТЗ «${title.trim()}»`, linkChtz: '', release: '1.0', notes: 'Зафиксировано выделением из ТЗ (Таб 1)', dependencies: '',
      });
      if (created) {
        editor.chain().focus().setMark('req', { reqId: created.id, reqKey: created.reqKey }).run();
        toast(`Требование ${created.reqKey} создано и подсвечено в тексте`, 'ok');
      }
      setCapture(null);
      setCapTitle('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось создать требование', 'err');
    }
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await uploadTzAttachment(file);
      toast(`Файл «${r?.name}» сохранён в data/attachments`, 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось загрузить файл', 'err');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Таб 1 · Исходное ТЗ заказчика"
        sub="Выделите фрагмент текста мышкой — появится кнопка «📌 Зафиксировать как требование». Подсвеченный текст связан с требованием: наведение показывает ключ, клик открывает Таб 2."
        actions={
          <>
            <Badge tone="sky">фиксаций: {mentionCount}</Badge>
            <Button variant="primary" onClick={() => void onSave()} disabled={saving}>
              {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
              💾 Сохранить
            </Button>
          </>
        }
      />

      <Reveal>
        <Panel pad={false} icon={<FileUp size={16} />} title={doc?.title ?? 'Документ ТЗ'} sub={`Проект «${project?.name ?? ''}» · содержимое хранится в tz_documents.content`}>
          <div className="border-b border-line/70 px-5 py-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название документа ТЗ" className="font-semibold" />
          </div>

          <div
            onClick={(e) => {
              // Клик по подсвеченному фрагменту → переход к требованию в Табе 2
              const el = (e.target as HTMLElement).closest('[data-req-key]');
              const key = el?.getAttribute('data-req-key');
              if (key && (el as HTMLElement).classList.contains('req-hl')) {
                navigate(`/matrix?req=${encodeURIComponent(key)}`);
              }
            }}
          >
            <RichEditor
              key={`${state.activeProjectId}-tz`}
              initialContent={doc?.content ?? ''}
              captureMode
              requirements={projectReqs}
              onReady={(ed) => { editorRef.current = ed; }}
              onCapture={(text) => { setCapture({ text }); setCapTitle(text.length > 120 ? text.slice(0, 117) + '…' : text); }}
              placeholder="Вставьте или наберите текст технического задания…"
            />
          </div>

          {/* Вложение: файл ТЗ */}
          <div className="flex flex-wrap items-center gap-3 border-t border-line/70 px-5 py-3.5">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12.5px] font-semibold text-dim transition-colors hover:border-teal/50 hover:text-teal">
              {uploading ? <Loader2 size={14} className="spin" /> : <FileUp size={14} />}
              Загрузить файл ТЗ (PDF/DOCX/TXT)
              <input type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={(e) => { void onUpload(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            {doc?.attachment && (
              <a
                href={doc.attachment.url}
                download={doc.attachment.name}
                className="flex items-center gap-2 rounded-lg border border-sky/40 bg-sky/[0.07] px-3 py-2 text-[12.5px] font-semibold text-sky transition-all hover:bg-sky/15"
              >
                <Download size={14} />
                {doc.attachment.name}
              </a>
            )}
            <span className="ml-auto text-[11.5px] text-faint">вложения → data/attachments/</span>
          </div>
        </Panel>
      </Reveal>

      <Reveal delay={80}>
        <div className="mt-5">
          <InfoNote>
            При сохранении документ и все подсвеченные фрагменты записываются в БД: содержимое — в <span className="font-mono text-dim">tz_documents</span>,
            связи «текст ↔ требование» (с offset'ами начала и конца) — в <span className="font-mono text-dim">tz_requirement_mentions</span>.
          </InfoNote>
        </div>
      </Reveal>

      {/* Диалог фиксации требования */}
      <Dialog open={!!capture} onClose={() => setCapture(null)} title="📌 Зафиксировать как требование" width={480}>
        {capture && (
          <div className="flex flex-col gap-3.5">
            <div className="max-h-[110px] overflow-y-auto rounded-lg border border-sky/30 bg-sky/[0.06] px-3.5 py-2.5 text-[12.5px] italic leading-relaxed text-dim">
              «{capture.text}»
            </div>
            <Field label="Тип требования">
              <Select value={capType} onChange={(e) => setCapType(e.target.value as ReqType)}>
                {(Object.keys(REQ_TYPE_LABEL) as ReqType[]).map((t) => (
                  <option key={t} value={t}>{REQ_TYPE_LABEL[t]} · {t === 'BUSINESS' ? 'BUS' : t === 'FUNCTIONAL' ? 'FUNC' : 'NFUNC'}</option>
                ))}
              </Select>
            </Field>
            <Field label="Название требования">
              <Input autoFocus value={capTitle} onChange={(e) => setCapTitle(e.target.value)} placeholder="Краткая суть выделенного фрагмента" />
            </Field>
            <p className="text-[11.5px] leading-relaxed text-faint">
              Ключ сгенерируется автоматически (REQ-{project?.jiraKey ?? 'KEY'}-…), фрагмент будет подсвечен голубым и связан с новым требованием.
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setCapture(null)}>Отмена</Button>
              <Button variant="primary" onClick={() => void confirmCapture()}><Pin size={14} />Зафиксировать</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
