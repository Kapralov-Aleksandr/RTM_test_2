# ============================================================
# /api/requirements — матрица атомарных требований (Таб 2)
# ============================================================

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

import crud
from database import SessionLocal
from schemas import (
    RequirementCreate, RequirementHistoryOut, RequirementOut, RequirementUpdate,
)
from services.coverage import compute_coverage
from services.change_detection import stale_features, stale_requirements

router = APIRouter(prefix="/api", tags=["Требования"])


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/projects/{project_id}/requirements", response_model=list[RequirementOut])
def list_requirements(
    project_id: int,
    req_type: str | None = Query(None, description="Фильтр по типу: BUSINESS/FUNCTIONAL/NON_FUNCTIONAL"),
    release: str | None = Query(None, description="Фильтр по релизу"),
    q: str | None = Query(None, description="Поиск по названию или ключу"),
    db: Session = Depends(get_db),
) -> list:
    """Список требований проекта с фильтрами"""
    return crud.list_requirements(db, project_id, req_type=req_type, release=release, q=q)


@router.post("/projects/{project_id}/requirements", response_model=RequirementOut, status_code=201)
def create_requirement(project_id: int, data: RequirementCreate, db: Session = Depends(get_db)):
    """Создать требование (ID генерируется автоматически)"""
    return crud.create_requirement(db, project_id, data)


@router.get("/requirements/{requirement_id}", response_model=RequirementOut)
def get_requirement(requirement_id: int, db: Session = Depends(get_db)):
    """Требование по id"""
    return crud.get_requirement(db, requirement_id)


@router.put("/requirements/{requirement_id}", response_model=RequirementOut)
def update_requirement(requirement_id: int, data: RequirementUpdate, db: Session = Depends(get_db)):
    """Сохранить требование: updated_at = now, изменения → история"""
    return crud.update_requirement(db, requirement_id, data)


@router.put("/requirements/{requirement_id}/validate/{kind}", response_model=RequirementOut)
def validate_requirement(requirement_id: int, kind: str, db: Session = Depends(get_db)):
    """✅ Подтвердить актуальность: kind = fs | tests"""
    return crud.validate_requirement(db, requirement_id, kind)


@router.delete("/requirements/{requirement_id}", status_code=204)
def delete_requirement(requirement_id: int, db: Session = Depends(get_db)) -> None:
    """Удалить требование"""
    crud.delete_requirement(db, requirement_id)


@router.get("/requirements/{requirement_id}/history", response_model=list[RequirementHistoryOut])
def get_history(requirement_id: int, db: Session = Depends(get_db)) -> list:
    """📜 История изменений требования"""
    return crud.requirement_history(db, requirement_id)


# ---------- Аналитика (Таб 5 и Таб 6) ----------

@router.get("/projects/{project_id}/coverage")
def coverage(project_id: int, db: Session = Depends(get_db)) -> dict:
    """Покрытие требований: воронка, типы, пробелы, сироты (Таб 6)"""
    return compute_coverage(db, project_id)


@router.get("/projects/{project_id}/desync")
def desync(project_id: int, db: Session = Depends(get_db)) -> dict:
    """Рассинхронизации: требования → фичи → тесты (Таб 5)"""
    return {
        "stale_requirements": stale_requirements(db, project_id),
        "stale_features": stale_features(db, project_id),
    }
