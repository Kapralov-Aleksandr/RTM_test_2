# ============================================================
# Pydantic-модели (схемы API) — вход и выход эндпоинтов.
# ============================================================

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------- Проекты ----------

class ProjectCreate(BaseModel):
    jira_key: str = Field(..., min_length=2, max_length=10, description="Ключ Jira, например LC")
    name: str = Field(..., min_length=1)


class ProjectUpdate(BaseModel):
    jira_key: Optional[str] = None
    name: Optional[str] = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    jira_key: str
    name: str
    created_at: datetime


# ---------- Требования ----------

class RequirementCreate(BaseModel):
    req_type: str = Field(..., pattern="^(BUSINESS|FUNCTIONAL|NON_FUNCTIONAL)$")
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    link_tz: Optional[str] = None
    link_chtz: Optional[str] = None
    release: Optional[str] = None
    notes: Optional[str] = None
    dependencies: Optional[str] = None


class RequirementUpdate(BaseModel):
    """Все поля опциональны; сохраняются только переданные."""
    req_type: Optional[str] = Field(None, pattern="^(BUSINESS|FUNCTIONAL|NON_FUNCTIONAL)$")
    title: Optional[str] = None
    description: Optional[str] = None
    link_tz: Optional[str] = None
    link_chtz: Optional[str] = None
    release: Optional[str] = None
    notes: Optional[str] = None
    dependencies: Optional[str] = None


class RequirementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    req_key: str
    req_type: str
    title: str
    description: Optional[str]
    link_tz: Optional[str]
    link_chtz: Optional[str]
    release: Optional[str]
    notes: Optional[str]
    dependencies: Optional[str]
    created_at: datetime
    updated_at: datetime
    last_validated_fs: Optional[datetime]
    last_validated_test: Optional[datetime]


class RequirementHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    requirement_id: int
    field_changed: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    changed_at: datetime


# ---------- Change Requests ----------

class ChangeRequestCreate(BaseModel):
    description: str = Field(..., min_length=1)
    source: Optional[str] = None
    date_added: Optional[str] = None
    budget_impact_hours: Optional[int] = 0
    timeline_impact_days: Optional[int] = 0
    linked_conf: Optional[str] = None
    linked_jira: Optional[str] = None
    status: Optional[str] = Field("AGREED", pattern="^(AGREED|IN_PROGRESS|REJECTED|IMPLEMENTED)$")


class ChangeRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    req_id: Optional[str]
    description: Optional[str]
    source: Optional[str]
    date_added: Optional[str]
    budget_impact_hours: Optional[int]
    timeline_impact_days: Optional[int]
    linked_conf: Optional[str]
    linked_jira: Optional[str]
    status: Optional[str]


# ---------- Ответы интеграций ----------

class HealthOut(BaseModel):
    status: str
    version: str
