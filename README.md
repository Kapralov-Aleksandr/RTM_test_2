# Requirements Tracker (RMS)

Локальная система управления требованиями для руководителя проекта: трассировка
**ТЗ → ЧТЗ → фиче-страницы → ПМИ → Jira** в едином месте.

## Зачем

| Боль | Решение |
|---|---|
| а) Неизвестно, все ли требования из ТЗ реализованы | Матрица с автогенерацией ID, статусы актуальности 🟢/⚠/🔴, воронка покрытия (Таб 6) |
| б) Новые требования теряются | Журнал Change Requests → одним действием в атомарные требования |
| в) Команда не узнаёт об изменениях фиче-страниц | last_validated-механика (Таб 5): «требование изменилось → фича/тесты не актуализированы» |
| г) Нет единого места трассировки | Все 6 табов работают с одной базой (SQLite) |

## Стек

- **Frontend**: React 18 + TypeScript (strict) + Vite, Tailwind CSS, framer-motion, lucide, recharts, SheetJS (импорт/экспорт Excel)
- **Backend**: FastAPI + SQLAlchemy 2.0 + Alembic, SQLite (локально), Pydantic v2
- **Интеграции**: Jira Server / Confluence Server — HTTP Basic Auth, `verify=False`, `timeout=10`, кэш TTL=300 с
- **Desktop (итерация 5)**: Tauri 2.0 (HashRouter уже на месте)
- **Редакторы (итерация 2)**: TipTap — выделение текста → «📌 Зафиксировать как требование», @-autocomplete требований

## Быстрый старт

```bat
start.bat          :: Windows: поднимет backend (uvicorn :8000) и frontend (vite :3000)
```
```bash
./start.sh         # Linux/macOS
```

**Примечание**: `start.bat` использует только ASCII-символы и работает в любой кодировке Windows (UTF-8, ANSI, Windows-1251).

Вручную:

```bash
# Backend
python -m venv backend/venv
backend/venv/Scripts/pip install -r backend/requirements.txt   # Windows
cd backend && python -m uvicorn main:app --reload --port 8000  # Swagger: http://localhost:8000/docs

# Frontend
npm install
npm run dev        # http://localhost:5173
```

**Демо-режим**: фронтенд из коробки работает с локальной демо-базой (localStorage) —
интеграции эмулируются, весь функционал Таба 2 доступен сразу. После запуска FastAPI
демо-режим выключается в боковой панели, и данные ведутся в `data/app.db`.

## Структура проекта

```
├── src/                      # Frontend (в целевой структуре — содержимое frontend/)
│   ├── domain/               # типы + бизнес-логика (зеркало backend/services)
│   ├── services/             # слой данных (демо-хранилище → REST-клиент)
│   ├── components/           # UI-кит, сайдбар
│   └── features/             # Таб 2 «Матрица», заглушки табов 1, 3–6
├── backend/
│   ├── main.py               # FastAPI entry point
│   ├── database.py           # 11 таблиц (SQLAlchemy 2.0)
│   ├── crud.py               # CRUD + diff-история изменений
│   ├── routers/              # projects, requirements, features, documents, integrations
│   ├── services/             # id_generator, coverage, change_detection
│   ├── tests/                # unit-тесты бизнес-логики (pytest)
│   └── alembic/              # миграции БД
├── data/                     # создаётся автоматически: app.db, mockups/, attachments/, snapshots/
├── start.bat / start.sh
└── README.md, ARCHITECTURE.md, API.md, DEVELOPMENT.md, USER_GUIDE.md
```

## Связка фронтенда и бэкенда (автоматически)

- Vite проксирует `/api/*` и `/files/*` на `http://localhost:8000` (настроено в `vite.config.js`) —
  фронтенд использует **относительные пути**, ручная настройка не требуется.
- При старте приложение само проверяет `GET /api/health`: backend жив → данные в **data/app.db**,
  не запущен → демо-режим (localStorage). Переключатель — внизу боковой панели.
- `start.bat` поднимает backend в свёрнутом окне, дожидается его готовности и открывает
  браузер на `http://localhost:3000` автоматически.

## Статус итераций

- ✅ **Итерация 1 (MVP)** — структура проекта, Таб 2 «Матрица» (CRUD, автогенерация
  `REQ-KEY-TYPE-NNNN`, фильтры, сортировка, история изменений, импорт Excel/CSV с маппингом,
  экспорт), боковая панель (настройки, мультипроектность, индикаторы), базовая БД (11 таблиц), unit-тесты.
- ✅ **Итерация 2** — Таб 1: ТЗ с TipTap, выделение текста → «📌 Зафиксировать как требование»,
  голубая подсветка с tooltip (клик → Таб 2), загрузка файла ТЗ, связи в `tz_requirement_mentions`;
  Таб 3: ЧТЗ с @-autocomplete (`@REQ-` → бейдж требования); Таб 4: дерево Релизы→Фичи с drag-n-drop
  и контекстным меню, привязка требований (модалка с поиском), макеты в `data/mockups`;
  автосвязка фронтенда с backend (прокси, автоопределение, data/app.db).
- ⏳ **Итерация 3** — Таб 5 (рассинхронизации, снапшоты Confluence, diff), Таб 6 (воронка, пробелы, сироты).
- ⏳ **Итерация 4** — живые интеграции Jira/Confluence, автосброс статусов.
- ⏳ **Итерация 5** — упаковка Tauri, экспорт PDF, оптимизации.

## Тесты и линтинг

```bash
cd backend && python -m pytest tests/ -v   # генерация ID, покрытие, детекция изменений
ruff check backend                          # Python
npm run build                               # TypeScript strict
```
