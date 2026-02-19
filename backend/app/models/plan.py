"""
Pydantic models for Plan entities.

Models:
- PlanCreate: Request model for creating a new plan
- PlanUpdate: Request model for updating an existing plan
- PlanResponse: Response model for plan data

Security:
All string fields are validated using W1's centralized security functions
to reject SQL injection and SSRF attack patterns.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

# Import W1's centralized security functions (defense-in-depth)
from backend.app.security.sanitize import contains_sql_injection
import re

# SSRF patterns for text fields (simpler than W1's coordinate validator)
_TEXT_SSRF_PATTERNS = [
    re.compile(r'https?://', re.IGNORECASE),  # URLs (anywhere in string)
    re.compile(r'file://', re.IGNORECASE),    # File URIs (anywhere in string)
    re.compile(r'ftp://', re.IGNORECASE),     # FTP URLs (anywhere in string)
    re.compile(r'\blocalhost\b', re.IGNORECASE),
    re.compile(r'\b127\.0\.0\.1\b'),
    re.compile(r'\b0\.0\.0\.0\b'),
    re.compile(r'\b169\.254\.', re.IGNORECASE),  # Link-local
    re.compile(r'\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'),  # Private 10.x
    re.compile(r'\b192\.168\.', re.IGNORECASE),  # Private 192.168.x
    re.compile(r'\b172\.(1[6-9]|2[0-9]|3[0-1])\.', re.IGNORECASE),  # Private 172.16-31.x
]


def contains_ssrf_pattern(value: str) -> bool:
    """Check if text contains SSRF patterns (URLs, IPs) - for general text fields."""
    if not value:
        return False
    for pattern in _TEXT_SSRF_PATTERNS:
        if pattern.search(value):
            return True
    return False


class PlanCreate(BaseModel):
    """Request model for creating a new plan."""

    name: str = Field(..., min_length=1, max_length=256, description="Plan name")
    description: str = Field(default="", max_length=4096, description="Plan description")
    firmware_family: Optional[str] = Field(
        default=None,
        description="Firmware family for the plan (meshtastic, meshcore, reticulum)"
    )
    region: Optional[str] = Field(
        default=None,
        description="Regulatory region (us_fcc, eu_868, eu_433, anz)"
    )

    @field_validator('name', 'description')
    @classmethod
    def validate_string_security(cls, v: str) -> str:
        """Validate strings against SQL injection (W1) and SSRF attacks."""
        if v is None:
            return v

        # Check for SQL injection patterns (using W1's function)
        if contains_sql_injection(v):
            raise ValueError(
                "Input contains potentially malicious SQL pattern. "
                "Please use only alphanumeric characters, spaces, and basic punctuation."
            )

        # Check for SSRF patterns (URLs/IPs in text)
        if contains_ssrf_pattern(v):
            raise ValueError(
                "Input contains potentially malicious URL or IP pattern. "
                "URLs and IP addresses are not allowed in this field."
            )

        return v

    @field_validator('firmware_family', 'region')
    @classmethod
    def validate_enum_strings(cls, v: Optional[str]) -> Optional[str]:
        """Validate enum-like string fields using W1's SQL injection check."""
        if v is None:
            return v

        if contains_sql_injection(v):
            raise ValueError(
                "Input contains potentially malicious SQL pattern. "
                "Please use only alphanumeric characters, spaces, and basic punctuation."
            )

        if contains_ssrf_pattern(v):
            raise ValueError(
                "Input contains potentially malicious URL or IP pattern. "
                "URLs and IP addresses are not allowed in this field."
            )

        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "Downtown Mesh Network",
                    "description": "Community mesh for downtown area",
                    "firmware_family": "meshtastic",
                    "region": "us_fcc"
                }
            ]
        }
    }


class PlanUpdate(BaseModel):
    """Request model for updating an existing plan (all fields optional)."""

    name: Optional[str] = Field(None, min_length=1, max_length=256)
    description: Optional[str] = Field(None, max_length=4096)
    firmware_family: Optional[str] = None
    region: Optional[str] = None
    file_path: Optional[str] = None
    audit_reason: Optional[str] = Field(None, max_length=1024, description="Optional reason for this change")

    @field_validator('name', 'description', 'file_path', 'audit_reason')
    @classmethod
    def validate_string_security(cls, v: Optional[str]) -> Optional[str]:
        """Validate strings against SQL injection (W1) and SSRF attacks."""
        if v is None:
            return v

        if contains_sql_injection(v):
            raise ValueError(
                "Input contains potentially malicious SQL pattern. "
                "Please use only alphanumeric characters, spaces, and basic punctuation."
            )

        if contains_ssrf_pattern(v):
            raise ValueError(
                "Input contains potentially malicious URL or IP pattern. "
                "URLs and IP addresses are not allowed in this field."
            )

        return v

    @field_validator('firmware_family', 'region')
    @classmethod
    def validate_enum_strings(cls, v: Optional[str]) -> Optional[str]:
        """Validate enum-like string fields using W1's SQL injection check."""
        if v is None:
            return v

        if contains_sql_injection(v):
            raise ValueError(
                "Input contains potentially malicious SQL pattern. "
                "Please use only alphanumeric characters, spaces, and basic punctuation."
            )

        if contains_ssrf_pattern(v):
            raise ValueError(
                "Input contains potentially malicious URL or IP pattern. "
                "URLs and IP addresses are not allowed in this field."
            )

        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "Updated Plan Name",
                    "description": "Updated description"
                }
            ]
        }
    }


class PlanResponse(BaseModel):
    """Response model for plan data."""

    id: str = Field(..., description="Plan UUID")
    name: str
    description: str
    firmware_family: Optional[str]
    region: Optional[str]
    file_path: Optional[str]
    created_at: datetime
    updated_at: datetime
    node_count: int = Field(default=0, description="Number of nodes in this plan")

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "examples": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "name": "Downtown Mesh Network",
                    "description": "Community mesh for downtown area",
                    "firmware_family": "meshtastic",
                    "region": "us_fcc",
                    "file_path": "/path/to/plan.meshplan",
                    "created_at": "2026-02-06T12:00:00Z",
                    "updated_at": "2026-02-06T12:00:00Z",
                    "node_count": 7
                }
            ]
        }
    }
