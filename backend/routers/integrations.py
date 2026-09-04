# ============================================================
# /api/integrations — прокси к Jira / Confluence.
# Конфигурация: data/config.json (URL, логин, пароль) — тот же
# формат, что использует боковая панель фронтенда.
# ============================================================

import json
import logging
import os

from fastapi import APIRouter, HTTPException

import integrations_client as client

router = APIRouter(prefix="/api/integrations", tags=["Интеграции"])
logger = logging.getLogger("rms.integrations")

CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data", "config.json",
)


def _load_config() -> dict:
    """Чтение настроек интеграций из data/config.json"""
    if not os.path.exists(CONFIG_PATH):
        raise HTTPException(
            status_code=400,
            detail="Настройки интеграций не найдены: сохраните их в боковой панели (data/config.json)",
        )
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


@router.get("/jira/issue/{issue_key}")
def jira_issue(issue_key: str) -> dict:
    """Задача Jira: статус, исполнитель (verify=False, кэш 5 мин)"""
    cfg = _load_config()
    try:
        return client.get_jira_issue(cfg["jira_url"], issue_key, cfg["login"], cfg["password"])
    except RuntimeError as e:
        logger.warning("Jira: %s", e)
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/confluence/page/{page_id}")
def confluence_page(page_id: str) -> dict:
    """Страница Confluence: заголовок, версия, body.storage"""
    cfg = _load_config()
    try:
        return client.get_confluence_page(cfg["conf_url"], page_id, cfg["login"], cfg["password"])
    except RuntimeError as e:
        logger.warning("Confluence: %s", e)
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/confluence/page/{page_id}/version")
def confluence_version(page_id: str) -> dict:
    """Текущая версия страницы Confluence"""
    cfg = _load_config()
    try:
        return client.get_confluence_versions(cfg["conf_url"], page_id, cfg["login"], cfg["password"])
    except RuntimeError as e:
        logger.warning("Confluence: %s", e)
        raise HTTPException(status_code=502, detail=str(e)) from e
