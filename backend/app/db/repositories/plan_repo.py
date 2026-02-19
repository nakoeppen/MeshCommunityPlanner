"""
Plan Repository - CRUD operations for plans table.

Uses parameterized queries for SQL injection prevention.
Handles cascade delete for nodes.
"""

import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any


class PlanRepository:
    """Repository for plan CRUD operations."""

    def __init__(self, conn: sqlite3.Connection):
        """
        Initialize plan repository.

        Args:
            conn: SQLite database connection
        """
        self.conn = conn
        self.conn.row_factory = sqlite3.Row

    def create(
        self,
        name: str,
        description: str = "",
        firmware_family: Optional[str] = None,
        region: Optional[str] = None,
        file_path: Optional[str] = None
    ) -> str:
        """
        Create a new plan.

        Args:
            name: Plan name (required)
            description: Plan description (default: "")
            firmware_family: Firmware family (optional)
            region: Regulatory region (optional)
            file_path: Path to .meshplan file (optional)

        Returns:
            Plan UUID
        """
        plan_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO plans (
                id, name, description, firmware_family, region, file_path,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (plan_id, name, description, firmware_family, region, file_path, now, now))

        self.conn.commit()
        return plan_id

    def get_by_id(self, plan_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a plan by ID.

        Args:
            plan_id: Plan UUID

        Returns:
            Plan dictionary or None if not found
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT id, name, description, firmware_family, region, file_path,
                   created_at, updated_at
            FROM plans
            WHERE id = ?
        """, (plan_id,))

        row = cursor.fetchone()
        if row is None:
            return None

        return dict(row)

    def update(
        self,
        plan_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        firmware_family: Optional[str] = None,
        region: Optional[str] = None,
        file_path: Optional[str] = None
    ) -> bool:
        """
        Update a plan (partial update supported).

        Args:
            plan_id: Plan UUID
            name: New name (optional)
            description: New description (optional)
            firmware_family: New firmware family (optional)
            region: New region (optional)
            file_path: New file path (optional)

        Returns:
            True if plan was updated, False if not found
        """
        # Build dynamic UPDATE query for provided fields
        updates = []
        params = []

        if name is not None:
            updates.append("name = ?")
            params.append(name)
        if description is not None:
            updates.append("description = ?")
            params.append(description)
        if firmware_family is not None:
            updates.append("firmware_family = ?")
            params.append(firmware_family)
        if region is not None:
            updates.append("region = ?")
            params.append(region)
        if file_path is not None:
            updates.append("file_path = ?")
            params.append(file_path)

        if not updates:
            # No fields to update
            return True

        # Always update updated_at
        updates.append("updated_at = ?")
        params.append(datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))

        # Add plan_id to params
        params.append(plan_id)

        cursor = self.conn.cursor()
        query = f"UPDATE plans SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)

        self.conn.commit()
        return cursor.rowcount > 0

    def delete(self, plan_id: str) -> bool:
        """
        Delete a plan (cascade deletes nodes via foreign key).

        Args:
            plan_id: Plan UUID

        Returns:
            True if plan was deleted, False if not found
        """
        cursor = self.conn.cursor()

        # Enable foreign key constraints (needed for CASCADE)
        cursor.execute("PRAGMA foreign_keys = ON")

        cursor.execute("DELETE FROM plans WHERE id = ?", (plan_id,))

        self.conn.commit()
        return cursor.rowcount > 0

    def list_all(self) -> List[Dict[str, Any]]:
        """
        List all plans.

        Returns:
            List of plan dictionaries
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT id, name, description, firmware_family, region, file_path,
                   created_at, updated_at
            FROM plans
            ORDER BY created_at DESC
        """)

        rows = cursor.fetchall()
        return [dict(row) for row in rows]

    def list_with_filters(
        self,
        firmware_family: Optional[str] = None,
        region: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        List plans with optional filters.

        Args:
            firmware_family: Filter by firmware family (exact match)
            region: Filter by region (exact match)
            search: Search in name and description (case-insensitive, partial match)

        Returns:
            List of plan dictionaries matching all provided filters,
            ordered by created_at DESC (newest first)
        """
        cursor = self.conn.cursor()

        # Build WHERE clause dynamically
        where_clauses = []
        params = []

        if firmware_family is not None:
            where_clauses.append("firmware_family = ?")
            params.append(firmware_family)

        if region is not None:
            where_clauses.append("region = ?")
            params.append(region)

        if search is not None:
            # Case-insensitive search in both name and description
            where_clauses.append("(name LIKE ? OR description LIKE ?)")
            search_pattern = f"%{search}%"
            params.append(search_pattern)
            params.append(search_pattern)

        where_sql = ""
        if where_clauses:
            where_sql = "WHERE " + " AND ".join(where_clauses)

        query = f"""
            SELECT id, name, description, firmware_family, region, file_path,
                   created_at, updated_at
            FROM plans
            {where_sql}
            ORDER BY created_at DESC
        """

        cursor.execute(query, params)

        rows = cursor.fetchall()
        return [dict(row) for row in rows]
