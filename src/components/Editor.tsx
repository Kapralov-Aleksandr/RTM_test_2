// ============================================================
// Редактор документов (TipTap / ProseMirror):
//  · панель форматирования (жирный, курсив, заголовки, списки, ссылки);
//  · режим ТЗ: BubbleMenu «📌 Зафиксировать как требование» + mark-подсветка;
//  · режим ЧТЗ: @-autocomplete требований с вставкой кликабельного бейджа;
//  · extractMentions() — связи «текст ↔ требование» с offset'ами.
// ============================================================

import { BubbleMenu, EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Mark, Node, mergeAttributes } from '@tiptap/core';
import {
  Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Pin, Quote, Redo2,
  Strikethrough, TextQuote, Undo2, Unlink,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  useCallback, useRef, useState, type ReactNode,
} from 'react';
import type { Requirement } from '../domain/types';
import { cn } from './ui';

// ---------- Кастомное расширение: подсветка «текст → требование» (Таб 1) ----------

export const ReqMark = Mark.create({
  name: 'req',
  inclusive: false,
  addAttributes() {
    return {
      reqId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-req-id'),
        renderHTML: (attrs: { reqId?: string }) => ({ 'data-req-id': attrs.reqId ?? '' }),
      },
      reqKey: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-req-key'),
        renderHTML: (attrs: { reqKey?: string }) => ({ 'data-req-key': attrs.reqKey ?? '' }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'mark[data-req-id]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes, { class: 'req-hl' }), 0];
  },
});

// ---------- Кастомный узел: кликабельный бейдж требования (Таб 3) ----------

export const ReqMention = Node.create({
  name: 'reqMention',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-req-id'),
        renderHTML: (attrs: { id?: string }) => ({ 'data-req-id': attrs.id ?? '' }),
      },
      label: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-req-key') ?? el.textContent,
        renderHTML: (attrs: { label?: string }) => ({ 'data-req-key': attrs.label ?? '' }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-req-badge]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      class: 'req-badge',
      'data-req-badge': '',
      'data-req-id': node.attrs.id ?? '',
      'data-req-key': node.attrs.label ?? '',
    }), node.attrs.label ?? ''];
  },
});

// ---------- Извлечение связей «текст ↔ требование» для tz_requirement_mentions ----------

export interface MentionInfo { reqId: string; reqKey: string; start: number; end: number; text: string; }

/** Проход по документу: mark-подсветки → offset'ы в конкатенированном тексте */
export function extractMentions(editor: Editor): MentionInfo[] {
  const raw: MentionInfo[] = [];
  let plain = 0;
  editor.state.doc.descendants((node) => {
    if (node.isText) {
      const mark = node.marks.find((m) => m.type.name === 'req');
      const text = node.text ?? '';
      if (mark && text.length > 0) {
        raw.push({
          reqId: String(mark.attrs.reqId ?? ''), reqKey: String(mark.attrs.reqKey ?? ''),
          start: plain, end: plain + text.length, text,
        });
      }
      plain += text.length;
    }
    return true;
  });
  // Склеиваем соседние фрагменты с одним требованием
  const out: MentionInfo[] = [];
  for (const m of raw) {
    const last = out[out.length - 1];
    if (last && last.reqKey === m.reqKey && m.start - last.end <= 2) {
      last.end = m.end;
      last.text += m.text;
    } else {
      out.push({ ...m });
    }
  }
  return out;
}

// ---------- Панель инструментов ----------

function ToolBtn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-md p-1.5 transition-all',
        active ? 'bg-teal/15 text-teal shadow-[inset_0_0_0_1px_rgba(64,211,182,0.35)]' : 'text-faint hover:bg-bg3 hover:text-dim',
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Адрес ссылки (https://…)', prev ?? 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line/70 bg-bg2/80 px-2 py-1.5">
      <ToolBtn title="Жирный" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></ToolBtn>
      <ToolBtn title="Курсив" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></ToolBtn>
      <ToolBtn title="Зачёркнутый" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={14} /></ToolBtn>
      <span className="mx-1 h-4 w-px bg-line" />
      <ToolBtn title="Заголовок раздела" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={14} /></ToolBtn>
      <ToolBtn title="Подзаголовок" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={14} /></ToolBtn>
      <ToolBtn title="Цитата" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={14} /></ToolBtn>
      <span className="mx-1 h-4 w-px bg-line" />
      <ToolBtn title="Маркированный список" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={14} /></ToolBtn>
      <ToolBtn title="Нумерованный список" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></ToolBtn>
      <span className="mx-1 h-4 w-px bg-line" />
      <ToolBtn title="Ссылка" active={editor.isActive('link')} onClick={setLink}><Link2 size={14} /></ToolBtn>
      {editor.isActive('link') && (
        <ToolBtn title="Убрать ссылку" onClick={() => editor.chain().focus().unsetLink().run()}><Unlink size={14} /></ToolBtn>
      )}
      <span className="ml-auto" />
      <ToolBtn title="Отменить" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={14} /></ToolBtn>
      <ToolBtn title="Повторить" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={14} /></ToolBtn>
    </div>
  );
}

// ---------- Основной компонент ----------

export interface RichEditorProps {
  /** HTML-содержимое при монтировании (редактор пересоздаётся по key) */
  initialContent: string;
  placeholder?: string;
  /** Режим Таба 1: фиксация выделенного текста как требования */
  captureMode?: boolean;
  /** Режим Таба 3: @-autocomplete требований */
  mentionAutocomplete?: boolean;
  /** Список требований проекта (для autocomplete и диалога фиксации) */
  requirements?: Requirement[];
  /** Вызывается при нажатии «📌 Зафиксировать» с выделенным текстом */
  onCapture?: (selectedText: string) => void;
  /** Доступ к экземпляру редактора (извлечение mentions, getHTML при сохранении) */
  onReady?: (editor: Editor) => void;
}

export function RichEditor({
  initialContent, placeholder, captureMode, mentionAutocomplete, requirements = [], onCapture, onReady,
}: RichEditorProps) {
  const [sugg, setSugg] = useState<{ x: number; y: number; query: string; from: number } | null>(null);
  const [suggIdx, setSuggIdx] = useState(0);
  const suggRef = useRef(sugg);
  suggRef.current = sugg;
  const itemsRef = useRef<Requirement[]>([]);

  const refreshSuggestion = useCallback((ed: Editor) => {
    const { from, to } = ed.state.selection;
    if (from !== to) { setSugg(null); return; }
    const start = Math.max(0, from - 64);
    const before = ed.state.doc.textBetween(start, from, '\n');
    const m = before.match(/@([A-Za-zА-Яа-я0-9_-]*)$/);
    if (!m) { setSugg(null); return; }
    const coords = ed.view.coordsAtPos(from - m[1].length - 1);
    console.log('[Editor] @-autocomplete triggered:', { query: m[1], from, coords });
    setSugg({ x: coords.left, y: coords.bottom + 6, query: m[1], from: from - m[1].length - 1 });
    setSuggIdx(0);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: 'rt-link' } }),
      Placeholder.configure({ placeholder: placeholder ?? 'Начните вводить текст документа…' }),
      ReqMark,
      ...(mentionAutocomplete ? [ReqMention] : []),
    ],
    content: initialContent,
    editorProps: {
      handleKeyDown: (_view, event) => {
        const s = suggRef.current;
        const items = itemsRef.current;
        if (s && items.length > 0) {
          if (event.key === 'ArrowDown') { setSuggIdx((i) => (i + 1) % items.length); return true; }
          if (event.key === 'ArrowUp') { setSuggIdx((i) => (i - 1 + items.length) % items.length); return true; }
          if (event.key === 'Enter') { pickSuggestion(items[Math.min(suggIdx, items.length - 1)]); return true; }
          if (event.key === 'Escape') { setSugg(null); return true; }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (mentionAutocomplete) refreshSuggestion(ed);
    },
    onCreate: ({ editor: ed }) => { onReady?.(ed); },
  });

  // Фильтрация требований для autocomplete: @REQ-… или фрагмент названия
  const suggItems = sugg
    ? requirements.filter((r) => {
      const q = sugg.query.toLowerCase();
      return r.reqKey.toLowerCase().includes(q) || r.title.toLowerCase().includes(q);
    }).slice(0, 8)
    : [];
  itemsRef.current = suggItems;

  const pickSuggestion = (r: Requirement | undefined) => {
    const s = suggRef.current;
    if (!editor || !s || !r) return;
    const { from } = editor.state.selection;
    editor.chain().focus()
      .deleteRange({ from: s.from, to: from })
      .insertContent([{ type: 'reqMention', attrs: { id: r.id, label: r.reqKey } }, ' '])
      .run();
    setSugg(null);
  };

  if (!editor) return null;

  const hasReqMark = editor.isActive('req');

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-bg2/40 transition-colors focus-within:border-teal/50">
      <Toolbar editor={editor} />

      {/* Плавающая кнопка фиксации (Таб 1) */}
      {captureMode && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 120, zIndex: 60, maxWidth: 340 }}
          shouldShow={({ editor: ed, from, to }) => from !== to && ed.state.doc.textBetween(from, to, ' ').trim().length > 0}
        >
          <div className="flex items-center gap-1 rounded-lg border border-line2 bg-bg1 px-1.5 py-1 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
            <button
              type="button"
              onClick={() => {
                const { from, to } = editor.state.selection;
                onCapture?.(editor.state.doc.textBetween(from, to, ' ').trim());
              }}
              className="flex cursor-pointer items-center gap-1.5 rounded-md bg-amber px-2.5 py-1.5 text-[12px] font-bold text-[#2a1a04] transition-transform hover:scale-[1.03] active:scale-95"
            >
              <Pin size={13} />
              📌 Зафиксировать как требование
            </button>
            {hasReqMark && (
              <button
                type="button"
                title="Снять фиксацию"
                onClick={() => editor.chain().focus().unsetMark('req').run()}
                className="cursor-pointer rounded-md px-2 py-1.5 text-[12px] font-semibold text-faint transition-colors hover:bg-bg3 hover:text-coral"
              >
                Снять
              </button>
            )}
          </div>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} />

      {/* Подсказка по @-упоминаниям (Таб 3) */}
      {mentionAutocomplete && sugg && suggItems.length > 0 && createPortal(
        <div
          className="fixed z-[65] w-[340px] overflow-hidden rounded-lg border border-line2 bg-bg1 shadow-[0_16px_44px_rgba(0,0,0,0.55)]"
          style={{ left: Math.min(sugg.x, window.innerWidth - 356), top: sugg.y }}
        >
          <p className="border-b border-line/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
            Требования · {suggItems.length}
          </p>
          {suggItems.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickSuggestion(r)}
              onMouseEnter={() => setSuggIdx(i)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors',
                i === suggIdx ? 'bg-teal/10' : 'hover:bg-bg2/70',
              )}
            >
              <span className="shrink-0 font-mono text-[11.5px] font-bold text-teal">{r.reqKey}</span>
              <span className="truncate text-[12px] text-dim">{r.title}</span>
            </button>
          ))}
          <p className="flex items-center gap-1.5 border-t border-line/60 px-3 py-1.5 text-[10.5px] text-faint">
            <TextQuote size={11} /> ↑↓ — выбор · Enter — вставить бейдж
          </p>
        </div>,
        document.body,
      )}
    </div>
  );
}
