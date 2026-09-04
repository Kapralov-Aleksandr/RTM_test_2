# Руководство разработчика

## Развёртывание для разработки

Требования: **Python 3.11+**, **Node.js 18+**.

```bash
# 1. Backend
python -m venv backend/venv
backend/venv/Scripts/activate        # Windows: .bat; Linux/macOS: source backend/venv/bin/activate
pip install -r backend/requirements.txt
cd backend && python -m uvicorn main:app --reload --port 8000

# 2. Frontend (в отдельном терминале)
npm install
npm run dev
```

Или одной командой: `start.bat` / `./start.sh`.

## Полезные команды

```bash
cd backend && python -m pytest tests/ -v      # unit-тесты бизнес-логики
cd backend && ruff check .                    # линтинг Python
cd backend && alembic upgrade head            # накатить миграции
cd backend && alembic revision --autogenerate -m "описание"  # новая миграция
npm run build                                 # продакшен-сборка фронтенда (tsc strict)
```

## Как добавить новый таб

1. **Маршрут**: `src/App.tsx` — добавьте `<Route path="/…" element={…} />`.
2. **Пункт меню**: `src/components/Sidebar.tsx` — массив `TABS` (`to`, `num`, `label`, `icon`, `iter`).
   Пока таб в разработке — страница `StubPage` с роадмапом.
3. **Страница**: `src/features/<TabName>.tsx` — используйте UI-кит (`components/ui.tsx`):
   `PageHeader`, `Panel`, `Stat`, `Badge`, `Dialog`, `Drawer`, `toast()`.
4. **Данные**: действия добавляются в `src/services/db.ts` (демо-режим) и дублируются
   REST-эндпоинтом в `backend/routers/` — контракт фиксируется в `API.md`.
5. **Бэкенд**: модель в `backend/database.py` → схема в `backend/schemas.py` →
   CRUD в `backend/crud.py` → роутер в `backend/routers/` → миграция `alembic revision --autogenerate`.
6. **Документация**: обновите `README.md` (статус итераций) и `API.md`.

## Соглашения

- **TypeScript strict**: никаких `any` без необходимости, доменные типы — в `src/domain/types.ts`.
- **Бизнес-логика — чистые функции** в `src/domain/logic.ts` (фронтенд) и `backend/services/`
  (бэкенд). Критичная логика (генерация ID, покрытие, детекция изменений) покрыта unit-тестами.
- **Комментарии — на русском**, кодировка — UTF-8, сообщения об ошибках — информативные, по-русски.
- **Статусы актуальности не хранятся** — вычисляются из `updated_at` / `last_validated_*`.
- **Интеграции** — только через `backend/integrations_client.py`: `verify=False`, `timeout=10`, кэш 300 с.

## Переезд с демо-режима на backend

`src/services/db.ts` изолирует хранение: каждое действие документирует свой REST-эквивалент.
При живом backend действия заменяются на вызовы `fetch('/api/…')` — компоненты не меняются.
Демо-режим переключается в боковой панели и сохраняется в `data/config.json` (формат общий
для фронтенда и бэкенда — его читает `backend/routers/integrations.py`).

## Тесты

| Файл | Что проверяет |
|---|---|
| `backend/tests/test_id_generator.py` | Формат REQ-KEY-TYPE-NNNN, независимые счётчики типов и проектов, дополнение нулями |
| `backend/tests/test_coverage.py` | Воронка, покрытие по типам, пробелы (нет ЧТЗ), сироты (тесты без требований) |
| `backend/tests/test_change_detection.py` | Рассинхронизации «требование → фича» и «фича → тесты», включая never-validated |
