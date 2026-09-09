# ============================================================
# Unit-тесты генерации ключей REQ-{KEY}-{TYPE}-{NNNN}
# Запуск: cd backend && python -m pytest tests/ -v
# ============================================================

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, Project
from services.id_generator import next_req_key


@pytest.fixture()
def session():
    """In-memory SQLite для изолированных тестов"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    s = TestSession()
    yield s
    s.close()


@pytest.fixture()
def project(session):
    p = Project(jira_key="LC", name="Личный кабинет абитуриента")
    session.add(p)
    session.commit()
    return p


def test_first_key_is_0001(session, project):
    assert next_req_key(session, project, "FUNCTIONAL") == "REQ-LC-FUNC-0001"


def test_abbreviations(session, project):
    assert next_req_key(session, project, "BUSINESS") == "REQ-LC-BUS-0001"
    assert next_req_key(session, project, "NON_FUNCTIONAL") == "REQ-LC-NFUNC-0001"


def test_sequential_numbering(session, project):
    from database import Requirement

    session.add(Requirement(project_id=project.id, req_key="REQ-LC-FUNC-0001",
                            req_type="FUNCTIONAL", title="Первое"))
    session.add(Requirement(project_id=project.id, req_key="REQ-LC-FUNC-0002",
                            req_type="FUNCTIONAL", title="Второе"))
    session.commit()
    assert next_req_key(session, project, "FUNCTIONAL") == "REQ-LC-FUNC-0003"


def test_types_have_independent_counters(session, project):
    from database import Requirement

    session.add(Requirement(project_id=project.id, req_key="REQ-LC-FUNC-0007",
                            req_type="FUNCTIONAL", title="Функциональное"))
    session.commit()
    # Счётчик BUSINESS не зависит от FUNCTIONAL
    assert next_req_key(session, project, "BUSINESS") == "REQ-LC-BUS-0001"


def test_zero_padding(session, project):
    from database import Requirement

    session.add(Requirement(project_id=project.id, req_key="REQ-LC-BUS-0009",
                            req_type="BUSINESS", title="Девятое"))
    session.commit()
    assert next_req_key(session, project, "BUSINESS") == "REQ-LC-BUS-0010"


def test_projects_isolated(session, project):
    from database import Requirement

    other = Project(jira_key="PROJ", name="Учебный процесс")
    session.add(other)
    session.commit()
    session.add(Requirement(project_id=project.id, req_key="REQ-LC-FUNC-0005",
                            req_type="FUNCTIONAL", title="Чужое"))
    session.commit()
    assert next_req_key(session, other, "FUNCTIONAL") == "REQ-PROJ-FUNC-0001"


def test_unknown_type_raises(session, project):
    with pytest.raises(ValueError):
        next_req_key(session, project, "WRONG_TYPE")
