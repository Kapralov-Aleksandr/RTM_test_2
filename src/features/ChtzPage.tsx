// ============================================================
// Таб 3 · ЧТЗ (аналитическая документация):
// TipTap-редактор с @-autocomplete: ввод «@REQ-» показывает
// список требований из Таба 2, выбор вставляет кликабельный бейдж.
// ============================================================

import { AtSign, Loader2, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Editor } from '@tiptap/react';
import { RichEditor } from '../components/Editor';
import { Badge, Button, Field, InfoNote, Input, PageHeader, Panel, Reveal, toast } from '../components/ui';
import { saveChtzDoc, useApp } from '../services/db';

/** Извлечение бейджей @-упоминаний из HTML-контента редактора */
function extractBadges(html: string): string[] {
  const keys = new Set<string>();
  const re = /data-req-key="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) keys.add(m[1]);
  return [...keys];
}

export function ChtzPage() {
  const state = useApp();
  const navigate = useNavigate();
  const doc = state.chtzDoc;
  const project = state.projects.find((p) => p.id === state.activeProjectId);

  const editorRef = useRef<Editor | null>(null);
  const [title, setTitle] = useState(doc?.title ?? 'ЧТЗ');
  const [saving, setSaving] = useState(false);
  const [badges, setBadges] = useState<string[]>(() => extractBadges(doc?.content ?? ''));

  useEffect(() => {
    setTitle(state.chtzDoc?.title ?? 'ЧТЗ');
    setBadges(extractBadges(state.chtzDoc?.content ?? ''));
  }, [state.activeProjectId, state.chtzDoc]);

  const projectReqs = state.requirements.filter((r) => r.projectId === state.activeProjectId);

  const onSave = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    setSaving(true);
    try {
      const html = editor.getHTML();
      await saveChtzDoc(title.trim() || 'ЧТЗ', html);
      setBadges(extractBadges(html));
      toast(`ЧТЗ сохранено в chtz_documents (упоминаний требований: ${extractBadges(html).length})`, 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось сохранить документ', 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Таб 3 · ЧТЗ"
        sub="Наберите «@REQ-» в тексте — появится autocomplete требований из Таба 2. Выбранный пункт вставляется бейджем; клик по бейджу открывает требование."
        actions={
          <Button variant="primary" onClick={() => void onSave()} disabled={saving}>
            {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
            💾 Сохранить
          </Button>
        }
      />

      <Reveal>
        <Panel pad={false} icon={<AtSign size={16} />} title={doc?.title ?? 'Документ ЧТЗ'} sub={`Проект «${project?.name ?? ''}» · привязка требований через @-упоминания`}>
          <div className="border-b border-line/70 px-5 py-3">
            <Field label="Название документа">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ЧТЗ · Личный кабинет абитуриента" className="font-semibold" />
            </Field>
          </div>

          <div
            onClick={(e) => {
              // Клик по бейджу требования → переход в Таб 2
              const el = (e.target as HTMLElement).closest('.req-badge');
              const key = el?.getAttribute('data-req-key');
              if (key) navigate(`/matrix?req=${encodeURIComponent(key)}`);
            }}
          >
            <RichEditor
              key={`${state.activeProjectId}-chtz`}
              initialContent={doc?.content ?? ''}
              mentionAutocomplete
              requirements={projectReqs}
              onReady={(ed) => { editorRef.current = ed; }}
              placeholder="Разделы ЧТЗ… введите @REQ- для ссылки на требование"
            />
          </div>

          {/* Связанные требования */}
          <div className="border-t border-line/70 px-5 py-3.5">
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-faint">Связанные требования ({badges.length})</p>
            {badges.length === 0 ? (
              <p className="text-[12.5px] text-faint">Пока нет ни одного @-упоминания. Начните вводить «@REQ-» в тексте документа.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {badges.map((key) => {
                  const req = projectReqs.find((r) => r.reqKey === key);
                  return (
                    <button
                      key={key}
                      onClick={() => navigate(`/matrix?req=${encodeURIComponent(key)}`)}
                      title={req?.title ?? 'Открыть требование в Табе 2'}
                      className="cursor-pointer rounded-lg border border-teal/40 bg-teal/[0.07] px-2.5 py-1.5 font-mono text-[12px] font-bold text-teal transition-all hover:-translate-y-0.5 hover:bg-teal/15 active:scale-95"
                    >
                      ⌗ {key}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      </Reveal>

      <Reveal delay={80}>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <InfoNote>
            Автоподстановка ищет по ключу и названию: <Badge tone="teal" className="font-mono">@REQ-LC-FUNC</Badge> — все функциональные
            требования проекта LC; <Badge tone="teal" className="font-mono">@регистр</Badge> — по фрагменту названия.
          </InfoNote>
          <InfoNote>
            При сохранении контент и бейджи пишутся в <span className="font-mono text-dim">chtz_documents</span>; список связанных требований
            выше извлекается из разметки автоматически.
          </InfoNote>
        </div>
      </Reveal>
    </div>
  );
}
