# Архитектура Requirements Tracker

## Слои

```
┌───────────────────────────────────────────────────────────┐
│ FRONTEND (React + TS)                                     │
│  features/ ─ Таб 2 «Матрица», Табы 1,3,4,5,6 (итерации)    │
│  components/ ─ UI-кит, Sidebar (проекты + интеграции)      │
│  domain/ ─ типы и чистая бизнес-логика                     │
│      nextReqKey() · fsStatus() · testsStatus()             │
│  services/db.ts ─ демо-хранилище (заменяется на REST)      │
└──────────────────────────┬────────────────────────────────┘
                           │ REST /api/… (JSON, UTF-8)
┌──────────────────────────▼────────────────────────────────┐
│ BACKEND (FastAPI)                                         │
│  routers/ ─ projects · requirements · features ·           │
│             documents · integrations                       │
│  crud.py ─ операции + diff-история                         │
│  services/ ─ id_generator · coverage · change_detection    │
│  integrations_client.py ─ Jira/Confluence                  │
│      (verify=False, timeout=10, кэш TTL=300)               │
└──────────────────────────┬────────────────────────────────┘
                           │ SQLAlchemy 2.0 / Alembic
┌──────────────────────────▼────────────────────────────────┐
│ SQLite  data/app.db   ·   data/{mockups,attachments,snapshots} │
└───────────────────────────────────────────────────────────┘
```

## Схема БД (11 таблиц)

| Таблица | Назначение | Ключевые поля |
|---|---|---|
| `projects` | Мультипроектность | `jira_key` (UNIQUE), `name` |
| `requirements` | Атомарные требования (Таб 2) | `req_key` (UNIQUE, автогенерация), `req_type` (BUS/FUNC/NFUNC), `link_tz`, `link_chtz`, `release`, `dependencies`, `updated_at`, `last_validated_fs`, `last_validated_test` |
| `requirement_history` | История изменений | `field_changed`, `old_value`, `new_value`, `changed_at` |
| `tz_documents` | Исходные ТЗ (Таб 1) | `content` (HTML с подсветкой), `attached_file_path` |
| `tz_requirement_mentions` | «Выделенный текст → требование» | `start_offset`, `end_offset`, `highlighted_text` |
| `chtz_documents` | ЧТЗ (Таб 3) | `content` |
| `feature_tree` | Дерево Релиз → Фича (Таб 4) | `parent_id`, `node_type` (RELEASE/FEATURE), `order_num` |
| `features` | Фиче-страницы | `link_jira`, `link_test_cases`, `updated_at`, `last_validated` |
| `feature_requirements` | Фича ↔ требование (M:N) | composite PK |
| `mockups` | Макеты фич | `file_path` → data/mockups/ |
| `feature_history` | История фич (Таб 5) | `change_type` (CONTENT/COMPOSITION) |
| `change_requests` | Журнал новых требований | `budget_impact_hours`, `timeline_impact_days`, `status` (AGREED/IN_PROGRESS/REJECTED/IMPLEMENTED) |

## Ключевые потоки данных

### 1. Автогенерация ID (Итерация 1)
`POST /api/projects/{pid}/requirements` → `services/id_generator.next_req_key()` →
`REQ-{JIRA_KEY}-{BUS|FUNC|NFUNC}-{NNNN}`, NNNN = max+1 в пределах проекта и типа.
Логика продублирована на фронтенде (`domain/logic.ts`) для живого предпросмотра ключа в форме.

### 2. Сброс актуальности при сохранении (Итерация 1)
`PUT /api/requirements/{id}` → diff полей → записи в `requirement_history` →
`updated_at = now`. Статусы **не хранятся**, а вычисляются:
- 🟢 Актуально — `last_validated ≥ updated_at`
- ⚠ Требует проверки — `updated_at > last_validated`
- 🔴 Не создано — `last_validated IS NULL`

### 3. Рассинхронизации (Таб 5, логика готова в `services/change_detection`)
- `requirement.updated_at > feature.last_validated` для всех привязанных фич → строка
  «Требование | Дата изменения | Фича | Последняя валидация».
- `feature.updated_at > feature.last_validated` → тест-кейсы не обновлены.
- «✅ Подтвердить актуальность» → `PUT /api/requirements/{id}/validate/{fs|tests}`.

### 4. Интеграции (verify=False)
Фронтенд не ходит на серверы с самоподписанным SSL напрямую: только через
`/api/integrations/...`, где `requests.get(url, auth=(login, password), verify=False, timeout=10)`,
предупреждения urllib3 отключены, ответы кэшируются 300 с. Конфигурация — `data/config.json`
(пишется из боковой панели: URL Jira, URL Confluence, логин, пароль, ключ проекта).

### 5. Фиксация требования из ТЗ (Итерация 2, реализовано)
Выделение в TipTap → BubbleMenu «📌 Зафиксировать как требование» → `POST /requirements`
(автоключ) → mark `req` с attrs `reqId/reqKey` оборачивает выделение → «💾 Сохранить»:
`extractMentions()` проходит документ, считает plain-text offset'ы →
`POST /api/projects/{pid}/tz` (content + mentions[]) → бэкенд перезаписывает
`tz_requirement_mentions`. Подсветка — голубой `<mark class="req-hl">`, tooltip —
CSS `::after` с `attr(data-req-key)`, клик → `/matrix?req=REQ-…` (deep-link открывает карточку).

### 6. @-упоминания в ЧТЗ (Итерация 2, реализовано)
Ввод `@` → матчинг `@([A-Za-zА-Яа-я0-9_-]*)$` перед курсором → popup у каретки
(`view.coordsAtPos`), навигация ↑↓/Enter → вставка атомарного узла `reqMention`
(serialize: `<span class="req-badge" data-req-id data-req-key>`). Список связанных
требований извлекается из HTML регуляркой по `data-req-key`.

### 7. Фиче-страницы (Итерация 2, реализовано)
`feature_tree` (RELEASE/FEATURE, order_num) + `features` (tree_node_id). Drag-n-drop:
фича → релиз (смена parent_id) или перед фичей (пересчёт order_num соседей на бэкенде,
`POST /api/tree/{id}/move`). Контекстное меню: добавить/переименовать/удалить (каскад:
feature_requirements, feature_history, mockups). Привязка требований — M:N
`feature_requirements`. Макеты: `POST /api/features/{id}/mockups` → `data/mockups/`,
раздача через `StaticFiles /files` (проксируется Vite наравне с `/api`).

### 8. Автосвязка фронтенда и бэкенда
`vite.config.js`: `server.proxy` для `/api` и `/files` → `:8000`, порт 3000, `open: true`.
Фронтенд ходит только относительными путями. `services/db.ts` при старте:
`checkHealth()` → режим `api` (write-through: каждое действие = REST-вызов + обновление кэша)
или `demo` (localStorage). UI не знает о режиме — единый `useApp()` и асинхронные действия.

## Решения

- **HashRouter** на фронтенде — приложение корректно работает из `file://` в Tauri/Electron.
- **Статусы — вычисляемое состояние**, а не колонки: нет рассинхрона данных, Таб 5 — чистая выборка.
- **Демо-режим** повторяет REST-контракт действиями в `services/db.ts` — переезд на backend
  не меняет ни один UI-компонент.
- **UTF-8** везде: Pydantic/JSON, openpyxl, фонт-фолбэки с кириллицей (IBM Plex Sans, JetBrains Mono).
