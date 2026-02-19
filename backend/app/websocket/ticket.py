"""WebSocket ticket system.

POST /ws/ticket returns a single-use UUID ticket with 30s expiry.
WebSocket connection validates and consumes the ticket.
"""

import time
import uuid


class TicketManager:
    """Manage single-use WebSocket authentication tickets.

    Args:
        ttl_seconds: Ticket time-to-live in seconds (default 30).
    """

    def __init__(self, ttl_seconds: int = 30):
        self.ttl_seconds = ttl_seconds
        self._tickets: dict[str, float] = {}  # ticket -> expiry timestamp

    def create_ticket(self) -> str:
        """Create a new single-use ticket.

        Periodically cleans up expired tickets to prevent unbounded growth.

        Returns:
            UUID string ticket.
        """
        # Clean expired tickets every 100 creates to prevent accumulation
        if len(self._tickets) > 100:
            self.cleanup()

        ticket = str(uuid.uuid4())
        self._tickets[ticket] = time.monotonic() + self.ttl_seconds
        return ticket

    def validate_ticket(self, ticket: str) -> bool:
        """Validate and consume a ticket.

        Returns True if valid (and consumes it). Returns False if
        invalid, already used, or expired.
        """
        if ticket not in self._tickets:
            return False

        expiry = self._tickets.pop(ticket)  # Consume on check
        if time.monotonic() > expiry:
            return False

        return True

    def cleanup(self) -> None:
        """Remove expired tickets from internal storage."""
        now = time.monotonic()
        expired = [t for t, exp in self._tickets.items() if now > exp]
        for t in expired:
            del self._tickets[t]
