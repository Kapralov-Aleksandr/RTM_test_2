# ============================================================
# Первичная миграция: 11 таблиц схемы Requirements Tracker
# ============================================================

"""initial schema

Revision ID: 0001
Revises:
Create Date: 2025-04-01
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("jira_key", sa.Text(), nullable=False, unique=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_table(
        "requirements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("req_key", sa.Text(), nullable=False, unique=True),
        sa.Column("req_type", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("link_tz", sa.Text()),
        sa.Column("link_chtz", sa.Text()),
        sa.Column("release", sa.Text()),
        sa.Column("notes", sa.Text()),
        sa.Column("dependencies", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("last_validated_fs", sa.DateTime()),
        sa.Column("last_validated_test", sa.DateTime()),
        sa.CheckConstraint("req_type IN ('BUSINESS','FUNCTIONAL','NON_FUNCTIONAL')", name="ck_requirement_type"),
    )
    op.create_table(
        "requirement_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("requirement_id", sa.Integer(), sa.ForeignKey("requirements.id"), nullable=False),
        sa.Column("field_changed", sa.Text()),
        sa.Column("old_value", sa.Text()),
        sa.Column("new_value", sa.Text()),
        sa.Column("changed_at", sa.DateTime()),
    )
    op.create_table(
        "tz_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("title", sa.Text()),
        sa.Column("content", sa.Text()),
        sa.Column("attached_file_path", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )
    op.create_table(
        "tz_requirement_mentions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tz_document_id", sa.Integer(), sa.ForeignKey("tz_documents.id"), nullable=False),
        sa.Column("requirement_id", sa.Integer(), sa.ForeignKey("requirements.id"), nullable=False),
        sa.Column("start_offset", sa.Integer()),
        sa.Column("end_offset", sa.Integer()),
        sa.Column("highlighted_text", sa.Text()),
    )
    op.create_table(
        "chtz_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("title", sa.Text()),
        sa.Column("content", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )
    op.create_table(
        "feature_tree",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("feature_tree.id")),
        sa.Column("node_type", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("jira_key", sa.Text()),
        sa.Column("order_num", sa.Integer(), server_default="0"),
        sa.CheckConstraint("node_type IN ('RELEASE','FEATURE')", name="ck_feature_tree_node_type"),
    )
    op.create_table(
        "features",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tree_node_id", sa.Integer(), sa.ForeignKey("feature_tree.id")),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("content", sa.Text()),
        sa.Column("link_jira", sa.Text()),
        sa.Column("link_test_cases", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("last_validated", sa.DateTime()),
    )
    op.create_table(
        "feature_requirements",
        sa.Column("feature_id", sa.Integer(), sa.ForeignKey("features.id"), primary_key=True),
        sa.Column("requirement_id", sa.Integer(), sa.ForeignKey("requirements.id"), primary_key=True),
        sa.Column("added_at", sa.DateTime()),
    )
    op.create_table(
        "mockups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("feature_id", sa.Integer(), sa.ForeignKey("features.id"), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("filename", sa.Text()),
        sa.Column("uploaded_at", sa.DateTime()),
    )
    op.create_table(
        "feature_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("feature_id", sa.Integer(), sa.ForeignKey("features.id"), nullable=False),
        sa.Column("change_type", sa.Text(), nullable=False),
        sa.Column("old_value", sa.Text()),
        sa.Column("new_value", sa.Text()),
        sa.Column("changed_at", sa.DateTime()),
        sa.CheckConstraint("change_type IN ('CONTENT','COMPOSITION')", name="ck_feature_history_change_type"),
    )
    op.create_table(
        "change_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("req_id", sa.Text()),
        sa.Column("description", sa.Text()),
        sa.Column("source", sa.Text()),
        sa.Column("date_added", sa.Text()),
        sa.Column("budget_impact_hours", sa.Integer()),
        sa.Column("timeline_impact_days", sa.Integer()),
        sa.Column("linked_conf", sa.Text()),
        sa.Column("linked_jira", sa.Text()),
        sa.Column("status", sa.Text()),
        sa.CheckConstraint(
            "status IN ('AGREED','IN_PROGRESS','REJECTED','IMPLEMENTED')",
            name="ck_change_request_status",
        ),
    )


def downgrade() -> None:
    for table in (
        "change_requests", "feature_history", "mockups", "feature_requirements",
        "features", "feature_tree", "chtz_documents", "tz_requirement_mentions",
        "tz_documents", "requirement_history", "requirements", "projects",
    ):
        op.drop_table(table)
