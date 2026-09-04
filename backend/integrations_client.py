# ============================================================
# Клиент Jira Server / Confluence Server.
# Корпоративные серверы с самоподписанными SSL: verify=False,
# предупреждения urllib3 отключены. HTTP Basic Auth (логин/пароль).
# Все запросы: timeout=10, кэш TTL=300 секунд, ошибки — по-русски.
# ============================================================

import logging
import time
from typing import Any

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger("rms.integrations")

TIMEOUT = 10   # таймаут каждого запроса, сек
CACHE_TTL = 300  # кэш ответов, сек

_cache: dict[str, tuple[float, Any]] = {}


def _cached_get(url: str, login: str, password: str) -> Any:
    """GET с Basic Auth, verify=False, кэшированием на 5 минут."""
    key = f"{url}|{login}"
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < CACHE_TTL:
        logger.debug("Кэш-попадание: %s", url)
        return hit[1]

    try:
        response = requests.get(
            url,
            auth=(login, password),
            verify=False,  # самоподписанные SSL-сертификаты
            timeout=TIMEOUT,
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
    except requests.exceptions.SSLError as e:
        raise RuntimeError(f"Ошибка SSL при обращении к {url}: {e}") from e
    except requests.exceptions.Timeout as e:
        raise RuntimeError(f"Таймаут ({TIMEOUT} с) при обращении к {url}") from e
    except requests.exceptions.ConnectionError as e:
        raise RuntimeError(f"Сервер недоступен: {url} ({e})") from e
    except requests.exceptions.HTTPError as e:
        code = e.response.status_code if e.response is not None else "?"
        if code == 401:
            raise RuntimeError(f"Сервер отклонил credentials (401): {url}") from e
        if code == 404:
            raise RuntimeError(f"Объект не найден (404): {url}") from e
        raise RuntimeError(f"Ошибка HTTP {code} при обращении к {url}") from e

    data = response.json()
    _cache[key] = (now, data)
    return data


def get_jira_issue(jira_url: str, issue_key: str, login: str, password: str) -> dict:
    """GET {jira_url}/rest/api/2/issue/{key}"""
    url = f"{jira_url.rstrip('/')}/rest/api/2/issue/{issue_key}"
    issue = _cached_get(url, login, password)
    fields = issue.get("fields", {})
    return {
        "key": issue.get("key"),
        "summary": fields.get("summary"),
        "status": (fields.get("status") or {}).get("name"),
        "assignee": (fields.get("assignee") or {}).get("displayName"),
    }


def get_confluence_page(conf_url: str, page_id: str, login: str, password: str) -> dict:
    """GET {conf_url}/rest/api/content/{id}?expand=body.storage,version"""
    url = f"{conf_url.rstrip('/')}/rest/api/content/{page_id}?expand=body.storage,version"
    page = _cached_get(url, login, password)
    return {
        "id": page.get("id"),
        "title": page.get("title"),
        "version": (page.get("version") or {}).get("number"),
        "body": ((page.get("body") or {}).get("storage") or {}).get("value", ""),
    }


def get_confluence_versions(conf_url: str, page_id: str, login: str, password: str) -> dict:
    """GET {conf_url}/rest/api/content/{id}?expand=version"""
    url = f"{conf_url.rstrip('/')}/rest/api/content/{page_id}?expand=version"
    page = _cached_get(url, login, password)
    return {"id": page.get("id"), "title": page.get("title"), "version": (page.get("version") or {}).get("number")}
