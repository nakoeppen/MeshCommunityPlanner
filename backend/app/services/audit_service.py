"""
Audit logging service for tracking CRUD operations.

Provides detailed change tracking with field-level before/after values,
user attribution, and timestamp precision.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Any
import sqlite3


@dataclass
class AuditLogEntry:
    """Audit log entry with change details."""
    id: Optional[str] = None
    timestamp: Optional[str] = None
    entity_type: str = ""
    entity_id: str = ""
    action: str = ""  # create, update, delete
    user: Optional[str] = None
    changes: Optional[Dict[str, Dict[str, Any]]] = None  # {"field": {"before": "x", "after": "y"}}
    reason: Optional[str] = None


class AuditService:
    """Service for logging and querying audit trails."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self._ensure_table()

    def _ensure_table(self):
        """Ensure audit_logs table exists."""
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                action TEXT NOT NULL,
                user TEXT,
                changes TEXT,
                reason TEXT
            )
        """)
        self.conn.commit()

    def log_create(
        self,
        entity_type: str,
        entity_id: str,
        user: Optional[str] = None,
        reason: Optional[str] = None
    ) -> str:
        """Log a create operation."""
        import uuid
        import json

        log_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + "Z"

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO audit_logs (id, timestamp, entity_type, entity_id, action, user, changes, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (log_id, timestamp, entity_type, entity_id, "create", user, None, reason))
        self.conn.commit()

        return log_id

    def log_update(
        self,
        entity_type: str,
        entity_id: str,
        changes: Dict[str, Dict[str, Any]],
        user: Optional[str] = None,
        reason: Optional[str] = None
    ) -> str:
        """Log an update operation with field-level changes."""
        import uuid
        import json

        log_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + "Z"

        # Serialize changes to JSON
        changes_json = json.dumps(changes)

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO audit_logs (id, timestamp, entity_type, entity_id, action, user, changes, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (log_id, timestamp, entity_type, entity_id, "update", user, changes_json, reason))
        self.conn.commit()

        return log_id

    def log_delete(
        self,
        entity_type: str,
        entity_id: str,
        user: Optional[str] = None,
        reason: Optional[str] = None
    ) -> str:
        """Log a delete operation."""
        import uuid
        import json

        log_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + "Z"

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO audit_logs (id, timestamp, entity_type, entity_id, action, user, changes, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (log_id, timestamp, entity_type, entity_id, "delete", user, None, reason))
        self.conn.commit()

        return log_id

    def get_logs(
        self,
        entity_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        action: Optional[str] = None,
        user: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Query audit logs with filters."""
        import json

        cursor = self.conn.cursor()

        # Build WHERE clause
        where_clauses = []
        params = []

        if entity_id:
            where_clauses.append("entity_id = ?")
            params.append(entity_id)

        if entity_type:
            where_clauses.append("entity_type = ?")
            params.append(entity_type)

        if action:
            where_clauses.append("action = ?")
            params.append(action)

        if user:
            where_clauses.append("user = ?")
            params.append(user)

        if start_date:
            where_clauses.append("timestamp >= ?")
            params.append(start_date)

        if end_date:
            where_clauses.append("timestamp <= ?")
            params.append(end_date)

        where_sql = ""
        if where_clauses:
            where_sql = "WHERE " + " AND ".join(where_clauses)

        # Query logs
        query = f"""
            SELECT id, timestamp, entity_type, entity_id, action, user, changes, reason
            FROM audit_logs
            {where_sql}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        """
        cursor.execute(query, params + [limit, offset])

        logs = []
        for row in cursor.fetchall():
            log = {
                "id": row[0],
                "timestamp": row[1],
                "entity_type": row[2],
                "entity_id": row[3],
                "action": row[4],
                "user": row[5],
                "changes": json.loads(row[6]) if row[6] else None,
                "reason": row[7]
            }
            logs.append(log)

        return logs


def get_audit_service(conn: sqlite3.Connection) -> AuditService:
    """Get audit service instance."""
    return AuditService(conn)
