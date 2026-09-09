# ============================================================
# Автогенерация ключей требований: REQ-{JIRA_KEY}-{TYPE}-{NNNN}
#   BUSINESS → BUS, FUNCTIONAL → FUNC, NON_FUNCTIONAL → NFUNC
# Номер NNNN — следующий в пределах проекта и типа (4 цифры).
# ============================================================

from sqlalchemy import select
from sqlalchemy.orm import Session

from database import Project, Requirement

TYPE_ABBR = {
    "BUSINESS": "BUS",
    "FUNCTIONAL": "FUNC",
    "NON_FUNCTIONAL": "NFUNC",
}


def next_req_key(session: Session, project: Project, req_type: str) -> str:
    """Возвращает следующий свободный ключ требования."""
    if req_type not in TYPE_ABBR:
        raise ValueError(f"Неизвестный тип требования: {req_type}")
    prefix = f"REQ-{project.jira_key.upper()}-{TYPE_ABBR[req_type]}-"
    keys = session.execute(
        select(Requirement.req_key)
        .where(Requirement.project_id == project.id)
        .where(Requirement.req_key.like(prefix + "%"))
    ).scalars().all()

    max_n = 0
    for key in keys:
        tail = key.rsplit("-", 1)[-1]
        if tail.isdigit():
            max_n = max(max_n, int(tail))
    return f"{prefix}{max_n + 1:04d}"
