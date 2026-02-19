"""Auth token generation and management.

Production: CSPRNG via secrets.token_urlsafe(32) — 256 bits entropy.
Test mode: reads MESH_PLANNER_TEST_TOKEN env var.
"""

import os
import secrets


def generate_token() -> str:
    """Generate a cryptographically secure random token (256 bits)."""
    return secrets.token_urlsafe(32)


def get_token() -> str:
    """Get the auth token for the current mode.

    Test mode: returns MESH_PLANNER_TEST_TOKEN env var.
    Production: generates a new CSPRNG token each call.
    """
    test_token = os.environ.get("MESH_PLANNER_TEST_TOKEN")
    if test_token:
        return test_token
    return generate_token()
