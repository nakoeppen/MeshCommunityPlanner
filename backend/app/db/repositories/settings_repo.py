"""
Settings Repository - Key-value operations for settings table.

All values stored as strings (caller handles type conversion).
Supports bulk read and default fallback for missing keys.
Uses parameterized queries for SQL injection prevention.
"""

import sqlite3
from typing import Optional, Dict


class SettingsRepository:
    """Repository for settings key-value operations."""

    def __init__(self, conn: sqlite3.Connection):
        """
        Initialize settings repository.

        Args:
            conn: SQLite database connection
        """
        self.conn = conn
        self.conn.row_factory = sqlite3.Row

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """
        Get a setting value by key.

        Args:
            key: Setting key
            default: Default value if key not found

        Returns:
            Setting value or default if not found
        """
        cursor = self.conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))

        row = cursor.fetchone()
        if row is None:
            return default

        return row["value"]

    def set(self, key: str, value: str) -> None:
        """
        Set a setting value (insert or update).

        Args:
            key: Setting key
            value: Setting value (stored as string)
        """
        cursor = self.conn.cursor()

        # Use INSERT OR REPLACE for upsert
        cursor.execute("""
            INSERT OR REPLACE INTO settings (key, value)
            VALUES (?, ?)
        """, (key, value))

        self.conn.commit()

    def delete(self, key: str) -> bool:
        """
        Delete a setting.

        Args:
            key: Setting key

        Returns:
            True if setting was deleted, False if not found
        """
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM settings WHERE key = ?", (key,))

        self.conn.commit()
        return cursor.rowcount > 0

    def get_all(self) -> Dict[str, str]:
        """
        Get all settings as a dictionary.

        Returns:
            Dictionary of all settings (key -> value)
        """
        cursor = self.conn.cursor()
        cursor.execute("SELECT key, value FROM settings")

        rows = cursor.fetchall()
        return {row["key"]: row["value"] for row in rows}
