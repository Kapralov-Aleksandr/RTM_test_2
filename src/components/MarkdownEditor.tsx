// ============================================================
// Лёгкий Markdown-редактор с живым предпросмотром.
// Интерфейс (value/onChange) повторяет будущую обёртку TipTap —
// замена редактора не потребует правок в модулях.
// ============================================================

import { Bold, Code2, Heading2, Heading3, Italic, List, ListOrdered } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { cn } from './ui';

// ---------- Рендер подмножества Markdown (без dangerouslySetInnerHTML) ----------

function inline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((p, i) => {
    const key = `${keyBase}-${i}`;
    if (p.startsWith('`') && p.endsWith('`')) {
      return <code key={key}>{p.slice(1, -1)}</code>;
    }
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={key}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
      return <em key={key}>{p.slice(1, -1)}</em>;
    }
    return <span key={key}>{p}</span>;
  });
}

/** Безопасный рендер Markdown → React-элементы */
export function renderMarkdown(md: string): ReactNode {
  const lines = md.split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('### ')) { out.push(<h3 key={k++}>{inline(line.slice(4), `h${k}`)}</h3>); i++; continue; }
    if (line.startsWith('## ')) { out.push(<h2 key={k++}>{inline(line.slice(3), `h${k}`)}</h2>); i++; continue; }
    if (line.startsWith('> ')) { out.push(<blockquote key={k++}>{inline(line.slice(2), `q${k}`)}</blockquote>); i++; continue; }

    if (/^[-*] /.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(<li key={`li${k}-${items.length}`}>{inline(lines[i].replace(/^[-*] /, ''), `ul${k}`)}</li>);
        i++;
      }
      out.push(<ul key={k++}>{items}</ul>);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(<li key={`oi${k}-${items.length}`}>{inline(lines[i].replace(/^\d+\. /, ''), `ol${k}`)}</li>);
        i++;
      }
      out.push(<ol key={k++}>{items}</ol>);
      continue;
    }
    if (line.trim() === '') { i++; continue; }

    out.push(<p key={k++}>{inline(line, `p${k}`)}</p>);
    i++;
  }
  return <>{out}</>;
}

// ---------- Сам редактор ----------

const tools = [
  { icon: Heading2, label: 'Заголовок раздела', apply: '## ', kind: 'line' as const },
  { icon: Heading3, label: 'Подзаголовок', apply: '### ', kind: 'line' as const },
  { icon: Bold, label: 'Жирный', apply: '**', kind: 'wrap' as const },
  { icon: Italic, label: 'Курсив', apply: '*', kind: 'wrap' as const },
  { icon: Code2, label: 'Код', apply: '`', kind: 'wrap' as const },
  { icon: List, label: 'Список', apply: '- ', kind: 'line' as const },
  { icon: ListOrdered, label: 'Нумерованный список', apply: '1. ', kind: 'line' as const },
];

export function MarkdownEditor({
  value, onChange, minHeight = 170, placeholder,
}: {
  value: string; onChange: (v: string) => void; minHeight?: number; placeholder?: string;
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const ref = useRef<HTMLTextAreaElement>(null);

  const applyTool = (t: typeof tools[number]) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    if (t.kind === 'wrap') {
      const sel = value.slice(s, e) || 'текст';
      const next = value.slice(0, s) + t.apply + sel + t.apply + value.slice(e);
      onChange(next);
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + t.apply.length, s + t.apply.length + sel.length); });
    } else {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const next = value.slice(0, lineStart) + t.apply + value.slice(lineStart);
      onChange(next);
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + t.apply.length, e + t.apply.length); });
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-bg2/60 transition-colors focus-within:border-teal/60">
      <div className="flex items-center gap-0.5 border-b border-line/70 bg-bg2 px-2 py-1.5">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.label}
              type="button"
              title={t.label}
              disabled={mode === 'preview'}
              onClick={() => applyTool(t)}
              className="cursor-pointer rounded p-1.5 text-faint transition-colors hover:bg-bg3 hover:text-teal disabled:opacity-30"
            >
              <Icon size={14} />
            </button>
          );
        })}
        <div className="ml-auto flex rounded-md border border-line bg-bg1 p-0.5">
          {(['edit', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'cursor-pointer rounded px-2.5 py-1 text-[11px] font-semibold transition-all',
                mode === m ? 'bg-bg3 text-teal' : 'text-faint hover:text-dim',
              )}
            >
              {m === 'edit' ? 'Редактор' : 'Просмотр'}
            </button>
          ))}
        </div>
      </div>
      {mode === 'edit' ? (
        <textarea
          ref={ref}
          className="md-editor w-full bg-transparent px-3.5 py-3 text-ink outline-none placeholder:text-faint"
          style={{ minHeight }}
          value={value}
          placeholder={placeholder ?? '## Заголовок\n- пункт списка\n**важное**'}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="md-preview max-h-[320px] overflow-y-auto px-4 py-3">
          {value.trim() ? renderMarkdown(value) : <p className="text-faint">Пусто — переключитесь в редактор и добавьте описание.</p>}
        </div>
      )}
    </div>
  );
}
