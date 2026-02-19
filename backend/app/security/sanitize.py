"""Input sanitization module.

Provides HTML/script stripping, path traversal prevention,
field length truncation, and SQL injection detection for all user inputs.
"""

import re
from urllib.parse import unquote

# Max field lengths
MAX_NAME_LENGTH = 256
MAX_DESCRIPTION_LENGTH = 4096

# Regex for HTML tag removal
_HTML_TAG_RE = re.compile(r"<[^>]+>")

# Path traversal patterns
_PATH_TRAVERSAL_PATTERNS = [
    "..",        # Parent directory
    "\x00",      # Null byte
    "%2f",       # URL-encoded /
    "%5c",       # URL-encoded \
    "%252f",     # Double-encoded /
    "%255c",     # Double-encoded \
]


def sanitize_string(value: str) -> str:
    """Strip HTML and script tags from a string.

    Removes all HTML tags while preserving inner text content.
    """
    return _HTML_TAG_RE.sub("", value)


def is_path_traversal(path: str) -> bool:
    """Check if a path contains traversal or injection patterns.

    Rejects: .., ..\\, null bytes, encoded traversal,
    absolute paths (Unix and Windows).
    """
    if not path:
        return False

    # Check null bytes
    if "\x00" in path:
        return True

    # Check absolute paths
    if path.startswith("/"):
        return True
    if len(path) >= 2 and path[1] == ":" and path[0].isalpha():
        return True

    # Check raw traversal patterns
    if ".." in path:
        return True

    # Check URL-decoded version
    decoded = unquote(unquote(path))  # Double-decode
    if ".." in decoded:
        return True

    # Check for URL-encoded patterns in raw string
    lower = path.lower()
    for pattern in _PATH_TRAVERSAL_PATTERNS:
        if pattern in lower:
            return True

    return False


def truncate_name(value: str) -> str:
    """Truncate a name field to MAX_NAME_LENGTH (256) characters."""
    return value[:MAX_NAME_LENGTH]


def truncate_description(value: str) -> str:
    """Truncate a description field to MAX_DESCRIPTION_LENGTH (4096) characters."""
    return value[:MAX_DESCRIPTION_LENGTH]


# --- SQL injection detection ---

# SQL keywords that indicate injection when preceded by a quote or semicolon.
# These patterns look for SQL syntax fragments that would never appear in
# legitimate plan names, node descriptions, etc.
_SQL_INJECTION_PATTERNS = [
    re.compile(r"(\b(OR|AND)\b\s+\S+\s*=\s*\S+)", re.IGNORECASE),       # OR 1=1, AND 'x'='x'
    re.compile(r"\bUNION\b\s+\b(ALL\s+)?SELECT\b", re.IGNORECASE),       # UNION SELECT
    re.compile(r"\bDROP\b\s+\bTABLE\b", re.IGNORECASE),                   # DROP TABLE
    re.compile(r"\bINSERT\b\s+\bINTO\b", re.IGNORECASE),                  # INSERT INTO
    re.compile(r"\bUPDATE\b\s+\w+\s+\bSET\b", re.IGNORECASE),            # UPDATE x SET
    re.compile(r"\bDELETE\b\s+\bFROM\b", re.IGNORECASE),                  # DELETE FROM
    re.compile(r"\bEXEC\b\s+\bxp_", re.IGNORECASE),                       # EXEC xp_cmdshell
    re.compile(r"\bSLEEP\s*\(", re.IGNORECASE),                           # SLEEP(5)
    re.compile(r"\bBENCHMARK\s*\(", re.IGNORECASE),                       # BENCHMARK(...)
    re.compile(r";\s*\b(DROP|DELETE|INSERT|UPDATE|EXEC)\b", re.IGNORECASE),  # ;DROP, ;DELETE
]

# Simple patterns: single-quote followed by SQL comment or boolean logic
_SQL_SIMPLE_PATTERNS = [
    re.compile(r"'\s*--"),                   # ' --  (comment after quote)
    re.compile(r"'\s+OR\s+'", re.IGNORECASE),  # ' OR '  (string comparison bypass)
]


def contains_sql_injection(value: str) -> bool:
    """Check if a string contains SQL injection patterns.

    Detects common SQL injection attempts including:
    - Boolean-based: OR 1=1, AND 'x'='x'
    - UNION-based: UNION SELECT
    - DDL attacks: DROP TABLE, INSERT INTO, UPDATE SET, DELETE FROM
    - Comment injection: ' --
    - Time-based: SLEEP(), BENCHMARK()
    - Command execution: EXEC xp_cmdshell

    Returns True if suspicious patterns detected, False for clean input.
    Note: This is a defense-in-depth check. All queries should ALSO use
    parameterized placeholders. This catches payloads at the input layer.
    """
    if not value:
        return False

    for pattern in _SQL_INJECTION_PATTERNS:
        if pattern.search(value):
            return True

    for pattern in _SQL_SIMPLE_PATTERNS:
        if pattern.search(value):
            return True

    return False
