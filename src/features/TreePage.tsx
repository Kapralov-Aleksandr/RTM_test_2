// ============================================================
// Дерево требований: ТЗ → главы → атомарные требования.
// Наглядно отвечает на боль «все ли требования из ТЗ на месте».
// ============================================================

import { BookOpen, ChevronRight, Edit3, FileText, Folder, FolderOpen, Network, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { renderMarkdown } from '../components/MarkdownEditor';
import { Badge, Dot, EmptyState, PageHeader, Panel, Reveal, type Tone } from '../components/ui';
import {
  PRIORITY_META, REQ_STATUS_META, TEST_STATUS_META, fmtDate, rowProblems, testsByRequirement,
} from '../domain/lifecycle';
import type { Requirement } from '../domain/types';
import { useApp } from '../services/db';
import { RequirementDrawer } from './RequirementDrawer';

interface TreeNode {
  id: string;
  kind: 'root' | 'chapter' | 'leaf';
  label: string;
  sub?: string;
  req?: Requirement;
  children: TreeNode[];
}

export function TreePage() {
  const state = useApp();
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(['root', ...state.tzChapters.map((c) => `ch-${c.code}`), 'ch-new']),
  );
  const [selectedId, setSelectedId] = useState<string | null>(state.requirements[0]?.id ?? null);
  const [editId, setEditId] = useState<string | null>(null);

  const tMap = useMemo(() => testsByRequirement(state), [state]);

  const tree = useMemo<TreeNode>(() => {
    const baseline = state.requirements.filter((r) => r.source === 'baseline');
    const fresh = state.requirements.filter((r) => r.source === 'new');
    const chapters: TreeNode[] = state.tzChapters.map((c) => ({
      id: `ch-${c.code}`,
      kind: 'chapter',
      label: `${c.code} · ${c.title}`,
      children: baseline
        .filter((r) => r.tzClause.startsWith(c.code))
        .sort((a, b) => a.tzClause.localeCompare(b.tzClause, 'ru', { numeric: true }))
        .map((r) => ({ id: r.id, kind: 'leaf' as const, label: r.title, sub: r.code, req: r, children: [] })),
    }));
    if (fresh.length > 0) {
      chapters.push({
        id: 'ch-new',
        kind: 'chapter',
        label: 'Новые требования (после baseline)',
        children: fresh.map((r) => ({ id: r.id, kind: 'leaf' as const, label: r.title, sub: r.code, req: r, children: [] })),
      });
    }
    return {
      id: 'root',
      kind: 'root',
      label: `${state.tzDoc.code} · ${state.tzDoc.title}`,
      children: chapters,
    };
  }, [state]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selected = state.requirements.find((r) => r.id === selectedId) ?? null;

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const isOpen = expanded.has(node.id);
    if (node.kind === 'leaf' && node.req) {
      const p = rowProblems(node.req, tMap);
      const dotTone: Tone = p.noTests ? 'coral' : p.noJira ? 'amber' : node.req.status === 'done' ? 'grass' : 'sky';
      const active = selectedId === node.req.id;
      return (
        <div key={node.id}>
          <button
            onClick={() => setSelectedId(node.req!.id)}
            className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all ${
              active ? 'bg-teal/10 ring-1 ring-teal/40' : 'hover:bg-bg2/70'
            }`}
            style={{ marginLeft: depth * 18 }}
          >
            <Dot tone={dotTone} />
            <span className="font-mono text-[11px] font-bold text-teal">{node.sub}</span>
            <span className={`truncate text-[12.5px] ${active ? 'text-ink' : 'text-dim'}`}>{node.label}</span>
            {p.gap && <Badge tone="coral" className="ml-auto">ЧТЗ?</Badge>}
          </button>
        </div>
      );
    }
    const count = node.kind === 'root'
      ? node.children.reduce((s, c) => s + c.children.length, 0)
      : node.children.length;
    return (
      <div key={node.id}>
        <button
          onClick={() => toggle(node.id)}
          className="group flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-bg2/70"
          style={{ marginLeft: depth * 18 }}
        >
          <span className={`text-faint transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
            <ChevronRight size={14} />
          </span>
          <span className={node.kind === 'root' ? 'text-amber' : 'text-sky'}>
            {node.kind === 'root' ? <BookOpen size={15} /> : isOpen ? <FolderOpen size={15} /> : <Folder size={15} />}
          </span>
          <span className={`truncate text-[13px] font-semibold ${node.kind === 'root' ? 'font-display text-ink' : 'text-dim'}`}>
            {node.label}
          </span>
          <span className="ml-auto rounded-full border border-line bg-bg2 px-1.5 py-px font-mono text-[10.5px] text-faint">{count}</span>
        </button>
        <div className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            {node.children.map((c) => renderNode(c, depth + 1))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Дерево требований"
        sub="Структура ТЗ с атомарными требованиями. Точка слева от требования — состояние покрытия: красная — нет тестов, жёлтая — нет задачи Jira."
      />

      <div className="grid gap-5 xl:grid-cols-5">
        <Reveal className="xl:col-span-2">
          <Panel icon={<Network size={16} />} title="Структура ТЗ" sub={`${state.requirements.length} требований в ${state.tzChapters.length} главах`} pad={false}>
            <div className="max-h-[620px] overflow-y-auto p-3">
              {renderNode(tree, 0)}
            </div>
          </Panel>
        </Reveal>

        <Reveal className="xl:col-span-3" delay={80}>
          {!selected ? (
            <Panel>
              <EmptyState icon={<FileText size={24} />} title="Выберите требование" sub="Кликните по листу дерева слева, чтобы увидеть детали и трассировку." />
            </Panel>
          ) : (
            <Panel
              icon={<FileText size={16} />}
              title={`${selected.code} · ${selected.title}`}
              sub={`Пункт ТЗ ${selected.tzClause} · обновлено ${fmtDate(selected.updatedAt)}`}
              actions={
                <button
                  onClick={() => setEditId(selected.id)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-dim transition-colors hover:border-teal/50 hover:text-teal"
                >
                  <Edit3 size={13} /> Редактировать
                </button>
              }
            >
              <div className="flex flex-col gap-4">
                {/* Трассировка */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {[
                    {
                      label: 'ЧТЗ',
                      node: selected.chtzSection
                        ? <Badge tone="sky">{selected.chtzSection}</Badge>
                        : selected.source === 'new' ? <Badge tone="dim">н/д (новое)</Badge> : <Badge tone="coral">пробел</Badge>,
                    },
                    {
                      label: 'Фиче-страница',
                      node: (() => {
                        const f = state.features.find((x) => x.id === selected.featureId);
                        return f ? <Badge tone="teal">{f.code}</Badge> : <Badge tone="amber">не привязано</Badge>;
                      })(),
                    },
                    {
                      label: 'Jira',
                      node: selected.jiraKey ? <Badge tone="amber">{selected.jiraKey}</Badge> : <Badge tone="amber">нет задачи</Badge>,
                    },
                    {
                      label: 'Приоритет',
                      node: <Badge tone={PRIORITY_META[selected.priority].tone as Tone}>{PRIORITY_META[selected.priority].label}</Badge>,
                    },
                    {
                      label: 'Статус',
                      node: <Badge tone={REQ_STATUS_META[selected.status].tone as Tone}>{REQ_STATUS_META[selected.status].label}</Badge>,
                    },
                    {
                      label: 'Тест-кейсы',
                      node: (tMap.get(selected.id) ?? []).length > 0
                        ? <span className="flex flex-wrap gap-1">{(tMap.get(selected.id) ?? []).map((t) => (
                            <Badge key={t.id} tone={TEST_STATUS_META[t.status].tone as Tone}>{t.code}</Badge>
                          ))}</span>
                        : <Badge tone="coral">нет покрытия</Badge>,
                    },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg border border-line/70 bg-bg2/40 px-3 py-2.5">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">{c.label}</p>
                      <div className="mt-1.5">{c.node}</div>
                    </div>
                  ))}
                </div>

                {/* Описание */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Описание и критерии приёмки</p>
                  <div className="md-preview rounded-lg border border-line/70 bg-bg2/30 px-4 py-3">
                    {selected.descriptionMd ? renderMarkdown(selected.descriptionMd) : <p className="text-faint">Описание не заполнено.</p>}
                  </div>
                </div>

                {selected.newReqId && (
                  <p className="flex items-center gap-2 rounded-lg border border-teal/30 bg-teal/[0.06] px-3.5 py-2.5 text-[12.5px] text-dim">
                    <Sparkles size={14} className="text-teal" />
                    Требование создано из журнала новых требований
                    ({state.newReqs.find((n) => n.id === selected.newReqId)?.code ?? 'NR'}) — влияние на бюджет и сроки зафиксировано там.
                  </p>
                )}
              </div>
            </Panel>
          )}
        </Reveal>
      </div>

      <RequirementDrawer reqId={editId} onClose={() => setEditId(null)} />
    </div>
  );
}
