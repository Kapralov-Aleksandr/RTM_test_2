# REST API · Requirements Tracker

Base URL: `http://localhost:8000` · Интерактивная документация: `http://localhost:8000/docs` (Swagger UI)

Все ответы — JSON, кодировка UTF-8. Ошибки: `{"detail": "сообщение на русском"}`.

## Служебные

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/health` | Живость сервиса: `{"status": "ok", "version": "0.1.0"}` |

## Проекты

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/projects` | Список проектов |
| POST | `/api/projects` | Создать проект `{jira_key, name}` (409 при дубликате ключа) |
| PUT | `/api/projects/{id}` | Переименовать / сменить ключ |
| DELETE | `/api/projects/{id}` | Удалить проект |

## Требования (Таб 2)

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/projects/{pid}/requirements?req_type=&release=&q=` | Список с фильтрами по типу, релизу и поиском |
| POST | `/api/projects/{pid}/requirements` | Создать — **ID генерируется автоматически** (`REQ-LC-FUNC-0015`) |
| GET | `/api/requirements/{id}` | Требование по id |
| PUT | `/api/requirements/{id}` | Сохранить: изменённые поля → история, `updated_at = now` (сброс актуальности) |
| PUT | `/api/requirements/{id}/validate/{kind}` | ✅ Подтвердить актуальность, `kind = fs \| tests` |
| DELETE | `/api/requirements/{id}` | Удалить |
| GET | `/api/requirements/{id}/history` | 📜 История изменений (поле, было → стало, дата) |

### Пример создания

```http
POST /api/projects/1/requirements
{
  "req_type": "FUNCTIONAL",
  "title": "Мастер подачи заявления",
  "description": "Пошаговый мастер: до 5 направлений…",
  "link_tz": "ТЗ §3.3",
  "release": "1.0",
  "dependencies": "REQ-LC-FUNC-0002"
}
→ 201 { "req_key": "REQ-LC-FUNC-0016", … }
```

## Аналитика (Таб 5 и Таб 6)

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/projects/{pid}/coverage` | Воронка `{tz_mentions → requirements → in_chtz → in_features → with_tests → validated}`, покрытие по типам, пробелы, сироты |
| GET | `/api/projects/{pid}/desync` | Рассинхронизации: `stale_requirements`, `stale_features` |

## Фиче-страницы (каркас Итерации 2)

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/projects/{pid}/tree` | Дерево релизов и фич |
| POST | `/api/projects/{pid}/tree` | Узел `{node_type: RELEASE\|FEATURE, name, parent_id}` |
| PUT | `/api/features/{id}` | Сохранить фичу: контент → `feature_history`, `updated_at = now` |
| POST | `/api/features/{fid}/requirements/{rid}` | Привязать требование (M:N) |

## Документы (каркас Итерации 2)

| Метод | Путь | Описание |
|---|---|---|
| GET/POST | `/api/projects/{pid}/tz` | Документ ТЗ (HTML-контент с подсветкой) |
| POST | `/api/projects/{pid}/tz/{id}/mentions` | 📌 Связь «выделенный текст → требование» `{requirement_id, start_offset, end_offset, highlighted_text}` |
| GET/POST | `/api/projects/{pid}/chtz` | Документ ЧТЗ |

## Интеграции (Итерация 4)

Прокси к корпоративным серверам: `verify=False`, `timeout=10`, Basic Auth, кэш 300 с.
Настройки читаются из `data/config.json` (сохраняются из боковой панели).

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/integrations/jira/issue/{key}` | Задача Jira: статус, исполнитель |
| GET | `/api/integrations/confluence/page/{id}` | Страница: заголовок, версия, `body.storage` |
| GET | `/api/integrations/confluence/page/{id}/version` | Текущая версия страницы |

Ошибки интеграций возвращаются как `502` с русским сообщением
(«Сервер недоступен…», «Таймаут (10 с)…», «Сервер отклонил credentials (401)…»).
