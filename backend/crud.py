# ============================================================
# CRUD-операции. Обновление требования пишет diff-историю
# (requirement_history) и обновляет updated_at — это сбрасывает
# статусы актуальности (логика Таба 5).
# ============================================================

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import Project, Requirement, RequirementHistory
from schemas import ProjectCreate, ProjectUpdate, RequirementCreate, RequirementUpdate
from services.id_generator import next_req_key

# Поля требования, изменения которых попадают в историю
TRACKED_FIELDS = {
    "req_type": "Тип",
    "title": "Название",
    "description": "Описание",
    "link_tz": "Ссылка на ТЗ",
    "link_chtz": "Ссылка на ЧТЗ",
    "release": "Релиз",
    "notes": "Примечание",
    "dependencies": "Зависимости",
}


# ---------- Проекты ----------

def list_projects(session: Session) -> list[Project]:
    return list(session.execute(select(Project).order_by(Project.id)).scalars().all())


def get_project(session: Session, project_id: int) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Проект с id={project_id} не найден")
    return project


def create_project(session: Session, data: ProjectCreate) -> Project:
    exists = session.execute(
        select(Project).where(Project.jira_key == data.jira_key.upper())
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=409, detail=f"Проект с ключом {data.jira_key.upper()} уже существует")
    project = Project(jira_key=data.jira_key.upper(), name=data.name)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def update_project(session: Session, project_id: int, data: ProjectUpdate) -> Project:
    project = get_project(session, project_id)
    if data.jira_key is not None:
        project.jira_key = data.jira_key.upper()
    if data.name is not None:
        project.name = data.name
    session.commit()
    session.refresh(project)
    return project


def delete_project(session: Session, project_id: int) -> None:
    project = get_project(session, project_id)
    session.delete(project)
    session.commit()


# ---------- Требования ----------

def list_requirements(
    session: Session,
    project_id: int,
    req_type: str | None = None,
    release: str | None = None,
    q: str | None = None,
) -> list[Requirement]:
    stmt = select(Requirement).where(Requirement.project_id == project_id)
    if req_type:
        stmt = stmt.where(Requirement.req_type == req_type)
    if release:
        stmt = stmt.where(Requirement.release == release)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Requirement.title.ilike(like) | Requirement.req_key.ilike(like))
    return list(session.execute(stmt.order_by(Requirement.req_key)).scalars().all())


def get_requirement(session: Session, requirement_id: int) -> Requirement:
    req = session.get(Requirement, requirement_id)
    if not req:
        raise HTTPException(status_code=404, detail=f"Требование с id={requirement_id} не найдено")
    return req


def create_requirement(session: Session, project_id: int, data: RequirementCreate) -> Requirement:
    """Создание с автогенерацией ключа REQ-KEY-TYPE-NNNN."""
    project = get_project(session, project_id)
    req = Requirement(
        project_id=project_id,
        req_key=next_req_key(session, project, data.req_type),
        **data.model_dump(),
    )
    session.add(req)
    session.commit()
    session.refresh(req)
    return req


def update_requirement(session: Session, requirement_id: int, data: RequirementUpdate) -> Requirement:
    """
    Сохранение требования: изменённые поля → история,
    updated_at = now → статусы актуальности требуют подтверждения.
    """
    req = get_requirement(session, requirement_id)
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        return req

    now = datetime.utcnow()
    for field, new_value in changes.items():
        if field not in TRACKED_FIELDS:
            continue
        old_value = getattr(req, field)
        if (old_value or "") != (new_value or ""):
            session.add(RequirementHistory(
                requirement_id=req.id,
                field_changed=field,
                old_value=old_value,
                new_value=new_value,
                changed_at=now,
            ))
            setattr(req, field, new_value)
    req.updated_at = now
    session.commit()
    session.refresh(req)
    return req


def validate_requirement(session: Session, requirement_id: int, kind: str) -> Requirement:
    """✅ Подтвердить актуальность (fs — фиче-страницами, tests — тест-кейсами)."""
    req = get_requirement(session, requirement_id)
    if kind == "fs":
        req.last_validated_fs = datetime.utcnow()
    elif kind == "tests":
        req.last_validated_test = datetime.utcnow()
    else:
        raise HTTPException(status_code=400, detail="kind должен быть 'fs' или 'tests'")
    session.commit()
    session.refresh(req)
    return req


def delete_requirement(session: Session, requirement_id: int) -> None:
    req = get_requirement(session, requirement_id)
    session.delete(req)
    session.commit()


def requirement_history(session: Session, requirement_id: int) -> list[RequirementHistory]:
    return list(session.execute(
        select(RequirementHistory)
        .where(RequirementHistory.requirement_id == requirement_id)
        .order_by(RequirementHistory.changed_at.desc())
    ).scalars().all())
