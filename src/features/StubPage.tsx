// ============================================================
// Заглушки табов будущих итераций: честный роадмап вместо
// битых кнопок. Каждая — с перечнем ключевых механик из ТЗ.
// ============================================================

import { CalendarClock, CheckCircle2, Sparkles } from 'lucide-react';
import { Reveal } from '../components/ui';

interface StubSpec {
  num: number;
  title: string;
  iteration: number;
  status: string;
  points: string[];
}

const STUBS: Record<string, StubSpec> = {
  '/tz': {
    num: 1, title: 'Исходное ТЗ заказчика', iteration: 2, status: 'В разработке',
    points: [
      'Редактор TipTap: жирный, курсив, списки, заголовки',
      'Выделение текста мышкой → «📌 Зафиксировать как требование»',
      'Голубая подсветка зафиксированного текста, tooltip с ключом REQ-…',
      'Клик по tooltip → переход к требованию в Табе 2',
      'Загрузка файла ТЗ (PDF/DOCX/TXT) → data/attachments/',
    ],
  },
  '/chtz': {
    num: 3, title: 'ЧТЗ · Аналитическая документация', iteration: 2, status: 'В разработке',
    points: [
      'Редактор TipTap для аналитической документации',
      'Ввод @REQ-LC- → autocomplete требований из матрицы',
      'Вставка ссылки-бейджа с ключом требования',
      'Кликабельные бейджи → переход к требованию',
    ],
  },
  '/features': {
    num: 4, title: 'Фиче-страницы', iteration: 2, status: 'В разработке',
    points: [
      'Дерево: релизы → фичи, drag-n-drop, контекстное меню',
      'Редактор содержимого фичи, ссылки на Jira и тест-кейсы',
      'Привязка требований: модалка с поиском, бейджи',
      'Макеты: drag-n-drop изображений → галерея',
    ],
  },
  '/monitor': {
    num: 5, title: 'Проверка изменений', iteration: 3, status: 'Запланировано',
    points: [
      'Рассинхронизации: требование изменилось → фича не актуализирована',
      'Фича изменилась → тест-кейсы не обновлены',
      'Сравнение снапшотов Confluence с подсветкой diff',
      '«✅ Подтвердить актуальность» → обновление last_validated',
    ],
  },
  '/coverage': {
    num: 6, title: 'Покрытие требований', iteration: 3, status: 'Запланировано',
    points: [
      'Воронка: ТЗ → Требования → ЧТЗ → Фичи → Тесты → Реализация',
      'Покрытие по типам BUSINESS / FUNCTIONAL / NON_FUNCTIONAL',
      'Пробелы: требования ТЗ, не попавшие в ЧТЗ',
      'Сироты: тест-кейсы без привязки · экспорт в Excel',
    ],
  },
};

export function StubPage({ path }: { path: string }) {
  const spec = STUBS[path];
  if (!spec) return null;

  return (
    <div className="mx-auto max-w-[720px] pt-4">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-line bg-bg1/90 shadow-[0_20px_60px_rgba(2,12,16,0.4)]">
          {/* декоративная полоса */}
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-teal/70 via-amber/70 to-transparent" />
          <div className="flex flex-col gap-6 p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="font-display grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-amber/40 bg-amber/10 text-[22px] font-extrabold text-amber">
                  {spec.num}
                </span>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-faint">Таб {spec.num} · Таб-роадмап</p>
                  <h1 className="font-display mt-1 text-[19px] font-bold text-ink">{spec.title}</h1>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full border border-sky/40 bg-sky/10 px-3 py-1 text-[11px] font-bold text-sky">
                <CalendarClock size={12} />
                Итерация {spec.iteration}
              </span>
            </div>

            <p className="text-[13.5px] leading-relaxed text-faint">
              Этот таб войдёт в продукт на <span className="font-semibold text-dim">итерации {spec.iteration}</span>.
              Фундамент итерации 1 — матрица требований, автогенерация ID, история изменений и мультипроектность —
              уже готов и станет основой для механик ниже.
            </p>

            <div className="flex flex-col gap-2.5 border-t border-line/70 pt-5">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-faint">Что будет внутри</p>
              {spec.points.map((p, i) => (
                <Reveal key={p} delay={i * 70}>
                  <div className="group flex items-start gap-3 rounded-lg border border-line/60 bg-bg2/40 px-4 py-3 transition-all hover:border-teal/40 hover:bg-bg2/70">
                    <span className="mt-0.5 text-teal opacity-60 transition-opacity group-hover:opacity-100">
                      <Sparkles size={14} />
                    </span>
                    <span className="text-[13px] leading-snug text-dim group-hover:text-ink">{p}</span>
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="flex items-center gap-2.5 rounded-lg border border-grass/30 bg-grass/[0.05] px-4 py-3">
              <CheckCircle2 size={15} className="shrink-0 text-grass" />
              <p className="text-[12px] leading-snug text-dim">
                Реализовано в итерации 1: <span className="font-semibold text-ink">Таб 2 «Матрица требований»</span> —
                CRUD, автогенерация REQ-KEY-TYPE-NNNN, статусы актуальности, история, импорт Excel/CSV.
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
