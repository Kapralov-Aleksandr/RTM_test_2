// ============================================================
// Слой данных RMS.
//
// Архитектурный контракт: UI работает ТОЛЬКО через этот модуль
// (useApp + действия). Сейчас состояние хранится в localStorage;
// при переезде на FastAPI + SQLite/PostgreSQL достаточно заменить
// реализации действий на REST-вызовы:
//
//   saveRequirement      → PUT  /api/requirements/{id}
//   addRequirement       → POST /api/requirements
//   saveFeatureVersion   → POST /api/features/{id}/versions
//   addNotice            → POST /api/notices
//   addNewReq            → POST /api/new-requirements
//   updateNewReq         → PUT  /api/new-requirements/{id}
//   setJiraIssues        → POST /api/integrations/jira/sync
//
// Сигнатуры функций при этом не изменятся — модули не трогаются.
// ============================================================

import { useSyncExternalStore } from 'react';
import { v4 as uuid } from 'uuid';
import type {
  AppState, ChangeNotice, FeatureVersion, JiraIssue, NewRequirement,
  Requirement, Settings,
} from '../domain/types';
import { nextNewReqCode } from '../domain/lifecycle';

const STORAGE_KEY = 'rms.state.v1';
const SCHEMA_VERSION = 1;

// ---------- Демо-данные (проект «АСУ Приёмная кампания») ----------

const now = (daysAgo: number, h = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, 15, 0, 0);
  return d.toISOString();
};

function seedState(): AppState {
  return {
    version: SCHEMA_VERSION,
    tzDoc: {
      code: 'ТЗ-045/2024',
      title: 'Автоматизированная система управления приёмной кампанией',
      client: 'Томский государственный архитектурно-строительный университет',
      receivedAt: '2024-09-12',
    },
    tzChapters: [
      { code: '3.1', title: 'Личный кабинет абитуриента' },
      { code: '3.2', title: 'Подача заявлений и документов' },
      { code: '3.3', title: 'Рейтинговые списки и приказы' },
      { code: '3.4', title: 'Уведомления и интеграции' },
    ],
    members: [
      { id: 'm-pm', name: 'Дмитрий Кузнецов', role: 'pm' },
      { id: 'm-an', name: 'Анна Соловьёва', role: 'analyst' },
      { id: 'm-qa', name: 'Марина Орлова', role: 'qa' },
      { id: 'm-d1', name: 'Игорь Волков', role: 'dev' },
      { id: 'm-d2', name: 'Павел Лебедев', role: 'dev' },
    ],
    features: [
      {
        id: 'fs-1', code: 'FS-001', confluenceId: '8451201', ownerId: 'm-an',
        title: 'Личный кабинет абитуриента',
        bodyMd: [
          '## Бизнес-ценность',
          'Абитуриент создаёт личный кабинет и заполняет базовые данные.',
          '',
          '## Основной сценарий',
          '- Регистрация по e-mail или через ЕПГУ (Госуслуги)',
          '- Заполнение профиля',
          '- Загрузка документов',
          '- Восстановление пароля через SMS-код',
          '',
          '## Граничные случаи',
          '- Дубликаты аккаунтов объединяются оператором',
        ].join('\n'),
        versions: [
          {
            id: 'fs1-v1', ts: now(130), authorId: 'm-an', note: 'Первая версия по итогам разбора ТЗ',
            md: [
              '## Бизнес-ценность',
              'Абитуриент создаёт личный кабинет и заполняет базовые данные.',
              '',
              '## Основной сценарий',
              '- Регистрация по e-mail',
              '- Заполнение профиля',
              '- Загрузка документов',
            ].join('\n'),
          },
          {
            id: 'fs1-v2', ts: now(38), authorId: 'm-an', note: 'Добавлены вход через Госуслуги и восстановление пароля (письмо №118)',
            md: [
              '## Бизнес-ценность',
              'Абитуриент создаёт личный кабинет и заполняет базовые данные.',
              '',
              '## Основной сценарий',
              '- Регистрация по e-mail или через ЕПГУ (Госуслуги)',
              '- Заполнение профиля',
              '- Загрузка документов',
              '- Восстановление пароля через SMS-код',
              '',
              '## Граничные случаи',
              '- Дубликаты аккаунтов объединяются оператором',
            ].join('\n'),
          },
        ],
      },
      {
        id: 'fs-2', code: 'FS-002', confluenceId: '8451202', ownerId: 'm-an',
        title: 'Подача заявления и документов',
        bodyMd: [
          '## Бизнес-ценность',
          'Подача заявления на выбранные направления подготовки.',
          '',
          '## Основной сценарий',
          '- Выбор до 5 направлений',
          '- Пошаговый мастер заполнения',
          '- Загрузка сканов документов',
          '- Автосохранение черновика',
          '',
          '## Ограничения',
          '- Срок подачи — по правилам приёма',
          '- Скан до 5 МБ, PDF или JPEG',
        ].join('\n'),
        versions: [
          {
            id: 'fs2-v1', ts: now(120), authorId: 'm-an', note: 'Первая версия',
            md: [
              '## Бизнес-ценность',
              'Подача заявления на выбранные направления подготовки.',
              '',
              '## Основной сценарий',
              '- Выбор до 5 направлений',
              '- Пошаговый мастер заполнения',
              '- Загрузка сканов документов',
            ].join('\n'),
          },
          {
            id: 'fs2-v2', ts: now(21), authorId: 'm-an', note: 'Уточнения заказчика: автосохранение и лимиты на сканы',
            md: [
              '## Бизнес-ценность',
              'Подача заявления на выбранные направления подготовки.',
              '',
              '## Основной сценарий',
              '- Выбор до 5 направлений',
              '- Пошаговый мастер заполнения',
              '- Загрузка сканов документов',
              '- Автосохранение черновика',
              '',
              '## Ограничения',
              '- Срок подачи — по правилам приёма',
              '- Скан до 5 МБ, PDF или JPEG',
            ].join('\n'),
          },
        ],
      },
      {
        id: 'fs-3', code: 'FS-003', confluenceId: '8451203', ownerId: 'm-an',
        title: 'Рейтинговые списки и приказы о зачислении',
        bodyMd: [
          '## Бизнес-ценность',
          'Прозрачное ранжирование абитуриентов и формирование приказов.',
          '',
          '## Основной сценарий',
          '- Ранжирование по сумме баллов',
          '- Публикация рейтинговых списков',
          '- Формирование приказа о зачислении',
        ].join('\n'),
        versions: [
          {
            id: 'fs3-v1', ts: now(90), authorId: 'm-an', note: 'Первая версия',
            md: [
              '## Бизнес-ценность',
              'Прозрачное ранжирование абитуриентов и формирование приказов.',
              '',
              '## Основной сценарий',
              '- Ранжирование по сумме баллов',
              '- Публикация рейтинговых списков',
              '- Формирование приказа о зачислении',
            ].join('\n'),
          },
        ],
      },
      {
        id: 'fs-4', code: 'FS-004', confluenceId: '8451204', ownerId: 'm-an',
        title: 'Уведомления и интеграция с 1С',
        bodyMd: [
          '## Бизнес-ценность',
          'Абитуриент и приёмная комиссия вовремя получают статусы.',
          '',
          '## Основной сценарий',
          '- E-mail уведомления о статусах заявления',
          '- Синхронизация с «1С:Университет»',
          '- Импорт данных заявлений с ЕПГУ (Госуслуги)',
        ].join('\n'),
        versions: [
          {
            id: 'fs4-v1', ts: now(80), authorId: 'm-an', note: 'Первая версия',
            md: [
              '## Бизнес-ценность',
              'Абитуриент и приёмная комиссия вовремя получают статусы.',
              '',
              '## Основной сценарий',
              '- E-mail уведомления о статусах заявления',
              '- Синхронизация с «1С:Университет»',
            ].join('\n'),
          },
          {
            id: 'fs4-v2', ts: now(30), authorId: 'm-an', note: 'Добавлен импорт с ЕПГУ (новое требование NR-01)',
            md: [
              '## Бизнес-ценность',
              'Абитуриент и приёмная комиссия вовремя получают статусы.',
              '',
              '## Основной сценарий',
              '- E-mail уведомления о статусах заявления',
              '- Синхронизация с «1С:Университет»',
              '- Импорт данных заявлений с ЕПГУ (Госуслуги)',
            ].join('\n'),
          },
        ],
      },
    ],
    requirements: [
      { id: 'r-01', code: 'REQ-001', title: 'Регистрация абитуриента по e-mail', tzClause: '3.1.1', chtzSection: 'ЧТЗ-2.1', featureId: 'fs-1', jiraKey: 'ASU-301', priority: 'must', status: 'done', source: 'baseline', updatedAt: now(40), descriptionMd: '## Критерии приёмки\n- E-mail подтверждается по ссылке\n- Пароль не короче 8 символов\n- Повторная регистрация с тем же e-mail отклоняется' },
      { id: 'r-02', code: 'REQ-002', title: 'Профиль с персональными данными и документами', tzClause: '3.1.2', chtzSection: 'ЧТЗ-2.1', featureId: 'fs-1', jiraKey: 'ASU-302', priority: 'must', status: 'done', source: 'baseline', updatedAt: now(38), descriptionMd: '## Критерии приёмки\n- ФИО, дата рождения, СНИЛС\n- Валидация по формату документа\n- Черновик профиля сохраняется' },
      { id: 'r-03', code: 'REQ-003', title: 'Восстановление пароля через SMS-код', tzClause: '3.1.3', chtzSection: 'ЧТЗ-2.1', featureId: 'fs-1', jiraKey: 'ASU-303', priority: 'should', status: 'in_dev', source: 'baseline', updatedAt: now(12), descriptionMd: '## Критерии приёмки\n- Код действует 5 минут\n- Не более 3 попыток ввода\n- **Добавлено** письмом №118 от заказчика' },
      { id: 'r-04', code: 'REQ-004', title: 'Согласия на обработку персональных данных', tzClause: '3.1.4', chtzSection: 'ЧТЗ-2.1', featureId: 'fs-1', jiraKey: 'ASU-304', priority: 'must', status: 'approved', source: 'baseline', updatedAt: now(9), descriptionMd: '## Критерии приёмки\n- Версия согласия фиксируется с датой\n- Без согласия подача заявления блокируется' },
      { id: 'r-05', code: 'REQ-005', title: 'Выбор до 5 направлений подготовки', tzClause: '3.2.1', chtzSection: 'ЧТЗ-2.2', featureId: 'fs-2', jiraKey: 'ASU-305', priority: 'must', status: 'done', source: 'baseline', updatedAt: now(35), descriptionMd: '## Критерии приёмки\n- Лимит — 5 направлений\n- Порядок выбора влияет на приоритет зачисления' },
      { id: 'r-06', code: 'REQ-006', title: 'Пошаговый мастер подачи заявления', tzClause: '3.2.2', chtzSection: 'ЧТЗ-2.2', featureId: 'fs-2', jiraKey: 'ASU-306', priority: 'must', status: 'in_dev', source: 'baseline', updatedAt: now(6), descriptionMd: '## Критерии приёмки\n- 4 шага: данные → направления → документы → подтверждение\n- Автосохранение черновика' },
      { id: 'r-07', code: 'REQ-007', title: 'Загрузка сканов документов (до 5 МБ)', tzClause: '3.2.3', chtzSection: 'ЧТЗ-2.2', featureId: 'fs-2', jiraKey: '', priority: 'should', status: 'in_dev', source: 'baseline', updatedAt: now(5), descriptionMd: '## Критерии приёмки\n- Форматы PDF/JPEG, до 5 МБ\n- Превью после загрузки\n- *Задача в Jira ещё не заведена*' },
      { id: 'r-08', code: 'REQ-008', title: 'Ранжирование абитуриентов по сумме баллов', tzClause: '3.3.1', chtzSection: 'ЧТЗ-2.3', featureId: 'fs-3', jiraKey: 'ASU-308', priority: 'must', status: 'in_test', source: 'baseline', updatedAt: now(3), descriptionMd: '## Критерии приёмки\n- Сортировка по убыванию суммы баллов\n- При равенстве — по индивидуальному достижению' },
      { id: 'r-09', code: 'REQ-009', title: 'Формирование приказа о зачислении', tzClause: '3.3.2', chtzSection: 'ЧТЗ-2.3', featureId: 'fs-3', jiraKey: '', priority: 'could', status: 'approved', source: 'baseline', updatedAt: now(20), descriptionMd: '## Критерии приёмки\n- Выгрузка приказа в формате приказа Минобрнауки' },
      { id: 'r-10', code: 'REQ-010', title: 'Личный кабинет: статусы поданных заявлений', tzClause: '3.3.3', chtzSection: '', featureId: 'fs-3', jiraKey: 'ASU-309', priority: 'should', status: 'approved', source: 'baseline', updatedAt: now(15), descriptionMd: '## Критерии приёмки\n- Статусы: подано / проверено / зачислен / отказ\n- **Внимание:** раздел ЧТЗ ещё не описан аналитиком' },
      { id: 'r-11', code: 'REQ-011', title: 'E-mail уведомления о смене статуса заявления', tzClause: '3.4.1', chtzSection: 'ЧТЗ-2.4', featureId: 'fs-4', jiraKey: 'ASU-311', priority: 'should', status: 'in_dev', source: 'baseline', updatedAt: now(2), descriptionMd: '## Критерии приёмки\n- Письмо при каждой смене статуса\n- Отписка от уведомлений в один клик' },
      { id: 'r-12', code: 'REQ-012', title: 'Интеграция с ЕПГУ (Госуслуги)', tzClause: '—', chtzSection: '', featureId: 'fs-4', jiraKey: 'ASU-345', priority: 'should', status: 'draft', source: 'new', newReqId: 'nr-1', updatedAt: now(8), descriptionMd: '## Новое требование (NR-01)\nИмпорт данных заявления с портала Госуслуг.\n\n- Авторизация через ЕСИА\n- Маппинг полей заявления' },
    ],
    testCases: [
      { id: 'tc-01', code: 'TC-101', title: 'Регистрация с валидным e-mail', requirementId: 'r-01', suite: 'ПМИ-1. Личный кабинет', status: 'passed' },
      { id: 'tc-02', code: 'TC-102', title: 'Регистрация с дублирующимся e-mail', requirementId: 'r-01', suite: 'ПМИ-1. Личный кабинет', status: 'passed' },
      { id: 'tc-03', code: 'TC-103', title: 'Заполнение профиля: обязательные поля', requirementId: 'r-02', suite: 'ПМИ-1. Личный кабинет', status: 'passed' },
      { id: 'tc-04', code: 'TC-104', title: 'Загрузка документов: проверка форматов', requirementId: 'r-02', suite: 'ПМИ-1. Личный кабинет', status: 'ready' },
      { id: 'tc-05', code: 'TC-105', title: 'Восстановление пароля: SMS-код', requirementId: 'r-03', suite: 'ПМИ-1. Личный кабинет', status: 'ready' },
      { id: 'tc-06', code: 'TC-106', title: 'Выбор направлений: лимит 5', requirementId: 'r-05', suite: 'ПМИ-2. Подача заявления', status: 'passed' },
      { id: 'tc-07', code: 'TC-107', title: 'Мастер подачи: навигация по шагам', requirementId: 'r-06', suite: 'ПМИ-2. Подача заявления', status: 'ready' },
      { id: 'tc-08', code: 'TC-108', title: 'Загрузка скана свыше 5 МБ', requirementId: 'r-07', suite: 'ПМИ-2. Подача заявления', status: 'draft' },
      { id: 'tc-09', code: 'TC-109', title: 'Рейтинг: сортировка по баллам', requirementId: 'r-08', suite: 'ПМИ-3. Рейтинги', status: 'ready' },
      { id: 'tc-10', code: 'TC-110', title: 'Мобильная версия формы заявления', requirementId: '', suite: 'ПМИ-2. Подача заявления', status: 'draft' },
      { id: 'tc-11', code: 'TC-111', title: 'Миграция из старого личного кабинета', requirementId: 'r-99', suite: 'ПМИ-4. Миграция', status: 'draft' },
    ],
    jiraIssues: [
      { key: 'ASU-301', summary: 'Личный кабинет: регистрация', status: 'Готово' },
      { key: 'ASU-302', summary: 'Личный кабинет: профиль', status: 'Готово' },
      { key: 'ASU-303', summary: 'Восстановление пароля', status: 'В работе' },
      { key: 'ASU-304', summary: 'Согласия на обработку ПДн', status: 'К выполнению' },
      { key: 'ASU-305', summary: 'Выбор направлений: мастер', status: 'В работе' },
      { key: 'ASU-306', summary: 'Мастер подачи заявления', status: 'В работе' },
      { key: 'ASU-308', summary: 'Ранжирование по баллам', status: 'В работе' },
      { key: 'ASU-309', summary: 'Статусы заявлений в ЛК', status: 'К выполнению' },
      { key: 'ASU-311', summary: 'E-mail уведомления', status: 'В работе' },
      { key: 'ASU-345', summary: 'Интеграция с ЕПГУ', status: 'В работе' },
    ],
    newReqs: [
      { id: 'nr-1', code: 'NR-01', description: 'Интеграция с ЕПГУ (Госуслуги) для импорта данных заявления', source: 'Письмо заказчика', date: '2025-01-20', budgetHours: 40, termDays: 5, featureId: 'fs-4', jiraKey: 'ASU-345', status: 'implemented', requirementId: 'r-12' },
      { id: 'nr-2', code: 'NR-02', description: 'Экспорт рейтинговых списков в Excel для приёмной комиссии', source: 'Совещание', date: '2025-02-03', budgetHours: 24, termDays: 3, featureId: 'fs-3', jiraKey: '', status: 'in_work', requirementId: '' },
      { id: 'nr-3', code: 'NR-03', description: 'SMS-уведомления о смене статуса заявления', source: 'Уточнение к ТЗ', date: '2025-02-10', budgetHours: 16, termDays: 2, featureId: 'fs-4', jiraKey: '', status: 'approved', requirementId: '' },
      { id: 'nr-4', code: 'NR-04', description: 'Двухфакторная аутентификация для операторов приёмной комиссии', source: 'Совещание', date: '2024-12-15', budgetHours: 8, termDays: 1, featureId: '', jiraKey: '', status: 'rejected', requirementId: '' },
    ],
    notices: [
      {
        id: 'n-1', ts: now(38, 14), featureId: 'fs-1', versionId: 'fs1-v2',
        message: 'FS-001 обновлена: добавлены вход через Госуслуги и восстановление пароля по SMS. QA — актуализировать чек-листы ПМИ-1, разработка — оценить влияние на ASU-303.',
        audience: ['qa', 'dev'], done: false,
      },
    ],
    settings: {
      jiraUrl: 'https://jira.tomskasu.ru',
      confUrl: 'https://confluence.tomskasu.ru/wiki',
      login: '',
      password: '',
      projectKey: 'ASU',
      demoMode: true,
      lastJiraSync: '',
    },
  };
}

// ---------- Хранилище (useSyncExternalStore) ----------

function loadInitial(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.version === SCHEMA_VERSION && Array.isArray(parsed.requirements)) {
        return parsed;
      }
    }
  } catch {
    // повреждённые данные — пересеиваем
  }
  return seedState();
}

let state: AppState = loadInitial();
const listeners = new Set<() => void>();

function commit(next: AppState) {
  state = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  listeners.forEach((l) => l());
}

function setState(mut: (s: AppState) => AppState) {
  commit(mut(state));
}

/** Реактивное состояние приложения (рендер при любом изменении — масштаб данных небольшой) */
export function useApp(): AppState {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
  );
}

export function getState(): AppState {
  return state;
}

// ---------- Действия (командный слой) ----------

/** Сохранить изменения требования */
export function saveRequirement(req: Requirement) {
  setState((s) => ({
    ...s,
    requirements: s.requirements.map((r) => (r.id === req.id ? req : r)),
  }));
}

/** Создать атомарное требование (код присваивается автоматически) */
export function addRequirement(data: Omit<Requirement, 'id' | 'code' | 'updatedAt'>): Requirement {
  let created!: Requirement;
  setState((s) => {
    const max = s.requirements.reduce((m, r) => {
      const n = parseInt(r.code.replace(/\D/g, ''), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    created = {
      ...data,
      id: uuid(),
      code: `REQ-${String(max + 1).padStart(3, '0')}`,
      updatedAt: new Date().toISOString(),
    };
    return { ...s, requirements: [...s.requirements, created] };
  });
  return created;
}

/** Сохранить новую версию фиче-страницы (обновляет тело и историю) */
export function saveFeatureVersion(featureId: string, authorId: string, note: string, md: string): FeatureVersion {
  let created!: FeatureVersion;
  setState((s) => ({
    ...s,
    features: s.features.map((f) => {
      if (f.id !== featureId) return f;
      created = { id: uuid(), ts: new Date().toISOString(), authorId, note, md };
      return { ...f, bodyMd: md, versions: [...f.versions, created] };
    }),
  }));
  return created;
}

/** Добавить уведомление команды об изменении */
export function addNotice(n: Omit<ChangeNotice, 'id' | 'ts' | 'done'>) {
  setState((s) => ({
    ...s,
    notices: [{ ...n, id: uuid(), ts: new Date().toISOString(), done: false }, ...s.notices],
  }));
}

export function toggleNotice(id: string) {
  setState((s) => ({
    ...s,
    notices: s.notices.map((n) => (n.id === id ? { ...n, done: !n.done } : n)),
  }));
}

/** Добавить запись в журнал новых требований */
export function addNewReq(data: Omit<NewRequirement, 'id' | 'code' | 'requirementId'>): NewRequirement {
  let created!: NewRequirement;
  setState((s) => {
    created = { ...data, id: uuid(), code: nextNewReqCode(s), requirementId: '' };
    return { ...s, newReqs: [created, ...s.newReqs] };
  });
  return created;
}

export function updateNewReq(id: string, patch: Partial<NewRequirement>) {
  setState((s) => ({
    ...s,
    newReqs: s.newReqs.map((n) => (n.id === id ? { ...n, ...patch } : n)),
  }));
}

export function removeNewReq(id: string) {
  setState((s) => ({ ...s, newReqs: s.newReqs.filter((n) => n.id !== id) }));
}

export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

/** Обновить кэш задач Jira после синхронизации */
export function setJiraIssues(issues: JiraIssue[]) {
  setState((s) => ({
    ...s,
    jiraIssues: issues,
    settings: { ...s.settings, lastJiraSync: new Date().toISOString() },
  }));
}

/** Импорт резервной копии (полная замена состояния) */
export function replaceState(next: AppState) {
  commit(next);
}

/** Сброс к демо-данным */
export function resetDemo() {
  commit(seedState());
}
