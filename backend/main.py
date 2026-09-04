# ============================================================
# FastAPI entry point · Requirements Tracker
# Запуск: python -m uvicorn main:app --reload --port 8000
# Swagger: http://localhost:8000/docs
# ============================================================

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from database import DATA_DIR, init_db
from routers import documents, features, integrations, projects, requirements

# Структурированное логирование (время | уровень | модуль | сообщение)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("rms")

app = FastAPI(
    title="Requirements Tracker API",
    description="Трассировка требований: ТЗ → ЧТЗ → фиче-страницы → ПМИ → Jira",
    version="0.2.0",
)

# Фронтенд (Vite dev-server) обращается к API с другого порта
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Централизованная обработка ошибок (русские сообщения) ----------

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    messages = {404: "Запрошенный ресурс не найден", 409: "Конфликт: объект уже существует",
                400: "Некорректные данные запроса", 401: "Требуется аутентификация"}
    detail = exc.detail or messages.get(exc.status_code, "Ошибка запроса")
    logger.warning("HTTP %s: %s", exc.status_code, detail)
    return JSONResponse(status_code=exc.status_code, content={"detail": detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Необработанная ошибка: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Внутренняя ошибка сервера: {exc}"},
    )


# ---------- Роутеры ----------

app.include_router(projects.router)
app.include_router(requirements.router)
app.include_router(features.router)
app.include_router(documents.router)
app.include_router(integrations.router)

# Загруженные файлы: макеты (data/mockups) и вложения ТЗ (data/attachments)
app.mount("/files", StaticFiles(directory=DATA_DIR), name="files")


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    logger.info("База данных инициализирована (data/app.db)")


@app.get("/api/health", tags=["Служебные"])
def health() -> dict:
    """Живость сервиса — по этому эндпоинту фронтенд автоопределяет backend"""
    return {"status": "ok", "version": app.version}
