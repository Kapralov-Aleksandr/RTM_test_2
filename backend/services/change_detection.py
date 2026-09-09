# ============================================================
# Детекция рассинхронизаций (логика Таба 5):
# 1) требование изменилось → привязанные фичи не актуализированы;
# 2) фича изменилась → её тест-кейсы не перепроверены.
# ============================================================

from sqlalchemy import select
from sqlalchemy.orm import Session

from database import Feature, FeatureRequirement, Requirement


def stale_requirements(session: Session, project_id: int) -> list[dict]:
    """
    Требования, у которых updated_at > last_validated хотя бы одной
    привязанной фичи. Возвращает строки для Таба 5:
    требование | дата изменения | фича | последняя валидация фичи.
    """
    rows: list[dict] = []
    pairs = session.execute(
        select(Requirement, Feature)
        .join(FeatureRequirement, FeatureRequirement.requirement_id == Requirement.id)
        .join(Feature, Feature.id == FeatureRequirement.feature_id)
        .where(Requirement.project_id == project_id)
    ).all()

    for req, feature in pairs:
        last_validated = feature.last_validated
        if last_validated is None or req.updated_at > last_validated:
            rows.append({
                "requirement_id": req.id,
                "req_key": req.req_key,
                "req_updated_at": req.updated_at.isoformat(),
                "feature_id": feature.id,
                "feature_title": feature.title,
                "feature_last_validated": last_validated.isoformat() if last_validated else None,
            })
    return rows


def stale_features(session: Session, project_id: int) -> list[dict]:
    """
    Фичи, у которых updated_at > last_validated: содержимое менялось,
    но тест-кейсы не перепроверялись.
    """
    features = session.execute(
        select(Feature)
        .join(FeatureRequirement, FeatureRequirement.feature_id == Feature.id)
        .join(Requirement, Requirement.id == FeatureRequirement.requirement_id)
        .where(Requirement.project_id == project_id)
        .distinct()
    ).scalars().all()

    return [
        {
            "feature_id": f.id,
            "feature_title": f.title,
            "feature_updated_at": f.updated_at.isoformat(),
            "last_validated": f.last_validated.isoformat() if f.last_validated else None,
        }
        for f in features
        if f.last_validated is None or f.updated_at > f.last_validated
    ]
