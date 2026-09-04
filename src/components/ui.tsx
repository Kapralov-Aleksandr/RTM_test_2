// ============================================================
// UI-кит RMS (в духе shadcn/ui: владеем компонентами сами).
// Анимации — framer-motion, иконки — lucide-react.
// ============================================================

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import {
  useEffect, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes,
  type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';

export type Tone = 'teal' | 'amber' | 'coral' | 'grass' | 'sky' | 'dim';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// ---------- Кнопки ----------

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-amber text-[#2a1a04] hover:bg-[#ffb955] shadow-[0_4px_18px_rgba(245,168,62,0.22)]',
  secondary: 'bg-bg3 text-ink border border-line2 hover:border-teal/50 hover:text-teal',
  ghost: 'text-dim hover:text-ink hover:bg-bg2 border border-transparent',
  danger: 'bg-coral/15 text-coral border border-coral/40 hover:bg-coral/25',
};

export function Button({
  variant = 'secondary', size = 'md', className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'px-3 py-1.5 text-[12.5px]' : 'px-4 py-2 text-[13.5px]',
        btnVariants[variant], className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------- Формы ----------

export const inputCls =
  'w-full rounded-lg border border-line bg-bg2/80 px-3 py-2 text-[13.5px] text-ink placeholder:text-faint outline-none transition-colors focus:border-teal/60 focus:bg-bg2';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputCls, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputCls, 'cursor-pointer', className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{label}</span>
      {children}
    </label>
  );
}

// ---------- Бейджи и точки ----------

const badgeTones: Record<Tone, string> = {
  teal: 'border-teal/40 bg-teal/10 text-teal',
  amber: 'border-amber/40 bg-amber/10 text-amber',
  coral: 'border-coral/40 bg-coral/10 text-coral',
  grass: 'border-grass/40 bg-grass/10 text-grass',
  sky: 'border-sky/40 bg-sky/10 text-sky',
  dim: 'border-line bg-bg2 text-dim',
};

export function Badge({ tone = 'dim', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold', badgeTones[tone], className)}>
      {children}
    </span>
  );
}

const dotTones: Record<Tone, string> = {
  teal: 'bg-teal text-teal', amber: 'bg-amber text-amber', coral: 'bg-coral text-coral',
  grass: 'bg-grass text-grass', sky: 'bg-sky text-sky', dim: 'bg-faint text-faint',
};

export function Dot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', dotTones[tone], pulse && 'pulse-dot')} />;
}

// ---------- Панели ----------

export function Panel({
  title, sub, icon, actions, children, className, pad = true,
}: {
  title?: string; sub?: string; icon?: ReactNode; actions?: ReactNode;
  children: ReactNode; className?: string; pad?: boolean;
}) {
  return (
    <section className={cn('rounded-xl border border-line bg-bg1/90 shadow-[0_10px_30px_rgba(2,12,16,0.35)]', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center gap-3 border-b border-line/70 px-5 py-4">
          {icon && <span className="text-teal">{icon}</span>}
          <div className="min-w-0 flex-1">
            {title && <h2 className="font-display text-[13px] font-bold tracking-wide text-ink">{title}</h2>}
            {sub && <p className="mt-0.5 text-[12px] text-faint">{sub}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[20px] font-bold tracking-wide text-ink">{title}</h1>
        {sub && <p className="mt-1.5 max-w-[640px] text-[13px] leading-relaxed text-faint">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------- Статистика со счётчиком ----------

export function Stat({
  label, value, suffix = '', sub, tone = 'teal', icon, delay = 0,
}: {
  label: string; value: number; suffix?: string; sub?: string;
  tone?: Tone; icon?: ReactNode; delay?: number;
}) {
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - t0) / 750));
      const eased = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay]);

  const toneCls: Record<Tone, string> = {
    teal: 'text-teal', amber: 'text-amber', coral: 'text-coral',
    grass: 'text-grass', sky: 'text-sky', dim: 'text-dim',
  };
  return (
    <div className="reveal in group rounded-xl border border-line bg-bg1/90 p-4 transition-all hover:-translate-y-0.5 hover:border-line2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{label}</span>
        <span className={cn('transition-transform group-hover:scale-110', toneCls[tone])}>{icon}</span>
      </div>
      <p className={cn('font-display mt-2 text-[26px] font-bold leading-none', toneCls[tone])}>
        {disp}
        <span className="text-[16px]">{suffix}</span>
      </p>
      {sub && <p className="mt-1.5 text-[11.5px] text-faint">{sub}</p>}
    </div>
  );
}

// ---------- Пустые состояния ----------

export function EmptyState({ icon, title, sub, action }: { icon?: ReactNode; title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl border border-line bg-bg2 text-faint">{icon}</div>}
      <p className="font-display text-[13.5px] font-bold text-dim">{title}</p>
      {sub && <div className="mt-1.5 max-w-[420px] text-[12.5px] leading-relaxed text-faint">{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------- Reveal при скролле ----------

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('in'); io.disconnect(); } },
      { threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn('reveal', className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// ---------- Модальные окна и шторки (framer-motion) ----------

export function Dialog({ open, onClose, title, children, width = 460 }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-bg0/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.94, y: 14, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, y: 8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative w-full rounded-xl border border-line2 bg-bg1 shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
            style={{ maxWidth: width }}
          >
            <header className="flex items-center justify-between border-b border-line/70 px-5 py-3.5">
              <h3 className="font-display text-[13px] font-bold text-ink">{title}</h3>
              <button onClick={onClose} className="cursor-pointer text-faint transition-colors hover:text-ink"><X size={17} /></button>
            </header>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Drawer({ open, onClose, title, sub, children, width = 560 }: {
  open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-bg0/60 backdrop-blur-[2px]" onClick={onClose} />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line2 bg-bg1 shadow-[-24px_0_60px_rgba(0,0,0,0.5)]"
            style={{ maxWidth: width }}
          >
            <header className="flex items-start justify-between gap-3 border-b border-line/70 px-6 py-4">
              <div className="min-w-0">
                <div className="font-display text-[14px] font-bold text-ink">{title}</div>
                {sub && <div className="mt-0.5 text-[12px] text-faint">{sub}</div>}
              </div>
              <button onClick={onClose} className="cursor-pointer text-faint transition-colors hover:text-ink"><X size={18} /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Тосты ----------

export interface ToastItem { id: number; msg: string; tone: 'ok' | 'warn' | 'err'; }

const toastBus = new Set<(t: ToastItem) => void>();
let toastSeq = 0;

export function toast(msg: string, tone: ToastItem['tone'] = 'ok') {
  const t: ToastItem = { id: ++toastSeq, msg, tone };
  toastBus.forEach((fn) => fn(t));
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const fn = (t: ToastItem) => {
      setItems((v) => [...v.slice(-3), t]);
      setTimeout(() => setItems((v) => v.filter((x) => x.id !== t.id)), 4200);
    };
    toastBus.add(fn);
    return () => { toastBus.delete(fn); };
  }, []);

  const meta = {
    ok: { icon: <CheckCircle2 size={16} />, cls: 'border-grass/50 text-grass' },
    warn: { icon: <AlertTriangle size={16} />, cls: 'border-amber/50 text-amber' },
    err: { icon: <XCircle size={16} />, cls: 'border-coral/50 text-coral' },
  };

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex w-[min(380px,calc(100vw-40px))] flex-col gap-2">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line2 bg-bg2/95 px-3.5 py-3 shadow-[0_12px_36px_rgba(0,0,0,0.5)] backdrop-blur"
          >
            <span className={cn('mt-0.5 shrink-0', meta[t.tone].cls)}>{meta[t.tone].icon}</span>
            <p className="flex-1 text-[12.5px] leading-snug text-ink">{t.msg}</p>
            <button onClick={() => setItems((v) => v.filter((x) => x.id !== t.id))} className="shrink-0 cursor-pointer text-faint transition-colors hover:text-ink">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ---------- Прогресс ----------

export function ProgressBar({ value, tone = 'teal', className }: { value: number; tone?: Tone; className?: string }) {
  const fill: Record<Tone, string> = {
    teal: 'bg-teal', amber: 'bg-amber', coral: 'bg-coral',
    grass: 'bg-grass', sky: 'bg-sky', dim: 'bg-faint',
  };
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-bg3', className)}>
      <div className={cn('bar-grow h-full rounded-full', fill[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

// ---------- Разное ----------

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-lg border border-line/70 bg-bg2/50 px-3.5 py-2.5 text-[12px] leading-relaxed text-faint">
      <span className="mt-0.5 shrink-0 text-teal"><Info size={14} /></span>
      <span>{children}</span>
    </p>
  );
}
