# ============================================================
# /api/projects/{pid}/tz и /chtz — Таб 1 и Таб 3:
# документы, связи «выделенный текст → требование», загрузка файлов.
# ============================================================

import os
import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from database import (
    DATA_DIR, ChtzDocument, Requirement, SessionLocal, TzDocument, TzRequirementMention,
)
from services.document_parser import parse_document

router = APIRouter(prefix="/api/projects/{project_id}", tags=["Документы"])


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------- Pydantic-схемы ----------

class MentionIn(BaseModel):
    requirement_id: int
    start_offset: int
    end_offset: int
    highlighted_text: str


class TzSave(BaseModel):
    title: str
    content: str
    mentions: list[MentionIn] = []


class ChtzSave(BaseModel):
    title: str
    content: str


def _sanitize(name: str) -> str:
    """Безопасное имя файла: только буквы/цифры/дефис/точка"""
    base = os.path.basename(name)
    return re.sub(r"[^\w.\-]", "_", base) or "file"


def _tz_to_dict(doc: TzDocument, db: Session) -> dict:
    mentions = db.execute(
        select(TzRequirementMention).where(TzRequirementMention.tz_document_id == doc.id)
    ).scalars().all()
    return {
        "id": doc.id,
        "title": doc.title,
        "content": doc.content,
        "attached_file_path": doc.attached_file_path,
        "mentions": [
            {
                "requirement_id": m.requirement_id,
                "start_offset": m.start_offset,
                "end_offset": m.end_offset,
                "highlighted_text": m.highlighted_text,
            }
            for m in mentions
        ],
    }


# ---------- Исходное ТЗ (Таб 1) ----------

@router.get("/tz")
def get_tz(project_id: int, db: Session = Depends(get_db)):
    """Документ ТЗ проекта с фиксациями «текст ↔ требование» (или null)"""
    doc = db.execute(select(TzDocument).where(TzDocument.project_id == project_id)).scalars().first()
    return _tz_to_dict(doc, db) if doc else None


@router.post("/tz")
def save_tz(project_id: int,  TzSave, db: Session = Depends(get_db)) -> dict:
    """💾 Сохранить документ и ВСЕ связи (старые mentions заменяются новыми)"""
    doc = db.execute(select(TzDocument).where(TzDocument.project_id == project_id)).scalars().first()
    if not doc:
        doc = TzDocument(project_id=project_id, title=data.title, content=data.content)
        db.add(doc)
        db.flush()
    else:
        doc.title = data.title
        doc.content = data.content
        doc.updated_at = datetime.utcnow()

    # Перезаписываем связи «текст → требование»
    db.execute(delete(TzRequirementMention).where(TzRequirementMention.tz_document_id == doc.id))
    for m in data.mentions:
        if db.get(Requirement, m.requirement_id) is None:
            continue  # требование удалено — фиксацию не сохраняем
        db.add(TzRequirementMention(
            tz_document_id=doc.id, requirement_id=m.requirement_id,
            start_offset=m.start_offset, end_offset=m.end_offset,
            highlighted_text=m.highlighted_text,
        ))
    db.commit()
    db.refresh(doc)
    return _tz_to_dict(doc, db)


@router.post("/tz/upload")
async def upload_tz_file(project_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)) -> dict:
    """Загрузка файла ТЗ (PDF/DOCX/TXT) → data/attachments/"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Файл без имени")
    dest_name = f"{project_id}_{uuid.uuid4().hex[:8]}_{_sanitize(file.filename)}"
    rel_path = os.path.join("attachments", dest_name)
    abs_path = os.path.join(DATA_DIR, rel_path)
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Пустой файл")
    with open(abs_path, "wb") as f:
        f.write(content)

    doc = db.execute(select(TzDocument).where(TzDocument.project_id == project_id)).scalars().first()
    if not doc:
        doc = TzDocument(project_id=project_id, title="Техническое задание", content="",
                         attached_file_path=rel_path)
        db.add(doc)
    else:
        doc.attached_file_path = rel_path
        doc.updated_at = datetime.utcnow()
    db.commit()
    return {"filename": file.filename, "url": f"/files/{rel_path.replace(os.sep, '/')}"}


# ---------- ЧТЗ (Таб 3) ----------

@router.get("/chtz")
def get_chtz(project_id: int, db: Session = Depends(get_db)):
    """Документ ЧТЗ проекта (или null)"""
    doc = db.execute(select(ChtzDocument).where(ChtzDocument.project_id == project_id)).scalars().first()
    if not doc:
        return None
    return {"id": doc.id, "title": doc.title, "content": doc.content}


@router.post("/chtz")
def save_chtz(project_id: int,  ChtzSave, db: Session = Depends(get_db)) -> dict:
    """💾 Сохранить ЧТЗ (бейджи @-упоминаний живут прямо в HTML-контенте)"""
    doc = db.execute(select(ChtzDocument).where(ChtzDocument.project_id == project_id)).scalars().first()
    if not doc:
        doc = ChtzDocument(project_id=project_id, title=data.title, content=data.content)
        db.add(doc)
    else:
        doc.title = data.title
        doc.content = data.content
        doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "title": doc.title, "content": doc.content}
