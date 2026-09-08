// ============================================================
// Таб 4 · Фиче-страницы:
// слева — дерево «Релизы → Фичи» с drag-n-drop и контекстным меню;
// справа — содержимое фичи: редактор, ссылки Jira/тест-кейсы,
// привязка требований (модалка с поиском), макеты (drag-n-drop).
// ============================================================

import {
  ChevronRight, ExternalLink, FileUp, FolderKanban, FolderPlus, GripVertical, ImagePlus, Link2,
  Loader2, Pencil, Plus, Save, Search, Trash2, X,
} from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Editor } from '@tiptap/react';
import { RichEditor } from '../components/Editor';
import {
  Badge, Button, Dialog, EmptyState, Field, Input, PageHeader, Panel, Reveal, Textarea, toast,
} from '../components/ui';
import { fmtDateTime } from '../domain/logic';
import type { FeatureTreeNode } from '../domain/types';
import {
  addTreeNode, deleteMockup, deleteTreeNode, importTreeStructure, linkRequirement, moveTreeNode,
  renameTreeNode, saveFeature, unlinkRequirement, uploadMockup, useApp,
} from '../services/db';

export function FeaturesPage() {
  const state = useApp();
  const navigate = useNavigate();
  const nodes = state.tree;
  const releases = nodes.filter((n) => n.parentId === null).sort((a, b) => a.orderNum - b.orderNum);
  const childrenOf = (id: string) => nodes.filter((n) => n.parentId === id).sort((a, b) => a.orderNum - b.orderNum);

  const [selectedId, setSelectedId] = useState<string | null>(
    () => nodes.find((n) => n.nodeType === 'FEATURE')?.id ?? null,
  );
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<FeatureTreeNode | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');

  // Локальная форма фичи
  const editorRef = useRef<Editor | null>(null);
  const [fLinkJira, setFLinkJira] = useState('');
  const [fLinkTests, setFLinkTests] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const feature = state.features.find((f) => f.treeNodeId === selectedId) ?? null;
  const projectReqs = state.requirements.filter((r) => r.projectId === state.activeProjectId);

  useEffect(() => {
    setSelectedId(nodes.find((n) => n.nodeType === 'FEATURE')?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeProjectId]);

  useEffect(() => {
    setFLinkJira(feature?.linkJira ?? '');
    setFLinkTests(feature?.linkTestCases ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, feature?.id]);

  // ---------- Drag-n-drop ----------

  const onDrop = (target: FeatureTreeNode) => {
    if (!dragId || dragId === target.id) { setDropTarget(null); return; }
    const dragged = nodes.find((n) => n.id === dragId);
    if (!dragged) return;
    try {
      if (dragged.nodeType === 'FEATURE') {
        if (target.nodeType === 'RELEASE') {
          // Фича → в другой релиз (в конец)
          void moveTreeNode(dragged.id, target.id, childrenOf(target.id).length + 1);
        } else {
          // Фича → перед другой фичей того же уровня
          void moveTreeNode(dragged.id, target.parentId, target.orderNum);
        }
      } else if (dragged.nodeType === 'RELEASE' && target.nodeType === 'RELEASE') {
        void moveTreeNode(dragged.id, null, target.orderNum);
      }
      toast('Узел перемещён', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось переместить узел', 'err');
    }
    setDragId(null);
    setDropTarget(null);
  };

  const nodeHandlers = (node: FeatureTreeNode) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      setDragId(node.id);
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', node.id); } catch { /* IE-safe */ }
    },
    onDragEnd: () => { setDragId(null); setDropTarget(null); },
    onDragOver: (e: DragEvent) => {
      if (!dragId || dragId === node.id) return;
      e.preventDefault();
      setDropTarget(node.id);
    },
    onDragLeave: () => setDropTarget((t) => (t === node.id ? null : t)),
    onDrop: (e: DragEvent) => { e.preventDefault(); onDrop(node); },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      setMenu({ x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 160), nodeId: node.id });
    },
  });

  // ---------- Действия с деревом ----------

  const menuNode = menu ? nodes.find((n) => n.id === menu.nodeId) : null;

  const doRename = async () => {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) { toast('Название не может быть пустым', 'err'); return; }
    await renameTreeNode(renaming.id, name);
    toast(`Узел переименован в «${name}»`, 'ok');
    setRenaming(null);
  };

  const doDelete = async (node: FeatureTreeNode) => {
    await deleteTreeNode(node.id);
    toast(`«${node.name}» удалён${node.nodeType === 'FEATURE' ? '' : ''} из дерева`, 'warn');
    setMenu(null);
    if (selectedId === node.id) setSelectedId(null);
  };

  const addFeatureTo = async (releaseId: string) => {
    const n = childrenOf(releaseId).length + 1;
    await addTreeNode('FEATURE', `Новая фича ${n}`, releaseId);
    toast('Фича добавлена в релиз', 'ok');
    setMenu(null);
  };

  const addRelease = async () => {
    await addTreeNode('RELEASE', `Релиз ${releases.length + 1}.0`, null);
    toast('Релиз добавлен', 'ok');
  };

  /** 📄 Импорт структуры дерева из JSON */
  const onImportJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data) && !Array.isArray(data.nodes)) {
        toast('JSON должен содержать массив узлов или поле "nodes"', 'err');
        return;
      }
      const nodes = Array.isArray(data) ? data : data.nodes;
      const result = await importTreeStructure(nodes);
      toast(`Импортировано: ${result.releases} релизов, ${result.features} фич`, 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось импортировать JSON', 'err');
    }
  };

  // ---------- Фича: сохранение, привязки, макеты ----------

  const onSaveFeature = async () => {
    if (!selectedNode) return;
    setSaving(true);
    try {
      const content = editorRef.current?.getHTML() ?? '';
      await saveFeature(selectedNode.id, {
        title: selectedNode.name, content, linkJira: fLinkJira.trim(), linkTestCases: fLinkTests.trim(),
      });
      toast('Фиче-страница сохранена: updated_at обновлён', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось сохранить фичу', 'err');
    } finally {
      setSaving(false);
    }
  };

  const linkCandidates = projectReqs.filter((r) => {
    if (feature?.requirementIds.includes(r.id)) return false;
    const q = linkQuery.trim().toLowerCase();
    if (!q) return true;
    return r.reqKey.toLowerCase().includes(q) || r.title.toLowerCase().includes(q);
  }).slice(0, 12);

  const onMockupDrop = async (e: DragEvent) => {
    e.preventDefault();
    if (!feature) { toast('Сначала сохраните фиче-страницу', 'warn'); return; }
    const files = [...(e.dataTransfer.files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) { toast('Можно перетащать только изображения (PNG/JPG)', 'warn'); return; }
    for (const f of files) await uploadMockup(feature.id, f);
    toast(`Макеты загружены в data/mockups: ${files.length} шт.`, 'ok');
  };

  const reqByKey = (id: string) => projectReqs.find((r) => r.id === id);

  return (
    <div onClick={() => menu && setMenu(null)}>
      <PageHeader
        title="Таб 4 · Фиче-страницы"
        sub="Дерево «Релизы → Фичи»: перетаскивайте узлы, правая кнопка — контекстное меню. Справа — содержимое фичи, привязка требований и макеты."
        actions={
          <>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-4 py-2 text-[13px] font-semibold text-dim transition-all hover:border-teal/50 hover:text-teal">
              <FileUp size={15} />
              Импорт JSON
              <input type="file" accept=".json" className="hidden"
                onChange={(e) => { void onImportJson(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <Button onClick={() => void addRelease()}>
              <FolderPlus size={15} />
              Добавить релиз
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-5">
        {/* ---------- Дерево ---------- */}
        <Reveal className="xl:col-span-2">
          <Panel icon={<FolderKanban size={16} />} title="Структура" sub={`${releases.length} релизов · ${nodes.filter((n) => n.nodeType === 'FEATURE').length} фич · drag-n-drop`} pad={false}>
            <div className="flex max-h-[640px] flex-col gap-1 overflow-y-auto p-3">
              {releases.length === 0 && (
                <EmptyState icon={<FolderKanban size={22} />} title="Дерево пусто" sub="Добавьте первый релиз, затем фичи внутри него." />
              )}
              {releases.map((rel) => (
                <div key={rel.id}>
                  {/* Релиз */}
                  <div
                    {...nodeHandlers(rel)}
                    className={`group flex cursor-grab items-center gap-2 rounded-lg border border-line/70 bg-bg2/60 px-3 py-2.5 transition-all active:cursor-grabbing ${dropTarget === rel.id ? 'tree-drop' : ''} hover:border-line2`}
                  >
                    <GripVertical size={13} className="shrink-0 text-faint/50" />
                    <ChevronRight size={13} className="text-amber" />
                    <span className="truncate text-[13px] font-bold text-ink">{rel.name}</span>
                    <span className="ml-auto rounded-full border border-line bg-bg1 px-1.5 py-px font-mono text-[10.5px] text-faint">
                      {childrenOf(rel.id).length}
                    </span>
                  </div>

                  {/* Фичи релиза */}
                  <div className="ml-6 mt-1 flex flex-col gap-1 border-l border-line/60 pl-3">
                    {childrenOf(rel.id).map((f) => {
                      const fData = state.features.find((x) => x.treeNodeId === f.id);
                      return (
                        <button
                          key={f.id}
                          {...nodeHandlers(f)}
                          onClick={() => setSelectedId(f.id)}
                          className={`group flex cursor-grab items-center gap-2 rounded-lg px-3 py-2 text-left transition-all active:cursor-grabbing ${
                            selectedId === f.id
                              ? 'bg-teal/[0.1] ring-1 ring-teal/40'
                              : dropTarget === f.id ? 'tree-drop' : 'hover:bg-bg2/70'
                          }`}
                        >
                          <GripVertical size={12} className="shrink-0 text-faint/40" />
                          <FolderKanban size={13} className={selectedId === f.id ? 'text-teal' : 'text-faint'} />
                          <span className={`truncate text-[12.5px] font-semibold ${selectedId === f.id ? 'text-teal' : 'text-dim'}`}>{f.name}</span>
                          {fData && fData.requirementIds.length > 0 && (
                            <span className="ml-auto font-mono text-[10.5px] text-faint">{fData.requirementIds.length} REQ</span>
                          )}
                        </button>
                      );
                    })}
                    {childrenOf(rel.id).length === 0 && (
                      <p className="px-3 py-1.5 text-[11.5px] italic text-faint/70">нет фич — правый клик по релизу → «Добавить фичу»</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>

        {/* ---------- Содержимое фичи ---------- */}
        <Reveal className="xl:col-span-3" delay={80}>
          {!selectedNode ? (
            <Panel>
              <EmptyState icon={<FolderKanban size={24} />} title="Выберите фичу" sub="Кликните по узлу-фиче в дереве слева, чтобы редактировать её содержимое." />
            </Panel>
          ) : (
            <Panel
              pad={false}
              icon={<FolderKanban size={16} />}
              title={selectedNode.name}
              sub={feature ? `Сохранена ${fmtDateTime(feature.updatedAt)} · ${feature.requirementIds.length} требований привязано` : 'Фиче-страница ещё не сохранялась — будет создана при первом сохранении'}
              actions={
                <Button variant="primary" onClick={() => void onSaveFeature()} disabled={saving}>
                  {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                  💾 Сохранить
                </Button>
              }
            >
              <div className="flex flex-col">
                {/* Ссылки */}
                <div className="grid gap-3 border-b border-line/70 px-5 py-3.5 md:grid-cols-2">
                  <Field label="Ссылка на задачу Jira">
                    <Input className="font-mono text-[12.5px]" placeholder="https://jira.tomskasu.ru/browse/ASU-301" value={fLinkJira} onChange={(e) => setFLinkJira(e.target.value)} />
                  </Field>
                  <Field label="Ссылка на тест-кейсы (ПМИ)">
                    <Input className="font-mono text-[12.5px]" placeholder="ПМИ §4.1 или ссылка на Confluence" value={fLinkTests} onChange={(e) => setFLinkTests(e.target.value)} />
                  </Field>
                </div>

                {/* Привязанные требования */}
                <div className="border-b border-line/70 px-5 py-3.5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-faint">
                      Привязанные требования ({feature?.requirementIds.length ?? 0})
                    </p>
                    <Button size="sm" onClick={() => { setLinkQuery(''); setLinkOpen(true); }} disabled={!feature}>
                      <Plus size={13} />
                      Привязать требование
                    </Button>
                  </div>
                  {!feature || feature.requirementIds.length === 0 ? (
                    <p className="text-[12px] text-faint">
                      {feature ? 'Привязок нет — добавьте требования из Таба 2.' : 'Сначала сохраните фиче-страницу, затем привязывайте требования.'}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {feature.requirementIds.map((rid) => {
                        const r = reqByKey(rid);
                        return (
                          <span key={rid} className="group flex items-center gap-1 rounded-lg border border-teal/40 bg-teal/[0.07] py-1 pl-2.5 pr-1">
                            <button
                              onClick={() => navigate(`/matrix?req=${encodeURIComponent(r?.reqKey ?? '')}`)}
                              className="cursor-pointer font-mono text-[11.5px] font-bold text-teal transition-colors hover:text-ink"
                              title={r?.title ?? 'Открыть в Табе 2'}
                            >
                              {r?.reqKey ?? rid}
                            </button>
                            <button
                              onClick={() => { void unlinkRequirement(feature.id, rid); toast('Привязка снята', 'warn'); }}
                              className="cursor-pointer rounded p-0.5 text-faint transition-colors hover:bg-coral/15 hover:text-coral"
                              title="Отвязать"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Редактор содержимого */}
                <div onClick={(e) => {
                  const el = (e.target as HTMLElement).closest('.req-badge');
                  const key = el?.getAttribute('data-req-key');
                  if (key) navigate(`/matrix?req=${encodeURIComponent(key)}`);
                }}>
                  <RichEditor
                    key={`${selectedNode.id}-feature`}
                    initialContent={feature?.content ?? ''}
                    mentionAutocomplete
                    requirements={projectReqs}
                    onReady={(ed) => { editorRef.current = ed; }}
                    placeholder="Бизнес-ценность фичи, сценарии, критерии приёмки…"
                  />
                </div>

                {/* Макеты */}
                <div className="border-t border-line/70 px-5 py-4">
                  <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-faint">Макеты ({feature?.mockups.length ?? 0})</p>
                  <div
                    onDrop={(e) => void onMockupDrop(e)}
                    onDragOver={(e) => e.preventDefault()}
                    className="mb-3 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-line2 bg-bg2/30 px-4 py-6 text-center transition-all hover:border-teal/50 hover:bg-teal/[0.04]"
                  >
                    <ImagePlus size={20} className="text-faint" />
                    <p className="text-[12.5px] font-semibold text-dim">Перетащите изображения (PNG/JPG) сюда</p>
                    <p className="text-[11px] text-faint">или <label className="cursor-pointer text-teal underline underline-offset-2">выберите файл<input type="file" accept="image/png,image/jpeg" multiple className="hidden"
                      onChange={async (e) => {
                        if (!feature) { toast('Сначала сохраните фиче-страницу', 'warn'); return; }
                        for (const f of [...(e.target.files ?? [])]) await uploadMockup(feature.id, f);
                        toast('Макет загружен в data/mockups', 'ok');
                        e.target.value = '';
                      }} /></label></p>
                  </div>
                  {feature && feature.mockups.length > 0 && (
                    <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4">
                      {feature.mockups.map((m) => (
                        <div key={m.id} className="group relative overflow-hidden rounded-lg border border-line">
                          <img src={m.url} alt={m.name} className="h-24 w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          <button
                            onClick={() => { void deleteMockup(feature.id, m.id); toast('Макет удалён', 'warn'); }}
                            className="absolute right-1.5 top-1.5 cursor-pointer rounded-md bg-bg0/80 p-1 text-faint opacity-0 transition-all hover:text-coral group-hover:opacity-100"
                            title="Удалить макет"
                          >
                            <Trash2 size={13} />
                          </button>
                          <p className="truncate bg-bg1/95 px-2 py-1 text-[10.5px] text-faint">{m.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          )}
        </Reveal>
      </div>

      {/* ---------- Контекстное меню ---------- */}
      {menu && menuNode && (
        <div
          className="fixed z-[70] w-[210px] overflow-hidden rounded-lg border border-line2 bg-bg1 py-1 shadow-[0_16px_44px_rgba(0,0,0,0.55)]"
          style={{ left: menu.x, top: menu.y }}
        >
          {menuNode.nodeType === 'RELEASE' && (
            <button onClick={() => void addFeatureTo(menuNode.id)} className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-semibold text-dim transition-colors hover:bg-bg2 hover:text-teal">
              <Plus size={13} /> Добавить фичу
            </button>
          )}
          <button
            onClick={() => { setRenaming(menuNode); setRenameValue(menuNode.name); setMenu(null); }}
            className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-semibold text-dim transition-colors hover:bg-bg2 hover:text-ink"
          >
            <Pencil size={13} /> Переименовать
          </button>
          <button onClick={() => void doDelete(menuNode)} className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-semibold text-coral transition-colors hover:bg-coral/10">
            <Trash2 size={13} /> Удалить {menuNode.nodeType === 'RELEASE' ? 'релиз' : 'фичу'}
          </button>
        </div>
      )}

      {/* ---------- Переименование ---------- */}
      <Dialog open={!!renaming} onClose={() => setRenaming(null)} title="✏ Переименовать узел" width={400}>
        <div className="flex flex-col gap-3.5">
          <Field label="Название">
            <Input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void doRename(); }} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRenaming(null)}>Отмена</Button>
            <Button variant="primary" onClick={() => void doRename()}>Сохранить</Button>
          </div>
        </div>
      </Dialog>

      {/* ---------- Привязка требования ---------- */}
      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} title="➕ Привязать требование" width={520}>
        <div className="flex flex-col gap-3">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"><Search size={15} /></span>
            <Input autoFocus className="pl-9" placeholder="Поиск по ID или названию (REQ-LC-FUNC…)" value={linkQuery} onChange={(e) => setLinkQuery(e.target.value)} />
          </div>
          <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
            {linkCandidates.length === 0 && (
              <p className="px-2 py-6 text-center text-[12.5px] text-faint">Ничего не найдено{linkQuery ? ` по запросу «${linkQuery}»` : ''}.</p>
            )}
            {linkCandidates.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  if (!feature) return;
                  void linkRequirement(feature.id, r.id);
                  toast(`${r.reqKey} привязано к фиче`, 'ok');
                }}
                className="group flex cursor-pointer items-start gap-3 rounded-lg border border-line/60 px-3.5 py-2.5 text-left transition-all hover:border-teal/40 hover:bg-teal/[0.05]"
              >
                <span className="shrink-0 font-mono text-[11.5px] font-bold text-teal">{r.reqKey}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-dim group-hover:text-ink">{r.title}</span>
                <Plus size={14} className="mt-0.5 shrink-0 text-faint transition-colors group-hover:text-teal" />
              </button>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-faint">
            <Link2 size={12} /> Связь «фича ↔ требование» (многие-ко-многим) записывается в feature_requirements.
          </p>
        </div>
      </Dialog>

      {/* Легенда DnD */}
      <Reveal delay={140}>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-line bg-bg1/90 px-5 py-3.5 text-[12px] text-faint">
          <span className="flex items-center gap-1.5"><GripVertical size={13} /> перетаскивание узлов</span>
          <span className="flex items-center gap-1.5"><Badge tone="dim">ПКМ</Badge> контекстное меню</span>
          <span className="flex items-center gap-1.5"><ExternalLink size={13} /> клик по REQ-бейджу → Таб 2</span>
          <span className="ml-auto font-mono text-[11px]">feature_tree · features · mockups</span>
        </div>
      </Reveal>
    </div>
  );
}
