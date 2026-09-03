// ============================================================
// UI-кит: кнопки, панели, статистика, тосты, переключатели,
// анимация появления при скролле
// ============================================================

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconX } from './icons';

// ---------- Классы форм ----------
export const inputCls =
  'w-full rounded-md border border-line bg-bg2 px-3 py-2 text-[14px] text-ink placeholder:text-faint ' +
  'outline-none transition-colors focus:border-teal/60 focus:bg-bg3/60';

export const selectCls =
  'rounded-md border border-line bg-bg2 px-2.5 py-2 text-[13px] text-ink outline-none transition-colors ' +
  'focus:border-teal/60 cursor-pointer';

// ---------- Кнопки ----------
type BtnVariant = 'primary' | 'accent' | 'ghost' | 'danger';

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-all duration-150 ' +
  'active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none cursor-pointer select-none';

const btnVariants: Record<BtnVariant, string> = {
  primary:
    'bg-amber text-[#2a1a04] hover:bg-[#ffb955] shadow-[0_2px_14px_rgba(245,168,62,0.25)] hover:shadow-[0_4px_20px_rgba(245,168,62,0.4)] hover:-translate-y-px',
  accent:
    'border border-teal/50 text-teal hover:bg-teal/10 hover:border-teal hover:-translate-y-px',
  ghost:
    'border border-line text-dim hover:text-ink hover:border-line2 hover:bg-bg2',
  danger:
    'border border-coral/40 text-coral hover:bg-coral/10 hover:border-coral/70',
};

export function Button({
  variant = 'ghost',
  size = 'md',
  className = '',
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'px-3 py-1.5 text-[12.5px]' : 'px-4 py-2 text-[13.5px]';
  return (
    <button className={`${btnBase} ${btnVariants[variant]} ${sz} ${className}`} {...rest}>
      {children}
    </button>
  );
}

// ---------- Панель ----------
export function Panel({
  title,
  sub,
  icon,
  actions,
  children,
  className = '',
  pad = true,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border border-line bg-bg1/90 shadow-[0_8px_30px_rgba(0,0,0,0.25)] ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center gap-3 border-b border-line/70 px-5 py-4">
          {icon && <span className="grid h-9 w-9 place-items-center rounded-lg bg-bg2 text-teal border border-line">{icon}</span>}
          <div className="min-w-0 flex-1">
            {title && <h2 className="font-display text-[14px] font-semibold tracking-wide text-ink">{title}</h2>}
            {sub && <p className="mt-0.5 text-[12.5px] text-faint">{sub}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

// ---------- Плавный счётчик ----------
export function useCountUp(target: number, duration = 850): number {
  const [val, setVal] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const from = prevRef.current;
    if (from === target) { setVal(target); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// ---------- Карточка статистики ----------
export function Stat({
  label,
  value,
  suffix = '',
  sub,
  tone = 'teal',
  icon,
  delay = 0,
}: {
  label: string;
  value: number;
  suffix?: string;
  sub?: ReactNode;
  tone?: 'teal' | 'amber' | 'coral' | 'grass' | 'sky';
  icon?: ReactNode;
  delay?: number;
}) {
  const v = useCountUp(value);
  const toneText: Record<string, string> = {
    teal: 'text-teal', amber: 'text-amber', coral: 'text-coral', grass: 'text-grass', sky: 'text-sky',
  };
  const toneBg: Record<string, string> = {
    teal: 'bg-teal', amber: 'bg-amber', coral: 'bg-coral', grass: 'bg-grass', sky: 'bg-sky',
  };
  return (
    <Reveal delay={delay}>
      <div className="group relative overflow-hidden rounded-xl border border-line bg-bg1/90 p-4 transition-colors hover:border-line2">
        <span className={`absolute inset-x-0 top-0 h-[3px] opacity-70 transition-opacity group-hover:opacity-100 ${toneBg[tone]}`} />
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{label}</p>
          {icon && <span className={`${toneText[tone]} opacity-80`}>{icon}</span>}
        </div>
        <p className={`font-display mt-2 text-[30px] font-bold leading-none ${toneText[tone]}`}>
          {Math.round(v)}
          <span className="text-[17px] font-semibold">{suffix}</span>
        </p>
        {sub && <div className="mt-2 text-[12px] text-dim">{sub}</div>}
      </div>
    </Reveal>
  );
}

// ---------- Бейдж ----------
export type Tone = 'grass' | 'amber' | 'coral' | 'teal' | 'sky' | 'dim';

const badgeTones: Record<Tone, string> = {
  grass: 'bg-grass/12 text-grass border-grass/30',
  amber: 'bg-amber/12 text-amber border-amber/30',
  coral: 'bg-coral/12 text-coral border-coral/30',
  teal: 'bg-teal/12 text-teal border-teal/30',
  sky: 'bg-sky/12 text-sky border-sky/30',
  dim: 'bg-bg3/60 text-dim border-line',
};

export function Badge({ tone = 'dim', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${badgeTones[tone]} ${className}`}>
      {children}
    </span>
  );
}

// ---------- Точка-индикатор ----------
export function Dot({ tone, pulse = false }: { tone: Tone; pulse?: boolean }) {
  const colors: Record<Tone, string> = {
    grass: 'bg-grass text-grass',
    amber: 'bg-amber text-amber',
    coral: 'bg-coral text-coral',
    teal: 'bg-teal text-teal',
    sky: 'bg-sky text-sky',
    dim: 'bg-faint text-faint',
  };
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${colors[tone]} ${pulse ? 'pulse-dot' : ''}`} />;
}

// ---------- Появление при скролле ----------
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.06 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${inView ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// ---------- Пустое состояние ----------
export function EmptyState({
  icon,
  title,
  sub,
  action,
}: {
  icon: ReactNode;
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl border border-dashed border-line2 bg-bg2 text-faint">
        {icon}
      </span>
      <p className="font-display text-[15px] font-semibold text-ink">{title}</p>
      {sub && <div className="max-w-md text-[13px] leading-relaxed text-faint">{sub}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ---------- Переключатель ----------
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="group flex cursor-pointer items-center gap-2.5 text-left"
    >
      <span
        className={`relative h-[20px] w-[36px] shrink-0 rounded-full border transition-colors ${
          checked ? 'border-teal/60 bg-teal/25' : 'border-line2 bg-bg3'
        }`}
      >
        <span
          className={`absolute top-[2px] h-[14px] w-[14px] rounded-full transition-all ${
            checked ? 'left-[18px] bg-teal' : 'left-[2px] bg-faint'
          }`}
        />
      </span>
      <span className="text-[13px] text-dim transition-colors group-hover:text-ink">{label}</span>
    </button>
  );
}

// ---------- Поле формы ----------
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-faint">{hint}</span>}
    </label>
  );
}

// ---------- Спиннер ----------
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="spin text-current">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ---------- Тосты ----------
export interface ToastItem {
  id: number;
  msg: string;
  tone: 'ok' | 'warn' | 'err';
}

export function ToastHost({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: number) => void }) {
  const toneCls: Record<ToastItem['tone'], string> = {
    ok: 'border-l-grass text-grass',
    warn: 'border-l-amber text-amber',
    err: 'border-l-coral text-coral',
  };
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[340px] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line border-l-[3px] bg-bg2/95 px-3.5 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-sm ${toneCls[t.tone]}`}
        >
          <p className="flex-1 text-[13px] font-medium leading-snug text-ink">{t.msg}</p>
          <button
            onClick={() => dismiss(t.id)}
            className="cursor-pointer text-faint transition-colors hover:text-ink"
            aria-label="Закрыть"
          >
            <IconX size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
