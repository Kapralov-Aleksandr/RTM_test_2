// ============================================================
// Фиче-страницы: контент, версии, diff между версиями и
// уведомления команды (синхронизация аналитик / QA / разработка)
// ============================================================

import {
  ArrowLeft, BookOpen, CheckCheck, ExternalLink, GitCompare, History, Loader2, Save, Sparkles, Users, Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { Badge, Button, Dot, EmptyState, Field, Input, PageHeader, Panel, ProgressBar, Reveal, Select, toast } from '../components/ui';
import { ROLE_LABEL, fmtDateTime, testsByRequirement } from '../domain/lifecycle';
import { diffLines, diffStats, toChunks } from '../lib/diff';
import { checkConfluencePage } from '../services/integrations';
import { addNotice, saveFeatureVersion, toggleNotice, useApp } from '../services/db';

export function FeaturesPage() {
  const { id } = useParams();
  return id ? <FeatureDetail id={id} /> : <FeatureList />;
}

// ---------- Список ----------

function FeatureList() {
  const state = useApp();
  const navigate = useNavigate();
  const tMap = useMemo(() => testsByRequirement(state), [state]);

  return (
    <div>
      <PageHeader
        title="Фиче-страницы"
        sub="Одна фиче-страница объединяет несколько атомарных требований. Версии и уведомления синхронизируют аналитика, QA и разработчиков."
      />
      <div className="grid gap-5 md:grid-cols-2">
        {state.features.map((f, i) => {
          const reqs = state.requirements.filter((r) => r.featureId === f.id);
          const done = reqs.filter((r) => r.status === 'done').length;
          const pending = state.notices.filter((n) => n.featureId === f.id && !n.done).length;
          const owner = state.members.find((m) => m.id === f.ownerId);
          return (
            <Reveal key={f.id} delay={i * 70}>
              <button
                onClick={() => navigate(`/features/${f.id}`)}
                className="group w-full cursor-pointer rounded-xl border border-line bg-bg1/90 p-5 text-left transition-all hover:-translate-y-1 hover:border-teal/40 hover:shadow-[0_16px_40px_rgba(2,12,16,0.5)]"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12.5px] font-bold text-teal">{f.code}</span>
                  <span className="font-mono text-[10.5px] text-faint">conf:{f.confluenceId}</span>
                  {pending > 0 && (
                    <Badge tone="amber" className="ml-auto"><span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-amber text-amber" />{pending} ув.</Badge>
                  )}
                </div>
                <h3 className="font-display mt-2 text-[14px] font-bold leading-snug text-ink transition-colors group-hover:text-teal">
                  {f.title}
                </h3>
                <p className="mt-1 text-[12px] text-faint">Аналитик: {owner?.name ?? '—'} · версий: {f.versions.length}</p>
                <div className="mt-3.5 flex items-center gap-3">
                  <ProgressBar value={reqs.length ? (done / reqs.length) * 100 : 0} tone="grass" className="flex-1" />
                  <span className="font-mono text-[11.5px] text-dim">
                    {done}/{reqs.length} · тестов {reqs.filter((r) => (tMap.get(r.id) ?? []).length > 0).length}
                  </span>
                </div>
              </button>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Детальная страница ----------

function FeatureDetail({ id }: { id: string }) {
  const state = useApp();
  const feature = state.features.find((f) => f.id === id);
  const [body, setBody] = useState(feature?.bodyMd ?? '');
  const [note, setNote] = useState('');
  const [authorId, setAuthorId] = useState(state.members.find((m) => m.role === 'analyst')?.id ?? state.members[0]?.id ?? '');
  const [diffVersionId, setDiffVersionId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setBody(state.features.find((f) => f.id === id)?.bodyMd ?? '');
    setDiffVersionId(null);
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const versions = useMemo(() => (feature ? [...feature.versions].reverse() : []), [feature]);
  const reqs = useMemo(() => state.requirements.filter((r) => r.featureId === id), [state.requirements, id]);
  const notices = useMemo(() => state.notices.filter((n) => n.featureId === id), [state.notices, id]);

  if (!feature) {
    return (
      <Panel>
        <EmptyState icon={<BookOpen size={24} />} title="Фиче-страница не найдена" action={<Link to="/features" className="text-[13px] font-semibold text-teal">← к списку</Link>} />
      </Panel>
    );
  }

  const authorName = (aid: string) => state.members.find((m) => m.id === aid)?.name ?? '—';

  const onSaveVersion = () => {
    if (!note.trim()) {
      toast('Укажите комментарий к версии — он попадёт в уведомление команде', 'warn');
      return;
    }
    const v = saveFeatureVersion(feature.id, authorId, note.trim(), body);
    const idx = feature.versions.length + 1;
    addNotice({
      featureId: feature.id,
      versionId: v.id,
      message: `${feature.code} обновлена (v${idx}): ${note.trim()}. QA — пересмотреть чек-листы ПМИ, разработка — оценить влияние на связанные задачи.`,
      audience: ['qa', 'dev'],
    });
    setNote('');
    toast(`Версия v${idx} сохранена, команда уведомлена (QA, разработка)`, 'ok');
  };

  const onCheck = async () => {
    setChecking(true);
    try {
      const res = await checkConfluencePage(feature.code);
      if (res.exists) toast(`${feature.code} найдена в Confluence, текущая версия v${res.version}`, 'ok');
      else toast(`${feature.code} не найдена в Confluence — проверьте ID страницы`, 'err');
    } finally {
      setChecking(false);
    }
  };

  // Diff выбранной версии с предыдущей
  const diff = useMemo(() => {
    if (!diffVersionId) return null;
    const idx = feature.versions.findIndex((v) => v.id === diffVersionId);
    if (idx <= 0) return null;
    const prev = feature.versions[idx - 1];
    const cur = feature.versions[idx];
    const lines = diffLines(prev.md.split('\n'), cur.md.split('\n'));
    return { from: prev, to: cur, chunks: toChunks(lines), stats: diffStats(lines) };
  }, [diffVersionId, feature.versions]);

  return (
    <div>
      <div className="mb-5">
        <Link to="/features" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-faint transition-colors hover:text-teal">
          <ArrowLeft size={14} /> Фиче-страницы
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display flex items-center gap-3 text-[20px] font-bold text-ink">
              <span className="text-teal">{feature.code}</span> {feature.title}
            </h1>
            <p className="mt-1.5 text-[12.5px] text-faint">
              Confluence ID <span className="font-mono text-dim">{feature.confluenceId}</span> · аналитик {authorName(feature.ownerId)} · {reqs.length} требований
            </p>
          </div>
          <Button onClick={onCheck} disabled={checking}>
            {checking ? <Loader2 size={14} className="spin" /> : <ExternalLink size={14} />}
            Проверить в Confluence
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        {/* Контент */}
        <Reveal className="xl:col-span-3">
          <Panel
            icon={<BookOpen size={16} />}
            title="Содержимое страницы"
            sub="Правки сохраняются как новая версия и автоматически уведомляют команду"
            pad={false}
          >
            <div className="flex flex-col gap-3.5 p-5">
              <MarkdownEditor value={body} onChange={setBody} minHeight={300} />
              <div className="grid gap-3 md:grid-cols-[1fr_190px]">
                <Field label="Комментарий к версии (что изменилось)">
                  <Input placeholder="Например: уточнены критерии приёмки по письму №132" value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <Field label="Автор">
                  <Select value={authorId} onChange={(e) => setAuthorId(e.target.value)}>
                    {state.members.map((m) => <option key={m.id} value={m.id}>{m.name} · {ROLE_LABEL[m.role]}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-[11.5px] text-faint">
                  <Users size={13} /> Уведомление получат: QA-инженер и разработчики
                </p>
                <Button variant="primary" onClick={onSaveVersion}>
                  <Save size={15} />
                  Сохранить версию v{feature.versions.length + 1}
                </Button>
              </div>
            </div>

            {/* Связанные требования */}
            <div className="border-t border-line/70 px-5 py-4">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Связанные требования</p>
              <div className="flex flex-wrap gap-1.5">
                {reqs.map((r) => (
                  <Link key={r.id} to="/matrix" className="rounded-md border border-line bg-bg2 px-2 py-1 font-mono text-[11.5px] text-sky transition-colors hover:border-teal/50 hover:text-teal">
                    {r.code}
                  </Link>
                ))}
                {reqs.length === 0 && <span className="text-[12px] text-faint">Нет привязанных требований — добавьте их в матрице.</span>}
              </div>
            </div>
          </Panel>
        </Reveal>

        {/* Версии и уведомления */}
        <div className="flex flex-col gap-5 xl:col-span-2">
          <Reveal delay={70}>
            <Panel icon={<History size={16} />} title="История версий" sub="Клик по версии — diff с предыдущей" pad={false}>
              <div className="flex max-h-[300px] flex-col divide-y divide-line/60 overflow-y-auto">
                {versions.map((v, i) => {
                  const realIdx = feature.versions.length - i;
                  const active = diffVersionId === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setDiffVersionId(active ? null : v.id)}
                      className={`cursor-pointer px-5 py-3 text-left transition-colors hover:bg-bg2/60 ${active ? 'bg-bg2/80' : ''}`}
                      disabled={realIdx === 1}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-[12px] font-bold ${active ? 'text-teal' : 'text-ink'}`}>v{realIdx}</span>
                        <span className="text-[11.5px] text-dim">{authorName(v.authorId)}</span>
                        <span className="ml-auto font-mono text-[10.5px] text-faint">{fmtDateTime(v.ts)}</span>
                      </div>
                      <p className="mt-1 text-[12px] leading-snug text-faint">{v.note}</p>
                      {realIdx === 1 && <p className="mt-1 text-[10.5px] text-faint">базовая версия — diff недоступен</p>}
                    </button>
                  );
                })}
              </div>

              {/* Diff */}
              {diff && (
                <div className="border-t border-line/70">
                  <div className="flex items-center gap-2 px-5 py-3">
                    <GitCompare size={14} className="text-teal" />
                    <span className="text-[12px] font-semibold text-dim">
                      v{feature.versions.indexOf(diff.from) + 1} → v{feature.versions.indexOf(diff.to) + 1}
                    </span>
                    <Badge tone="grass" className="ml-auto">+{diff.stats.adds}</Badge>
                    <Badge tone="coral">−{diff.stats.dels}</Badge>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto border-t border-line/50 bg-bg0/40 px-4 py-3">
                    {diff.chunks.map((chunk, ci) => (
                      <div key={ci}>
                        {ci > 0 && <div className="dl-gap my-1 rounded px-2 py-0.5 text-center font-mono text-[10.5px]">···</div>}
                        {chunk.lines.map((l, li) => (
                          <div key={li} className={`flex gap-2.5 rounded px-2 py-[2px] font-mono text-[11.5px] leading-relaxed ${l.type === 'add' ? 'dl-add' : l.type === 'del' ? 'dl-del' : 'dl-same'}`}>
                            <span className="w-3 shrink-0 select-none font-bold">{l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '}</span>
                            <span className="whitespace-pre-wrap break-words">{l.text || ' '}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </Reveal>

          <Reveal delay={140}>
            <Panel icon={<Zap size={16} />} title="Уведомления команды" sub={`${notices.filter((n) => !n.done).length} открытых`} pad={false}>
              {notices.length === 0 ? (
                <EmptyState icon={<Sparkles size={20} />} title="Уведомлений пока нет" sub="Сохраните новую версию страницы — QA и разработка получат задачу на синхронизацию." />
              ) : (
                <div className="flex max-h-[260px] flex-col divide-y divide-line/60 overflow-y-auto">
                  {notices.map((n) => (
                    <div key={n.id} className={`px-5 py-3 ${n.done ? 'opacity-55' : ''}`}>
                      <div className="flex items-center gap-2">
                        <Dot tone={n.done ? 'grass' : 'amber'} pulse={!n.done} />
                        <span className="text-[11px] text-faint">{fmtDateTime(n.ts)}</span>
                        {!n.done && (
                          <button
                            onClick={() => { toggleNotice(n.id); toast('Уведомление закрыто — команда синхронизирована', 'ok'); }}
                            className="ml-auto flex cursor-pointer items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-dim transition-colors hover:border-grass/50 hover:text-grass"
                          >
                            <CheckCheck size={12} /> готово
                          </button>
                        )}
                        {n.done && <Badge tone="grass" className="ml-auto">выполнено</Badge>}
                      </div>
                      <p className="mt-1.5 text-[12.5px] leading-snug text-dim">{n.message}</p>
                      <div className="mt-1.5 flex gap-1.5">
                        {n.audience.map((a) => (
                          <span key={a} className="rounded border border-line bg-bg2 px-1.5 py-0.5 text-[10.5px] font-semibold text-faint">{ROLE_LABEL[a]}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
