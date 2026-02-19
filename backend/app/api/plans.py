"""
Plans API endpoints - CRUD operations for mesh network plans.

All endpoints require authentication via Bearer token.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
import sqlite3

from backend.app.models.plan import PlanCreate, PlanUpdate, PlanResponse

from backend.app.db.repositories.plan_repo import PlanRepository
from backend.app.db.connection import get_db_connection


router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("", response_model=List[PlanResponse])
async def list_plans(
    firmware_family: Optional[str] = Query(
        default=None,
        description="Filter by firmware family (e.g., 'meshtastic', 'reticulum')"
    ),
    region: Optional[str] = Query(
        default=None,
        description="Filter by regulatory region (e.g., 'us_fcc', 'eu_868')"
    ),
    search: Optional[str] = Query(
        default=None,
        description="Search in plan name and description (case-insensitive)"
    ),
    conn: sqlite3.Connection = Depends(get_db_connection)
):
    """
    List all mesh network plans with optional filtering.

    Returns plans ordered by creation date (newest first).
    Each plan includes node count and metadata.

    Query Parameters:
        firmware_family: Filter by firmware family (exact match)
        region: Filter by regulatory region (exact match)
        search: Search in name and description (partial, case-insensitive)

    All filters can be combined for more specific results.

    Returns:
        List of plans matching all provided filters

    Examples:
        ```
        GET /api/plans
        GET /api/plans?firmware_family=meshtastic
        GET /api/plans?region=us_fcc
        GET /api/plans?search=community
        GET /api/plans?firmware_family=meshtastic&region=us_fcc&search=downtown
        ```

    Example response:
        ```json
        [
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Downtown Community Mesh",
                "description": "Coverage for downtown area",
                "firmware_family": "meshtastic",
                "region": "us_fcc",
                "file_path": "/path/to/plan.meshplan",
                "created_at": "2026-02-06T15:30:45.123456Z",
                "updated_at": "2026-02-06T16:45:12.789012Z",
                "node_count": 12
            }
        ]
        ```
    """
    repo = PlanRepository(conn)
    plans = repo.list_with_filters(
        firmware_family=firmware_family,
        region=region,
        search=search
    )
    return plans


@router.post("", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    plan: PlanCreate,
    conn: sqlite3.Connection = Depends(get_db_connection)
):
    """
    Create a new mesh network plan.

    Creates a new plan with the provided name and optional metadata.
    The plan starts with zero nodes and can be populated via the Nodes API.

    Args:
        plan: Plan creation data
            - name (required): Plan name (max 256 chars)
            - description (optional): Plan description (max 4096 chars)
            - firmware_family (optional): Target firmware (e.g., "meshtastic", "reticulum")
            - region (optional): Regulatory region (e.g., "us_fcc", "eu_868")

    Returns:
        Created plan with generated ID and timestamps

    Example request:
        ```json
        {
            "name": "Downtown Community Mesh",
            "description": "Coverage for downtown area",
            "firmware_family": "meshtastic",
            "region": "us_fcc"
        }
        ```

    Example response:
        ```json
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "name": "Downtown Community Mesh",
            "description": "Coverage for downtown area",
            "firmware_family": "meshtastic",
            "region": "us_fcc",
            "file_path": null,
            "created_at": "2026-02-06T15:30:45.123456Z",
            "updated_at": "2026-02-06T15:30:45.123456Z",
            "node_count": 0
        }
        ```
    """
    from backend.app.services.audit_service import get_audit_service

    repo = PlanRepository(conn)

    plan_id = repo.create(
        name=plan.name,
        description=plan.description,
        firmware_family=plan.firmware_family,
        region=plan.region,
        file_path=None  # File path set later when saved to disk
    )

    # Log creation in audit trail
    audit_service = get_audit_service(conn)
    audit_service.log_create(entity_type="plan", entity_id=plan_id, user="test-user")

    # Retrieve and return the created plan
    created_plan = repo.get_by_id(plan_id)
    return created_plan



@router.get("/{plan_id}", response_model=PlanResponse, responses={
    404: {"description": "Plan not found"}
})
async def get_plan(
    plan_id: str,
    conn: sqlite3.Connection = Depends(get_db_connection)
):
    """
    Get a specific plan by ID.

    Retrieves full plan details including node count.
    Use the Nodes API to retrieve the actual nodes.

    Args:
        plan_id: Plan UUID (format: 550e8400-e29b-41d4-a716-446655440000)

    Returns:
        Plan with all metadata and node count

    Raises:
        HTTPException: 404 if plan not found

    Example response:
        ```json
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "name": "Downtown Community Mesh",
            "description": "Coverage for downtown area",
            "firmware_family": "meshtastic",
            "region": "us_fcc",
            "file_path": "/path/to/plan.meshplan",
            "created_at": "2026-02-06T15:30:45.123456Z",
            "updated_at": "2026-02-06T16:45:12.789012Z",
            "node_count": 12
        }
        ```
    """
    repo = PlanRepository(conn)
    plan = repo.get_by_id(plan_id)

    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found"
        )

    return plan






@router.put("/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: str,
    plan: PlanUpdate,
    conn: sqlite3.Connection = Depends(get_db_connection)
):
    """
    Update a plan (partial updates supported).

    Update any combination of plan fields. Omitted fields are not changed.
    The `updated_at` timestamp is automatically updated.

    Args:
        plan_id: Plan UUID (format: 550e8400-e29b-41d4-a716-446655440000)
        plan: Fields to update (all fields optional)
            - name: New plan name (max 256 chars)
            - description: New description (max 4096 chars)
            - firmware_family: New firmware family
            - region: New regulatory region
            - file_path: New file path (set when saving to disk)

    Returns:
        Updated plan with new `updated_at` timestamp

    Raises:
        HTTPException: 404 if plan not found

    Example request (partial update):
        ```json
        {
            "name": "Updated Plan Name",
            "description": "New description"
        }
        ```

    Example response:
        ```json
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "name": "Updated Plan Name",
            "description": "New description",
            "firmware_family": "meshtastic",
            "region": "us_fcc",
            "file_path": null,
            "created_at": "2026-02-06T15:30:45.123456Z",
            "updated_at": "2026-02-06T17:15:22.456789Z",
            "node_count": 12
        }
        ```
    """
    from backend.app.services.audit_service import get_audit_service

    repo = PlanRepository(conn)

    # Get current state for audit trail
    current_plan = repo.get_by_id(plan_id)
    if not current_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found"
        )

    # Convert to dict for comparison
    if hasattr(current_plan, "keys"):
        current_dict = dict(current_plan)
    else:
        current_dict = {
            "name": current_plan.name,
            "description": current_plan.description,
            "firmware_family": current_plan.firmware_family,
            "region": current_plan.region,
            "file_path": current_plan.file_path
        }

    success = repo.update(
        plan_id=plan_id,
        name=plan.name,
        description=plan.description,
        firmware_family=plan.firmware_family,
        region=plan.region,
        file_path=plan.file_path
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found"
        )

    # Retrieve and return the updated plan
    updated_plan = repo.get_by_id(plan_id)

    # Convert to dict for comparison
    if hasattr(updated_plan, "keys"):
        updated_dict = dict(updated_plan)
    else:
        updated_dict = {
            "name": updated_plan.name,
            "description": updated_plan.description,
            "firmware_family": updated_plan.firmware_family,
            "region": updated_plan.region,
            "file_path": updated_plan.file_path
        }

    # Track field-level changes
    changes = {}
    for field in ["name", "description", "firmware_family", "region", "file_path"]:
        if field in current_dict and field in updated_dict:
            if current_dict[field] != updated_dict[field]:
                changes[field] = {
                    "before": current_dict[field],
                    "after": updated_dict[field]
                }

    # Log update in audit trail if there are changes
    if changes:
        audit_service = get_audit_service(conn)
        audit_service.log_update(
            entity_type="plan",
            entity_id=plan_id,
            changes=changes,
            user="test-user",
            reason=plan.audit_reason
        )

    return updated_plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: str,
    conn: sqlite3.Connection = Depends(get_db_connection)
):
    """
    Delete a plan and all associated nodes.

    **Warning**: This operation cascade-deletes all nodes associated with the plan.
    This action cannot be undone.

    Args:
        plan_id: Plan UUID (format: 550e8400-e29b-41d4-a716-446655440000)

    Returns:
        204 No Content on success

    Raises:
        HTTPException: 404 if plan not found

    Example:
        ```
        DELETE /api/plans/550e8400-e29b-41d4-a716-446655440000
        Authorization: Bearer <token>

        Response: 204 No Content
        ```
    """
    from backend.app.services.audit_service import get_audit_service

    repo = PlanRepository(conn)

    success = repo.delete(plan_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found"
        )

    # Log deletion in audit trail
    audit_service = get_audit_service(conn)
    audit_service.log_delete(entity_type="plan", entity_id=plan_id, user="test-user")


