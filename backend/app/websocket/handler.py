"""WebSocket endpoint handler with ticket authentication.

Integrates W1's TicketManager with W3's ProgressManager to provide
authenticated WebSocket connections for propagation job progress.

Phase 11 task 11.9.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Maximum WebSocket message size (bytes) — prevents memory exhaustion
MAX_WS_MESSAGE_SIZE = 64 * 1024  # 64 KB


class WebSocketHandler:
    """Handles WebSocket connection lifecycle with ticket auth.

    Flow:
    1. Client requests ticket via POST /api/ws/ticket
    2. Client connects to WS and sends {"type": "auth", "ticket": "..."}
    3. Server validates ticket (single-use) via TicketManager
    4. On success, client is registered with ProgressManager
    5. Client receives propagation progress updates
    6. Client can send cancel messages

    Args:
        ticket_manager: W1's TicketManager instance for auth.
        progress_manager: W3's ProgressManager instance for updates.
    """

    def __init__(self, ticket_manager: Any, progress_manager: Any) -> None:
        self._ticket_manager = ticket_manager
        self._progress_manager = progress_manager

    async def create_ticket(self) -> dict[str, str]:
        """Create a new WebSocket auth ticket.

        Returns dict with ticket UUID for the client.
        """
        ticket = self._ticket_manager.create_ticket()
        return {"ticket": ticket}

    async def handle_connection(self, websocket: Any) -> None:
        """Handle a WebSocket connection from connect to disconnect.

        Expects the first message to be an auth message with a valid ticket.
        After auth, listens for client messages (e.g. cancel).
        Enforces MAX_WS_MESSAGE_SIZE to prevent memory exhaustion.
        """
        # Step 1: Wait for auth message
        authenticated = False
        try:
            raw = await websocket.receive_text()
            if len(raw) > MAX_WS_MESSAGE_SIZE:
                await _send_error(websocket, "Message too large")
                await websocket.close(code=4008, reason="Message too large")
                return
            auth_data = json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.warning("WebSocket auth: malformed JSON: %s", exc)
            await _send_error(websocket, "Invalid auth message: malformed JSON")
            await websocket.close(code=4001, reason="Invalid auth message")
            return
        except (ConnectionError, OSError) as exc:
            logger.info("WebSocket auth: connection lost: %s", exc)
            return
        except Exception as exc:
            logger.warning("WebSocket auth: unexpected error: %s: %s", type(exc).__name__, exc)
            await _send_error(websocket, "Invalid auth message")
            await websocket.close(code=4001, reason="Invalid auth message")
            return

        if auth_data.get("type") != "auth" or "ticket" not in auth_data:
            await _send_error(websocket, "Expected auth message with ticket")
            await websocket.close(code=4001, reason="Missing auth")
            return

        # Step 2: Validate ticket
        ticket = auth_data["ticket"]
        if not self._ticket_manager.validate_ticket(ticket):
            await _send_error(websocket, "Invalid or expired ticket")
            await websocket.close(code=4003, reason="Invalid ticket")
            return

        # Step 3: Register with progress manager
        authenticated = True
        await self._progress_manager.connect(websocket)
        await websocket.send_json({"type": "auth_ok"})
        logger.info("WebSocket authenticated and connected")

        # Step 4: Listen for messages until disconnect
        try:
            while True:
                try:
                    raw = await websocket.receive_text()
                    if len(raw) > MAX_WS_MESSAGE_SIZE:
                        await _send_error(websocket, "Message too large")
                        continue
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    logger.debug("WebSocket: ignoring malformed JSON message")
                    continue
                except (ConnectionError, OSError):
                    logger.info("WebSocket: client disconnected")
                    break
                except Exception as exc:
                    logger.warning("WebSocket: message loop error: %s: %s", type(exc).__name__, exc)
                    break
                await self._progress_manager.handle_client_message(data)
        finally:
            await self._progress_manager.disconnect(websocket)


async def _send_error(websocket: Any, message: str) -> None:
    """Send an error message to the client."""
    try:
        await websocket.send_json({"type": "error", "message": message})
    except (ConnectionError, OSError):
        pass  # Client already disconnected
    except Exception as exc:
        logger.debug("WebSocket: failed to send error: %s", exc)
