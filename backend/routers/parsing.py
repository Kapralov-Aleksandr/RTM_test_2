# ============================================================
# /api/documents — парсинг загруженных документов (Таб 1).
# Эндпоинт принимает файл, парсит его в HTML и возвращает
# готовый контент для редактора TipTap.
# ============================================================

import os
import uuid
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from database import DATA_DIR
from services.document_parser import parse_document

router = APIRouter(prefix="/api/documents", tags=["Документы"])

ALLOWED_EXTENSIONS = {".docx", ".pdf", ".txt", ".doc"}


class ParsedDocument(BaseModel):
    """Ответ парсинга: HTML-контент + информация о файле"""
    html: str
    title: str
    attachment: dict  # {filename, url}


def _sanitize(name: str) -> str:
    """Безопасное имя файла"""
    import re
    base = os.path.basename(name)
    return re.sub(r"[^\w.\-]", "_", base) or "document"


@router.post("/{doc_type}/upload-and-parse", response_model=ParsedDocument)
async def upload_and_parse(doc_type: str, file: UploadFile = File(...)) -> ParsedDocument:
    """
    Загрузка и парсинг документа.
    Возвращает HTML для редактора + сохраняет файл как вложение.
    """
    if doc_type not in ("tz", "chtz"):
        raise HTTPException(status_code=400, detail="doc_type должен быть 'tz' или 'chtz'")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Файл без имени")

    # Проверка расширения
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Формат '{ext}' не поддерживается. Допустимые: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Чтение файла
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Пустой файл")

    # Парсинг
    try:
        html_content = parse_document(content, file.filename)
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    # Сохранение файла как вложения
    dest_name = f"{doc_type}_{uuid.uuid4().hex[:8]}_{_sanitize(file.filename)}"
    rel_path = os.path.join("attachments", dest_name)
    abs_path = os.path.join(DATA_DIR, rel_path)
    with open(abs_path, "wb") as f:
        f.write(content)

    # Формируем заголовок из имени файла (без расширения)
    title = os.path.splitext(file.filename)[0]

    return ParsedDocument(
        html=html_content,
        title=title,
        attachment={
            "filename": file.filename,
            "url": f"/files/{rel_path.replace(os.sep, '/')}",
        },
    )
