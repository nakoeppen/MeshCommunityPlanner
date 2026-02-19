"""
Template Repository - CRUD operations for templates table.

Builtin templates cannot be deleted.
Supports filtering by builtin flag.
Uses parameterized queries for SQL injection prevention.
"""

import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any


class TemplateRepository:
    """Repository for template CRUD operations."""

    def __init__(self, conn: sqlite3.Connection):
        """
        Initialize template repository.

        Args:
            conn: SQLite database connection
        """
        self.conn = conn
        self.conn.row_factory = sqlite3.Row

    def create(
        self,
        name: str,
        firmware: str,
        region: str,
        config: str,
        description: str = ""
    ) -> str:
        """
        Create a new user template.

        Args:
            name: Template name
            firmware: Firmware family
            region: Regulatory region
            config: JSON-encoded node configuration
            description: Template description (default: "")

        Returns:
            Template UUID
        """
        template_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO templates (
                id, name, description, firmware, region, config,
                is_builtin, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
        """, (template_id, name, description, firmware, region, config, now, now))

        self.conn.commit()
        return template_id

    def get_by_id(self, template_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a template by ID.

        Args:
            template_id: Template UUID

        Returns:
            Template dictionary or None if not found
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT id, name, description, firmware, region, config,
                   is_builtin, created_at, updated_at
            FROM templates
            WHERE id = ?
        """, (template_id,))

        row = cursor.fetchone()
        if row is None:
            return None

        return dict(row)

    def update(
        self,
        template_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        firmware: Optional[str] = None,
        region: Optional[str] = None,
        config: Optional[str] = None
    ) -> bool:
        """
        Update a template (partial update supported).

        Args:
            template_id: Template UUID
            name: New name (optional)
            description: New description (optional)
            firmware: New firmware (optional)
            region: New region (optional)
            config: New config (optional)

        Returns:
            True if template was updated, False if not found
        """
        # Build dynamic UPDATE query
        updates = []
        params = []

        if name is not None:
            updates.append("name = ?")
            params.append(name)
        if description is not None:
            updates.append("description = ?")
            params.append(description)
        if firmware is not None:
            updates.append("firmware = ?")
            params.append(firmware)
        if region is not None:
            updates.append("region = ?")
            params.append(region)
        if config is not None:
            updates.append("config = ?")
            params.append(config)

        if not updates:
            return True

        # Always update updated_at
        updates.append("updated_at = ?")
        params.append(datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))

        # Add template_id to params
        params.append(template_id)

        cursor = self.conn.cursor()
        query = f"UPDATE templates SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)

        self.conn.commit()
        return cursor.rowcount > 0

    def delete(self, template_id: str) -> bool:
        """
        Delete a template (cannot delete builtin templates).

        Args:
            template_id: Template UUID

        Returns:
            True if template was deleted, False if not found or builtin
        """
        cursor = self.conn.cursor()

        # Cannot delete builtin templates
        cursor.execute("DELETE FROM templates WHERE id = ? AND is_builtin = 0", (template_id,))

        self.conn.commit()
        return cursor.rowcount > 0

    def list_all(
        self,
        include_builtin: bool = True,
        builtin_only: bool = False
    ) -> List[Dict[str, Any]]:
        """
        List templates with optional builtin flag filtering.

        Args:
            include_builtin: Include builtin templates (default: True)
            builtin_only: Return only builtin templates (default: False)

        Returns:
            List of template dictionaries
        """
        cursor = self.conn.cursor()

        if builtin_only:
            # Only builtin templates
            cursor.execute("""
                SELECT id, name, description, firmware, region, config,
                       is_builtin, created_at, updated_at
                FROM templates
                WHERE is_builtin = 1
                ORDER BY name ASC
            """)
        elif not include_builtin:
            # Only user templates
            cursor.execute("""
                SELECT id, name, description, firmware, region, config,
                       is_builtin, created_at, updated_at
                FROM templates
                WHERE is_builtin = 0
                ORDER BY created_at DESC
            """)
        else:
            # All templates (builtin first, then user)
            cursor.execute("""
                SELECT id, name, description, firmware, region, config,
                       is_builtin, created_at, updated_at
                FROM templates
                ORDER BY is_builtin DESC, created_at DESC
            """)

        rows = cursor.fetchall()
        return [dict(row) for row in rows]
