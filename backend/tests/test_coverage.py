# ============================================================
# Unit-тесты расчёта покрытия (воронка, пробелы, сироты)
# ============================================================

from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, Feature, FeatureRequirement, Project, Requirement, TzRequirementMention, TzDocument
from services.coverage import compute_coverage


@pytest.fixture()
def session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    s = TestSession()
    yield s
    s.close()


@pytest.fixture()
def seeded(session):
    """Проект с 3 требованиями разной степени покрытия"""
    project = Project(jira_key="LC", name="Тест")
    session.add(project)
    session.commit()

    tz = TzDocument(project_id=project.id, title="ТЗ", content="...")
    session.add(tz)
    session.commit()

    r1 = Requirement(project_id=project.id, req_key="REQ-LC-FUNC-0001", req_type="FUNCTIONAL",
                     title="Полное покрытие", link_chtz="ЧТЗ 1",
                     last_validated_fs=datetime(2025, 3, 1), last_validated_test=datetime(2025, 3, 1))
    r2 = Requirement(project_id=project.id, req_key="REQ-LC-FUNC-0002", req_type="FUNCTIONAL",
                     title="Пробел — нет ЧТЗ", link_chtz=None)
    r3 = Requirement(project_id=project.id, req_key="REQ-LC-BUS-0001", req_type="BUSINESS",
                     title="Есть ЧТЗ, нет фичи", link_chtz="ЧТЗ 2")
    session.add_all([r1, r2, r3])
    session.commit()

    f1 = Feature(title="Фича с тестами", link_test_cases="ПМИ §4")
    f_orphan = Feature(title="Фича-сирота", link_test_cases="ПМИ §9")  # тесты есть, требований нет
    session.add_all([f1, f_orphan])
    session.commit()

    session.add(FeatureRequirement(feature_id=f1.id, requirement_id=r1.id))
    session.add(TzRequirementMention(tz_document_id=tz.id, requirement_id=r1.id,
                                     start_offset=0, end_offset=10, highlighted_text="текст"))
    session.commit()
    return project


def test_funnel_counts(session, seeded):
    cov = compute_coverage(session, seeded.id)
    funnel = cov["funnel"]
    assert funnel["requirements"] == 3
    assert funnel["tz_mentions"] == 1
    assert funnel["in_chtz"] == 2        # r1 + r3
    assert funnel["in_features"] == 1    # только r1
    assert funnel["with_tests"] == 1     # у f1 есть link_test_cases
    assert funnel["validated"] == 1      # r1 провалидирован по обоим направлениям


def test_gaps_detected(session, seeded):
    cov = compute_coverage(session, seeded.id)
    assert len(cov["gaps"]) == 1  # r2 без ссылки на ЧТЗ


def test_orphans_detected(session, seeded):
    cov = compute_coverage(session, seeded.id)
    assert len(cov["orphan_features"]) == 1  # фича с тестами без требований


def test_by_type_breakdown(session, seeded):
    cov = compute_coverage(session, seeded.id)
    assert cov["by_type"]["FUNCTIONAL"]["total"] == 2
    assert cov["by_type"]["BUSINESS"]["total"] == 1
    assert cov["by_type"]["NON_FUNCTIONAL"]["total"] == 0
