"""
Pydantic models for Template entities.

Models:
- TemplateCreate: Request model for creating a new template
- TemplateUpdate: Request model for updating an existing template
- TemplateResponse: Response model for template data

Templates store reusable node configurations (without coordinates).

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


class TemplateCreate(BaseModel):
    """Request model for creating a new template."""

    name: str = Field(..., min_length=1, max_length=256, description="Template name")
    description: str = Field(default="", max_length=4096, description="Template description")
    firmware: str = Field(..., description="Firmware family (meshtastic, meshcore, reticulum)")
    region: str = Field(..., description="Regulatory region (us_fcc, eu_868, eu_433, anz)")
    config: str = Field(..., description="JSON-encoded node configuration (excluding coordinates)")

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

    @field_validator('firmware', 'region')
    @classmethod
    def validate_enum_strings(cls, v: str) -> str:
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
                    "name": "Solar Repeater US",
                    "description": "Standard solar-powered repeater for US FCC region",
                    "firmware": "meshtastic",
                    "region": "us_fcc",
                    "config": '{"frequency_mhz": 906.875, "tx_power_dbm": 22.0, "spreading_factor": 11, "bandwidth_khz": 250.0, "coding_rate": "4/5", "modem_preset": "long_fast", "antenna_id": "915-3dbi-omni", "is_solar": true}'
                }
            ]
        }
    }


class TemplateUpdate(BaseModel):
    """Request model for updating an existing template (all fields optional)."""

    name: Optional[str] = Field(None, min_length=1, max_length=256)
    description: Optional[str] = Field(None, max_length=4096)
    firmware: Optional[str] = None
    region: Optional[str] = None
    config: Optional[str] = None

    @field_validator('name', 'description')
    @classmethod
    def validate_string_security(cls, v: Optional[str]) -> Optional[str]:
        """Validate strings against SQL injection and SSRF attacks using W1's security functions."""
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

    @field_validator('firmware', 'region')
    @classmethod
    def validate_enum_strings(cls, v: Optional[str]) -> Optional[str]:
        """Validate enum-like string fields using W1's security functions."""
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
                    "name": "Updated Template Name",
                    "description": "Updated description"
                }
            ]
        }
    }


class TemplateResponse(BaseModel):
    """Response model for template data."""

    id: str = Field(..., description="Template UUID")
    name: str
    description: str
    firmware: str
    region: str
    config: str = Field(..., description="JSON-encoded node configuration")
    is_builtin: bool = Field(..., description="True for built-in templates (cannot be deleted)")
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "examples": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "name": "Solar Repeater US",
                    "description": "Standard solar-powered repeater for US FCC region",
                    "firmware": "meshtastic",
                    "region": "us_fcc",
                    "config": '{"frequency_mhz": 906.875, "tx_power_dbm": 22.0}',
                    "is_builtin": False,
                    "created_at": "2026-02-06T12:00:00Z",
                    "updated_at": "2026-02-06T12:00:00Z"
                }
            ]
        }
    }
