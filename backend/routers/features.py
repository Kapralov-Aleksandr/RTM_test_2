# ============================================================
# /api/features — фиче-страницы и дерево (каркас Итерации 2)
# ============================================================

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import Feature, FeatureHistory, FeatureRequirement, FeatureTreeNode, SessionLocal

router = APIRouter(prefix="/api", tags=["Фиче-страницы"])


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TreeNodeCreate(BaseModel):
    node_type: str  # RELEASE | FEATURE
    name: str
    parent_id: int | None = None
    jira_key: str | None = None


class FeatureUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    link_jira: str | None = None
    link_test_cases: str | None = None


@router.get("/projects/{project_id}/tree")
def get_tree(project_id: int, db: Session = Depends(get_db)) -> list:
    """Дерево: релизы → фичи (Таб 4)"""
    nodes = db.execute(
        select(FeatureTreeNode)
        .where(FeatureTreeNode.project_id == project_id)
        .order_by(FeatureTreeNode.order_num)
    ).scalars().all()
    return [
        {"id": n.id, "parent_id": n.parent_id, "node_type": n.node_type,
         "name": n.name, "jira_key": n.jira_key, "order_num": n.order_num}
        for n in nodes
    ]


@router.post("/projects/{project_id}/tree", status_code=201)
def add_tree_node(project_id: int, data: TreeNodeCreate, db: Session = Depends(get_db)) -> dict:
    """Добавить узел дерева (релиз или фичу)"""
    if data.node_type not in ("RELEASE", "FEATURE"):
        raise HTTPException(status_code=400, detail="node_type должен быть RELEASE или FEATURE")
    node = FeatureTreeNode(
        project_id=project_id, node_type=data.node_type, name=data.name,
        parent_id=data.parent_id, jira_key=data.jira_key,
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return {"id": node.id, "name": node.name, "node_type": node.node_type}


@router.put("/features/{feature_id}")
def update_feature(feature_id: int, data: FeatureUpdate, db: Session = Depends(get_db)) -> dict:
    """Сохранить фичу: контент → история, updated_at = now"""
    feature = db.get(Feature, feature_id)
    if not feature:
        raise HTTPException(status_code=404, detail=f"Фича с id={feature_id} не найдена")
    if data.content is not None and data.content != feature.content:
        db.add(FeatureHistory(
            feature_id=feature_id, change_type="CONTENT",
            old_value=feature.content, new_value=data.content, changed_at=datetime.utcnow(),
        ))
        feature.content = data.content
    if data.title is not None:
        feature.title = data.title
    if data.link_jira is not None:
        feature.link_jira = data.link_jira
    if data.link_test_cases is not None:
        feature.link_test_cases = data.link_test_cases
    feature.updated_at = datetime.utcnow()
    db.commit()
    return {"id": feature.id, "updated_at": feature.updated_at.isoformat()}


@router.post("/features/{feature_id}/requirements/{requirement_id}", status_code=201)
def link_requirement(feature_id: int, requirement_id: int, db: Session = Depends(get_db)) -> dict:
    """Привязать требование к фиче (многие-ко-многим)"""
    link = FeatureRequirement(feature_id=feature_id, requirement_id=requirement_id)
    db.add(link)
    db.commit()
    return {"feature_id": feature_id, "requirement_id": requirement_id}
