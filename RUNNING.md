# Инструкция по запуску Requirements Tracker

## Быстрый старт (Windows)

1. Убедитесь, что установлены:
   - Python 3.11+ (https://python.org) - добавьте в PATH при установке
   - Node.js LTS (https://nodejs.org)

2. Запустите `start.bat` двойным кликом

3. Дождитесь автоматического открытия браузера на http://localhost:3000

## Что делает start.bat

1. Проверяет наличие Python и Node.js
2. Создаёт виртуальное окружение Python (если нужно)
3. Устанавливает зависимости backend
4. Запускает FastAPI backend на порту 8000 (в свёрнутом окне)
5. Устанавливает зависимости frontend (npm install)
6. Запускает Vite frontend на порту 3000
7. Открывает браузер автоматически

## Проверка работоспособности

После запуска:
- Backend: http://localhost:8000/docs (Swagger UI)
- Frontend: http://localhost:3000

В логах backend должны появляться запросы при создании проектов/требований.

## Ручной запуск (если start.bat не работает)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\python.exe -m pip install -r requirements.txt
venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

### Frontend (в другом терминале)
```bash
npm install
npm run dev
```

## Возможные проблемы

### "Python not found"
- Установите Python с https://python.org
- При установке отметьте "Add Python to PATH"
- Перезапустите терминал после установки

### "Node.js not found"
- Установите Node.js LTS с https://nodejs.org
- Перезапустите терминал после установки

### Порт 8000 или 3000 занят
- Закройте другие приложения, использующие эти порты
- Или измените порты в start.bat и vite.config.js

### Ошибки кодировки в start.bat
- Файл использует только ASCII-символы
- Откройте в Notepad++ и убедитесь, что кодировка ANSI или UTF-8 без BOM
- При необходимости пересохраните файл

## Структура данных

Все данные хранятся в папке `data/`:
- `data/app.db` - база данных SQLite
- `data/attachments/` - загруженные файлы ТЗ
- `data/mockups/` - макеты фиче-страниц
- `data/snapshots/` - снапшоты для сравнения версий

## Демо-режим

При первом запуске приложение работает с демо-данными в localStorage.
После запуска backend данные автоматически переключаются на SQLite.

Переключатель режима находится внизу боковой панели.
