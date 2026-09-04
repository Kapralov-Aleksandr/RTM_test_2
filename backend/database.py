# ============================================================
# Модели SQLAlchemy 2.0 — зеркало SQLite-схемы (11 таблиц).
# База создаётся автоматически в data/app.db.
# ============================================================

import os
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

# Папка данных создаётся автоматически (data/app.db, data/mockups, ...)
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(DATA_DIR, exist_ok=True)
for sub in ("mockups", "attachments", "snapshots"):
    os.makedirs(os.path.join(DATA_DIR, sub), exist_ok=True)

DATABASE_URL = f"sqlite:///{os.path.join(DATA_DIR, 'app.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class Project(Base):
    """Проекты (мультипроектность)"""
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    jira_key: Mapped[str] = mapped_column(Text, unique=True, nullable=False)  # "LC", "PROJ"
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    requirements = relationship("Requirement", back_populates="project")


class Requirement(Base):
    """Атомарные требования (Таб 2 — Матрица)"""
    __tablename__ = "requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    req_key: Mapped[str] = mapped_column(Text, unique=True, nullable=False)  # REQ-{KEY}-{TYPE}-{NNNN}
    req_type: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    link_tz: Mapped[str | None] = mapped_column(Text)       # ссылка на раздел ТЗ
    link_chtz: Mapped[str | None] = mapped_column(Text)     # ссылка на ЧТЗ
    release: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    dependencies: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_validated_fs: Mapped[datetime | None] = mapped_column(DateTime)
    last_validated_test: Mapped[datetime | None] = mapped_column(DateTime)

    __table_args__ = (
        CheckConstraint("req_type IN ('BUSINESS','FUNCTIONAL','NON_FUNCTIONAL')", name="ck_requirement_type"),
    )

    project = relationship("Project", back_populates="requirements")
    history = relationship("RequirementHistory", back_populates="requirement")


class RequirementHistory(Base):
    """История изменений требований"""
    __tablename__ = "requirement_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id"), nullable=False)
    field_changed: Mapped[str | None] = mapped_column(Text)
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    requirement = relationship("Requirement", back_populates="history")


class TzDocument(Base):
    """Исходные ТЗ (Таб 1)"""
    __tablename__ = "tz_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    title: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str | None] = mapped_column(Text)               # HTML с подсвеченными требованиями
    attached_file_path: Mapped[str | None] = mapped_column(Text)    # путь к файлу ТЗ
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TzRequirementMention(Base):
    """Связь «выделенный текст → требование» в ТЗ"""
    __tablename__ = "tz_requirement_mentions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tz_document_id: Mapped[int] = mapped_column(ForeignKey("tz_documents.id"), nullable=False)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id"), nullable=False)
    start_offset: Mapped[int | None] = mapped_column(Integer)
    end_offset: Mapped[int | None] = mapped_column(Integer)
    highlighted_text: Mapped[str | None] = mapped_column(Text)


class ChtzDocument(Base):
    """ЧТЗ (Таб 3)"""
    __tablename__ = "chtz_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    title: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FeatureTreeNode(Base):
    """Дерево фиче-страниц (Таб 4): релизы → фичи"""
    __tablename__ = "feature_tree"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("feature_tree.id"))  # вложенность
    node_type: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    jira_key: Mapped[str | None] = mapped_column(Text)
    order_num: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        CheckConstraint("node_type IN ('RELEASE','FEATURE')", name="ck_feature_tree_node_type"),
    )


class Feature(Base):
    """Фиче-страницы"""
    __tablename__ = "features"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tree_node_id: Mapped[int | None] = mapped_column(ForeignKey("feature_tree.id"))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str | None] = mapped_column(Text)          # HTML-содержимое
    link_jira: Mapped[str | None] = mapped_column(Text)        # ссылка на фичу в Jira
    link_test_cases: Mapped[str | None] = mapped_column(Text)  # ссылка на тест-кейсы
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_validated: Mapped[datetime | None] = mapped_column(DateTime)

    mockups = relationship("Mockup", back_populates="feature")


class FeatureRequirement(Base):
    """Связь фича ↔ требование (многие-ко-многим)"""
    __tablename__ = "feature_requirements"

    feature_id: Mapped[int] = mapped_column(ForeignKey("features.id"), primary_key=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id"), primary_key=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Mockup(Base):
    """Макеты (прикреплённые изображения)"""
    __tablename__ = "mockups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    feature_id: Mapped[int] = mapped_column(ForeignKey("features.id"), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    filename: Mapped[str | None] = mapped_column(Text)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    feature = relationship("Feature", back_populates="mockups")


class FeatureHistory(Base):
    """История изменений фич (Таб 5)"""
    __tablename__ = "feature_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    feature_id: Mapped[int] = mapped_column(ForeignKey("features.id"), nullable=False)
    change_type: Mapped[str] = mapped_column(Text, nullable=False)  # CONTENT / COMPOSITION
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("change_type IN ('CONTENT','COMPOSITION')", name="ck_feature_history_change_type"),
    )


class ChangeRequest(Base):
    """Журнал новых требований (Change Requests)"""
    __tablename__ = "change_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    req_id: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(Text)
    date_added: Mapped[str | None] = mapped_column(Text)  # DATE хранится как ISO-строка
    budget_impact_hours: Mapped[int | None] = mapped_column(Integer)
    timeline_impact_days: Mapped[int | None] = mapped_column(Integer)
    linked_conf: Mapped[str | None] = mapped_column(Text)
    linked_jira: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint(
            "status IN ('AGREED','IN_PROGRESS','REJECTED','IMPLEMENTED')",
            name="ck_change_request_status",
        ),
    )


def init_db() -> None:
    """Создание всех таблиц (для разработки; в проде — Alembic-миграции)."""
    Base.metadata.create_all(bind=engine)
