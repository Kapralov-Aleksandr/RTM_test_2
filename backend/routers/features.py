# ============================================================
# /api — Таб 4: дерево фиче-страниц (Релизы → Фичи), содержимое
# фич, привязка требований (M:N), макеты (data/mockups).
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
    DATA_DIR, Feature, FeatureHistory, FeatureRequirement, FeatureTreeNode,
    Mockup, Requirement, SessionLocal,
)

router = APIRouter(prefix="/api", tags=["Фиче-страницы"])

ALLOWED_IMG_EXT = {".png", ".jpg", ".jpeg"}


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------- Pydantic-схемы ----------

class TreeNodeCreate(BaseModel):
    node_type: str  # RELEASE | FEATURE
    name: str
    parent_id: int | None = None
    jira_key: str | None = None


class TreeNodeRename(BaseModel):
    name: str


class TreeNodeMove(BaseModel):
    parent_id: int | None
    order_num: int


class FeatureSave(BaseModel):
    title: str
    content: str
    link_jira: str = ""
    link_test_cases: str = ""


def _sanitize(name: str) -> str:
    base = os.path.basename(name)
    return re.sub(r"[^\w.\-]", "_", base) or "mockup"


def _node_dict(n: FeatureTreeNode) -> dict:
    return {"id": n.id, "parent_id": n.parent_id, "node_type": n.node_type,
            "name": n.name, "jira_key": n.jira_key, "order_num": n.order_num}


def _feature_dict(f: Feature, db: Session) -> dict:
    req_ids = db.execute(
        select(FeatureRequirement.requirement_id).where(FeatureRequirement.feature_id == f.id)
    ).scalars().all()
    mockups = db.execute(select(Mockup).where(Mockup.feature_id == f.id)).scalars().all()
    return {
        "id": f.id, "tree_node_id": f.tree_node_id, "title": f.title,
        "content": f.content, "link_jira": f.link_jira, "link_test_cases": f.link_test_cases,
        "requirement_ids": req_ids,
        "mockups": [
            {"id": m.id, "filename": m.filename,
             "url": f"/files/{m.file_path.replace(os.sep, '/')}"}
            for m in mockups
        ],
        "updated_at": f.updated_at.isoformat() if f.updated_at else None,
        "last_validated": f.last_validated.isoformat() if f.last_validated else None,
    }


def _get_node(db: Session, node_id: int) -> FeatureTreeNode:
    node = db.get(FeatureTreeNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail=f"Узел дерева с id={node_id} не найден")
    return node


# ---------- Дерево ----------

@router.get("/projects/{project_id}/tree")
def get_tree(project_id: int, db: Session = Depends(get_db)) -> list:
    """Дерево: релизы → фичи"""
    nodes = db.execute(
        select(FeatureTreeNode)
        .where(FeatureTreeNode.project_id == project_id)
        .order_by(FeatureTreeNode.order_num)
    ).scalars().all()
    return [_node_dict(n) for n in nodes]


@router.post("/projects/{project_id}/tree", status_code=201)
def add_tree_node(project_id: int,  TreeNodeCreate, db: Session = Depends(get_db)) -> dict:
    """Добавить узел (релиз — в корень, фича — внутрь релиза)"""
    if data.node_type not in ("RELEASE", "FEATURE"):
        raise HTTPException(status_code=400, detail="node_type должен быть RELEASE или FEATURE")
    if data.node_type == "FEATURE" and data.parent_id is None:
        raise HTTPException(status_code=400, detail="Фича должна находиться внутри релиза")
    order = (db.execute(
        select(FeatureTreeNode).where(
            FeatureTreeNode.project_id == project_id,
            FeatureTreeNode.parent_id == data.parent_id,
        )
    ).scalars().all())
    node = FeatureTreeNode(
        project_id=project_id, node_type=data.node_type, name=data.name,
        parent_id=data.parent_id, jira_key=data.jira_key, order_num=len(order),
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return _node_dict(node)


@router.put("/tree/{node_id}")
def rename_tree_node(node_id: int,  TreeNodeRename, db: Session = Depends(get_db)) -> dict:
    """Переименовать узел (у фичи синхронизируется заголовок страницы)"""
    node = _get_node(db, node_id)
    node.name = data.name
    if node.node_type == "FEATURE":
        feature = db.execute(select(Feature).where(Feature.tree_node_id == node_id)).scalars().first()
        if feature:
            feature.title = data.name
            feature.updated_at = datetime.utcnow()
    db.commit()
    return _node_dict(node)


@router.post("/tree/{node_id}/move")
def move_tree_node(node_id: int,  TreeNodeMove, db: Session = Depends(get_db)) -> dict:
    """Перемещение узла (drag-n-drop): смена родителя и порядка"""
    node = _get_node(db, node_id)
    if node.node_type == "RELEASE" and data.parent_id is not None:
        raise HTTPException(status_code=400, detail="Релиз может находиться только в корне")
    if node.node_type == "FEATURE" and data.parent_id is None:
        raise HTTPException(status_code=400, detail="Фича должна находиться внутри релиза")

    # Сдвигаем соседей, чтобы освободить место под перетаскиваемый узел
    siblings = db.execute(
        select(FeatureTreeNode)
        .where(FeatureTreeNode.parent_id == data.parent_id)
        .where(FeatureTreeNode.id != node_id)
        .order_by(FeatureTreeNode.order_num)
    ).scalars().all()
    for i, s in enumerate(siblings):
        s.order_num = i + (1 if i >= data.order_num else 0)
    node.parent_id = data.parent_id
    node.order_num = data.order_num
    db.commit()
    return _node_dict(node)


@router.delete("/tree/{node_id}", status_code=204)
def delete_tree_node(node_id: int, db: Session = Depends(get_db)) -> None:
    """Удалить узел: релиз — вместе с фичами, фичу — со страницей и связями"""
    node = _get_node(db, node_id)
    ids = [node_id]
    if node.node_type == "RELEASE":
        ids += [c.id for c in db.execute(
            select(FeatureTreeNode).where(FeatureTreeNode.parent_id == node_id)
        ).scalars().all()]

    for nid in ids:
        features = db.execute(select(Feature).where(Feature.tree_node_id == nid)).scalars().all()
        for f in features:
            db.execute(delete(FeatureRequirement).where(FeatureRequirement.feature_id == f.id))
            db.execute(delete(FeatureHistory).where(FeatureHistory.feature_id == f.id))
            for m in db.execute(select(Mockup).where(Mockup.feature_id == f.id)).scalars().all():
                try:
                    os.remove(os.path.join(DATA_DIR, m.file_path))
                except OSError:
                    pass
                db.delete(m)
            db.delete(f)
        db.execute(delete(FeatureTreeNode).where(FeatureTreeNode.id == nid))
    db.commit()


# ---------- Фиче-страницы ----------

@router.get("/projects/{project_id}/features")
def list_features(project_id: int, db: Session = Depends(get_db)) -> list:
    """Все фичи проекта с привязками и макетами"""
    nodes = db.execute(
        select(FeatureTreeNode.id).where(FeatureTreeNode.project_id == project_id)
    ).scalars().all()
    features = db.execute(
        select(Feature).where(Feature.tree_node_id.in_(nodes)) if nodes else select(Feature).where(False)
    ).scalars().all()
    return [_feature_dict(f, db) for f in features]


@router.post("/tree/{node_id}/feature")
def save_feature(node_id: int,  FeatureSave, db: Session = Depends(get_db)) -> dict:
    """💾 Сохранить фиче-страницу (создаётся при первом сохранении)"""
    node = _get_node(db, node_id)
    if node.node_type != "FEATURE":
        raise HTTPException(status_code=400, detail="Страница создаётся только для узла-фичи")
    feature = db.execute(select(Feature).where(Feature.tree_node_id == node_id)).scalars().first()
    now = datetime.utcnow()
    if not feature:
        feature = Feature(tree_node_id=node_id, title=data.title, content=data.content,
                          link_jira=data.link_jira, link_test_cases=data.link_test_cases)
        db.add(feature)
    else:
        if data.content != (feature.content or ""):
            db.add(FeatureHistory(feature_id=feature.id, change_type="CONTENT",
                                  old_value=feature.content, new_value=data.content, changed_at=now))
        feature.title = data.title
        feature.content = data.content
        feature.link_jira = data.link_jira
        feature.link_test_cases = data.link_test_cases
        feature.updated_at = now
    db.commit()
    db.refresh(feature)
    return _feature_dict(feature, db)


@router.post("/features/{feature_id}/requirements/{requirement_id}", status_code=201)
def link_requirement(feature_id: int, requirement_id: int, db: Session = Depends(get_db)) -> dict:
    """Привязать требование к фиче (многие-ко-многим, идемпотентно)"""
    if not db.get(Feature, feature_id):
        raise HTTPException(status_code=404, detail=f"Фича с id={feature_id} не найдена")
    if not db.get(Requirement, requirement_id):
        raise HTTPException(status_code=404, detail=f"Требование с id={requirement_id} не найдено")
    exists = db.get(FeatureRequirement, (feature_id, requirement_id))
    if not exists:
        db.add(FeatureRequirement(feature_id=feature_id, requirement_id=requirement_id))
        db.commit()
    return {"feature_id": feature_id, "requirement_id": requirement_id}


@router.delete("/features/{feature_id}/requirements/{requirement_id}", status_code=204)
def unlink_requirement(feature_id: int, requirement_id: int, db: Session = Depends(get_db)) -> None:
    """Отвязать требование от фичи"""
    link = db.get(FeatureRequirement, (feature_id, requirement_id))
    if link:
        db.delete(link)
        db.commit()


# ---------- Макеты ----------

@router.post("/features/{feature_id}/mockups", status_code=201)
async def upload_mockup(feature_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)) -> dict:
    """Загрузка макета (PNG/JPG) → data/mockups/"""
    feature = db.get(Feature, feature_id)
    if not feature:
        raise HTTPException(status_code=404, detail=f"Фича с id={feature_id} не найдена")
    name = file.filename or "mockup.png"
    ext = os.path.splitext(name)[1].lower()
    if ext not in ALLOWED_IMG_EXT:
        raise HTTPException(status_code=400, detail="Разрешены только изображения PNG/JPG")
    dest_name = f"{feature_id}_{uuid.uuid4().hex[:8]}{ext}"
    rel_path = os.path.join("mockups", dest_name)
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Пустой файл")
    with open(os.path.join(DATA_DIR, rel_path), "wb") as f:
        f.write(content)
    mockup = Mockup(feature_id=feature_id, file_path=rel_path, filename=_sanitize(name))
    db.add(mockup)
    db.commit()
    db.refresh(mockup)
    return {"id": mockup.id, "filename": mockup.filename, "url": f"/files/{rel_path.replace(os.sep, '/')}"}


@router.delete("/mockups/{mockup_id}", status_code=204)
def delete_mockup(mockup_id: int, db: Session = Depends(get_db)) -> None:
    """Удалить макет (файл и запись)"""
    mockup = db.get(Mockup, mockup_id)
    if not mockup:
        raise HTTPException(status_code=404, detail=f"Макет с id={mockup_id} не найден")
    try:
        os.remove(os.path.join(DATA_DIR, mockup.file_path))
    except OSError:
        pass
    db.delete(mockup)
    db.commit()


# ---------- Импорт структуры дерева ----------

class TreeImportNode(BaseModel):
    name: str
    node_type: str  # RELEASE | FEATURE
    children: list["TreeImportNode"] = []
    jira_key: str | None = None


TreeImportNode.model_rebuild()


class TreeImport(BaseModel):
    nodes: list[TreeImportNode]


@router.post("/projects/{project_id}/tree/import")
def import_tree(project_id: int,  TreeImport, db: Session = Depends(get_db)) -> dict:
    """Импорт структуры дерева из JSON: создаёт релизы и фичи с вложенностью"""
    created = {"releases": 0, "features": 0}

    def create_node(node: TreeImportNode, parent_id: int | None) -> int:
        if node.node_type not in ("RELEASE", "FEATURE"):
            raise HTTPException(status_code=400, detail=f"Неизвестный node_type: {node.node_type}")
        if node.node_type == "FEATURE" and parent_id is None:
            raise HTTPException(status_code=400, detail="Фича должна находиться внутри релиза")

        # Определяем order_num
        siblings = db.execute(
            select(FeatureTreeNode)
            .where(FeatureTreeNode.project_id == project_id)
            .where(FeatureTreeNode.parent_id == parent_id)
        ).scalars().all()
        order = len(siblings)

        db_node = FeatureTreeNode(
            project_id=project_id, node_type=node.node_type, name=node.name,
            parent_id=parent_id, jira_key=node.jira_key, order_num=order,
        )
        db.add(db_node)
        db.flush()  # получаем db_node.id

        if node.node_type == "RELEASE":
            created["releases"] += 1
        else:
            created["features"] += 1
            # Создаём пустую фиче-страницу
            feature = Feature(tree_node_id=db_node.id, title=node.name, content="")
            db.add(feature)

        # Рекурсивно создаём детей
        for child in node.children:
            create_node(child, db_node.id)

        return db_node.id

    for root_node in data.nodes:
        create_node(root_node, None)

    db.commit()
    return created
