# ============================================================
# Unit-тесты детекции рассинхронизаций (Таб 5)
# ============================================================

from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, Feature, FeatureRequirement, Project, Requirement
from services.change_detection import stale_features, stale_requirements


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
    project = Project(jira_key="LC", name="Тест")
    session.add(project)
    session.commit()

    # Требование изменилось 20 марта — фича валидирована 1 марта → рассинхрон
    r_stale = Requirement(project_id=project.id, req_key="REQ-LC-FUNC-0001", req_type="FUNCTIONAL",
                          title="Изменилось", updated_at=datetime(2025, 3, 20))
    # Требование от 1 февраля, фича валидирована 1 марта → актуально
    r_fresh = Requirement(project_id=project.id, req_key="REQ-LC-FUNC-0002", req_type="FUNCTIONAL",
                          title="Актуально", updated_at=datetime(2025, 2, 1))
    session.add_all([r_stale, r_fresh])
    session.commit()

    f = Feature(title="Фича", updated_at=datetime(2025, 3, 25), last_validated=datetime(2025, 3, 1))
    session.add(f)
    session.commit()
    session.add_all([
        FeatureRequirement(feature_id=f.id, requirement_id=r_stale.id),
        FeatureRequirement(feature_id=f.id, requirement_id=r_fresh.id),
    ])
    session.commit()
    return project


def test_detects_stale_requirement(session, seeded):
    rows = stale_requirements(session, seeded.id)
    keys = {r["req_key"] for r in rows}
    assert "REQ-LC-FUNC-0001" in keys
    assert "REQ-LC-FUNC-0002" not in keys


def test_stale_row_contains_dates(session, seeded):
    rows = stale_requirements(session, seeded.id)
    row = next(r for r in rows if r["req_key"] == "REQ-LC-FUNC-0001")
    assert row["req_updated_at"].startswith("2025-03-20")
    assert row["feature_last_validated"].startswith("2025-03-01")


def test_detects_stale_feature(session, seeded):
    rows = stale_features(session, seeded.id)
    assert len(rows) == 1
    assert rows[0]["feature_title"] == "Фича"


def test_feature_without_validation_is_stale(session):
    """Фича, которую ни разу не валидировали, считается рассинхронизированной"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    s = TestSession()

    project = Project(jira_key="LC", name="Тест")
    s.add(project)
    s.commit()
    r = Requirement(project_id=project.id, req_key="REQ-LC-FUNC-0001",
                    req_type="FUNCTIONAL", title="Т", updated_at=datetime(2025, 1, 1))
    s.add(r)
    s.commit()
    f = Feature(title="Ни разу не валидирована", updated_at=datetime(2025, 1, 5), last_validated=None)
    s.add(f)
    s.commit()
    s.add(FeatureRequirement(feature_id=f.id, requirement_id=r.id))
    s.commit()

    assert len(stale_requirements(s, project.id)) == 1
    assert len(stale_features(s, project.id)) == 1
    s.close()
