# ============================================================
# /api/projects — мультипроектность
# ============================================================

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
from database import SessionLocal
from schemas import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["Проекты"])


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)) -> list:
    """Список всех проектов"""
    return crud.list_projects(db)


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    """➕ Создать проект (ключ Jira уникален)"""
    return crud.create_project(db, data)


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db)):
    """Переименовать проект / сменить ключ Jira"""
    return crud.update_project(db, project_id, data)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)) -> None:
    """Удалить проект"""
    crud.delete_project(db, project_id)
