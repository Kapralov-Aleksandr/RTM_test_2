# ============================================================
# /api/documents — исходные ТЗ и ЧТЗ (каркас Итерации 2)
# ============================================================

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import ChtzDocument, SessionLocal, TzDocument, TzRequirementMention

router = APIRouter(prefix="/api/projects/{project_id}", tags=["Документы"])


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class DocumentUpdate(BaseModel):
    title: str | None = None
    content: str | None = None


class MentionCreate(BaseModel):
    requirement_id: int
    start_offset: int
    end_offset: int
    highlighted_text: str


# ---------- Исходное ТЗ (Таб 1) ----------

@router.get("/tz")
def get_tz(project_id: int, db: Session = Depends(get_db)) -> list:
    """Документы ТЗ проекта"""
    docs = db.execute(select(TzDocument).where(TzDocument.project_id == project_id)).scalars().all()
    return [{"id": d.id, "title": d.title, "content": d.content,
             "attached_file_path": d.attached_file_path} for d in docs]


@router.post("/tz", status_code=201)
def upsert_tz(project_id: int, data: DocumentUpdate, db: Session = Depends(get_db)) -> dict:
    """Создать/обновить документ ТЗ"""
    doc = db.execute(select(TzDocument).where(TzDocument.project_id == project_id)).scalars().first()
    if not doc:
        doc = TzDocument(project_id=project_id, title=data.title, content=data.content)
        db.add(doc)
    else:
        if data.title is not None:
            doc.title = data.title
        if data.content is not None:
            doc.content = data.content
        doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "title": doc.title}


@router.post("/tz/{tz_id}/mentions", status_code=201)
def add_mention(project_id: int, tz_id: int, data: MentionCreate, db: Session = Depends(get_db)) -> dict:
    """📌 Зафиксировать связь «выделенный текст → требование»"""
    if not db.get(TzDocument, tz_id):
        raise HTTPException(status_code=404, detail=f"Документ ТЗ с id={tz_id} не найден")
    mention = TzRequirementMention(
        tz_document_id=tz_id, requirement_id=data.requirement_id,
        start_offset=data.start_offset, end_offset=data.end_offset,
        highlighted_text=data.highlighted_text,
    )
    db.add(mention)
    db.commit()
    return {"id": mention.id}


# ---------- ЧТЗ (Таб 3) ----------

@router.get("/chtz")
def get_chtz(project_id: int, db: Session = Depends(get_db)) -> list:
    """Документы ЧТЗ проекта"""
    docs = db.execute(select(ChtzDocument).where(ChtzDocument.project_id == project_id)).scalars().all()
    return [{"id": d.id, "title": d.title, "content": d.content} for d in docs]


@router.post("/chtz", status_code=201)
def upsert_chtz(project_id: int, data: DocumentUpdate, db: Session = Depends(get_db)) -> dict:
    """Создать/обновить документ ЧТЗ"""
    doc = db.execute(select(ChtzDocument).where(ChtzDocument.project_id == project_id)).scalars().first()
    if not doc:
        doc = ChtzDocument(project_id=project_id, title=data.title, content=data.content)
        db.add(doc)
    else:
        if data.title is not None:
            doc.title = data.title
        if data.content is not None:
            doc.content = data.content
        doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "title": doc.title}
