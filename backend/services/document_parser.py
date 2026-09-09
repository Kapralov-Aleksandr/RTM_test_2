# ============================================================
# Парсинг загруженных документов (ТЗ) в HTML для редактора.
# Поддерживаемые форматы: .docx, .pdf, .txt, .doc (как .txt).
# Возвращает HTML-строку с сохранением структуры: заголовки,
# абзацы, списки. При ошибке парсинга — RuntimeError с
# информативным сообщением на русском.
# ============================================================

import html
import io
import logging
import re
from pathlib import Path

logger = logging.getLogger("rms.parser")

# ---------- Вспомогательные ----------

def _escape(text: str) -> str:
    """Экранирование HTML-спецсимволов в пользовательском тексте"""
    return html.escape(text, quote=False)


def _wrap_paragraphs(text: str) -> str:
    """Оборачивает абзацы (пустые строки) в <p>"""
    blocks = re.split(r"\n\s*\n", text.strip())
    return "".join(f"<p>{_escape(b.strip())}</p>" for b in blocks if b.strip())


# ---------- DOCX ----------

def _parse_docx(file_bytes: bytes) -> str:
    """DOCX → HTML. Сохраняет заголовки и списки."""
    try:
        from docx import Document
    except ImportError as e:
        raise RuntimeError(
            "Библиотека python-docx не установлена. Выполните: "
            "pip install python-docx"
        ) from e

    try:
        doc = Document(io.BytesIO(file_bytes))
    except Exception as e:
        raise RuntimeError(f"Не удалось прочитать DOCX: {e}") from e

    parts: list[str] = []
    in_list = False

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            if in_list:
                parts.append("</ul>")
                in_list = False
            continue

        style_name = (para.style.name or "").lower()
        escaped = _escape(text)

        # Заголовки (Heading 1/2/3 → h1/h2/h3)
        if "heading" in style_name:
            if in_list:
                parts.append("</ul>")
                in_list = False
            level = re.search(r"(\d+)", style_name)
            h = f"h{level.group(1)}" if level else "h2"
            parts.append(f"<{h}>{escaped}</{h}>")
            continue

        # Списки (List Paragraph / List Number / List Bullet)
        if any(k in style_name for k in ("list", "bullet", "number")):
            if not in_list:
                parts.append("<ul>")
                in_list = True
            parts.append(f"<li>{escaped}</li>")
            continue

        # Обычный абзац
        if in_list:
            parts.append("</ul>")
            in_list = False
        parts.append(f"<p>{escaped}</p>")

    if in_list:
        parts.append("</ul>")

    result = "".join(parts).strip()
    if not result:
        raise RuntimeError("Документ не содержит текста")
    return result


# ---------- PDF ----------

def _parse_pdf(file_bytes: bytes) -> str:
    """PDF → HTML. Сохраняет абзацы через пустые строки."""
    try:
        import pdfplumber
    except ImportError as e:
        raise RuntimeError(
            "Библиотека pdfplumber не установлена. Выполните: "
            "pip install pdfplumber"
        ) from e

    try:
        pages_text: list[str] = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                if text.strip():
                    pages_text.append(text)
    except Exception as e:
        raise RuntimeError(f"Не удалось прочитать PDF: {e}") from e

    full = "\n\n".join(pages_text).strip()
    if not full:
        raise RuntimeError("PDF не содержит извлекаемого текста (возможно, скан)")
    return _wrap_paragraphs(full)


# ---------- TXT ----------

def _parse_txt(file_bytes: bytes) -> str:
    """TXT → HTML. Пробуем UTF-8, затем cp1251 (частый случай для Windows)."""
    for enc in ("utf-8", "utf-8-sig", "cp1251"):
        try:
            text = file_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise RuntimeError("Не удалось определить кодировку текстового файла")

    text = text.strip()
    if not text:
        raise RuntimeError("Файл пуст")
    return _wrap_paragraphs(text)


# ---------- Публичный API ----------

def parse_document(file_bytes: bytes, filename: str) -> str:
    """
    Парсит документ в HTML по расширению.
    Raises: RuntimeError с понятным сообщением.
    """
    ext = Path(filename).suffix.lower()
    logger.info("Парсинг документа: %s (%d байт)", filename, len(file_bytes))

    if ext == ".docx":
        return _parse_docx(file_bytes)
    if ext == ".pdf":
        return _parse_pdf(file_bytes)
    if ext in (".txt", ".doc", ".rtf", ".md"):
        return _parse_txt(file_bytes)

    raise RuntimeError(
        f"Формат '{ext}' не поддерживается. Допустимые: .docx, .pdf, .txt, .doc"
    )
