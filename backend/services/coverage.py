# ============================================================
# Расчёт покрытия требований (логика Таба 6).
# Воронка: ТЗ-упоминания → Требования → ЧТЗ → Фичи → Тесты → Валидация.
# ============================================================

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import (
    Feature, FeatureRequirement, Requirement, TzRequirementMention,
)

REQ_TYPES = ("BUSINESS", "FUNCTIONAL", "NON_FUNCTIONAL")


def compute_coverage(session: Session, project_id: int) -> dict:
    """Сводка покрытия по проекту (для Таба 6 и дашборда)."""
    reqs = session.execute(
        select(Requirement).where(Requirement.project_id == project_id)
    ).scalars().all()
    total = len(reqs)

    # Упоминания в ТЗ: сколько требований зафиксировано из документа
    tz_linked = session.execute(
        select(func.count(func.distinct(TzRequirementMention.requirement_id)))
        .join(Requirement, Requirement.id == TzRequirementMention.requirement_id)
        .where(Requirement.project_id == project_id)
    ).scalar() or 0

    with_chtz = sum(1 for r in reqs if r.link_chtz)

    # Требования, привязанные хотя бы к одной фиче
    linked_ids = session.execute(
        select(func.distinct(FeatureRequirement.requirement_id))
        .join(Requirement, Requirement.id == FeatureRequirement.requirement_id)
        .where(Requirement.project_id == project_id)
    ).scalars().all()
    with_features = len(linked_ids)

    # Покрытие тестами: у связанной фичи заполнена ссылка на тест-кейсы
    features_by_req: dict[int, list[Feature]] = {}
    links = session.execute(
        select(FeatureRequirement, Feature)
        .join(Feature, Feature.id == FeatureRequirement.feature_id)
        .join(Requirement, Requirement.id == FeatureRequirement.requirement_id)
        .where(Requirement.project_id == project_id)
    ).all()
    for link, feature in links:
        features_by_req.setdefault(link.requirement_id, []).append(feature)

    with_tests = sum(
        1 for rid in linked_ids
        if any(f.link_test_cases for f in features_by_req.get(rid, []))
    )

    # «Реализация»: требование провалидировано и по ФС, и по тестам
    validated = sum(1 for r in reqs if r.last_validated_fs and r.last_validated_test)

    # Пробелы: требования без ссылки на ЧТЗ
    gaps = [r.id for r in reqs if not r.link_chtz]

    # Сироты: фичи с тест-кейсами, но без привязанных требований
    orphan_features = session.execute(
        select(Feature.id).where(Feature.link_test_cases.isnot(None))
        .where(Feature.link_test_cases != "")
        .where(~Feature.id.in_(select(FeatureRequirement.feature_id)))
    ).scalars().all()

    by_type = {
        t: {
            "total": sum(1 for r in reqs if r.req_type == t),
            "with_tests": sum(
                1 for rid in linked_ids
                if any(f.link_test_cases for f in features_by_req.get(rid, []))
                and _req_type(session, rid) == t
            ),
        }
        for t in REQ_TYPES
    }

    return {
        "project_id": project_id,
        "funnel": {
            "tz_mentions": tz_linked,
            "requirements": total,
            "in_chtz": with_chtz,
            "in_features": with_features,
            "with_tests": with_tests,
            "validated": validated,
        },
        "by_type": by_type,
        "gaps": gaps,
        "orphan_features": orphan_features,
    }


def _req_type(session: Session, requirement_id: int) -> str:
    return session.get(Requirement, requirement_id).req_type
