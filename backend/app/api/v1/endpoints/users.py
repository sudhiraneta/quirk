"""User management endpoints"""

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
import uuid
import logging

from app.models.schemas import UserInitRequest, UserInitResponse, UserStatsResponse
from app.db.supabase_client import get_supabase
from supabase import Client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/initialize", response_model=UserInitResponse)
async def initialize_user(
    request: UserInitRequest,
    db: Client = Depends(get_supabase)
):
    """Initialize a new user with anonymous UUID"""
    try:
        # Generate UUID
        user_uuid = str(uuid.uuid4())

        # Insert into users table
        user_data = {
            "id": user_uuid,
            "extension_version": request.extension_version,
            "created_at": datetime.utcnow().isoformat(),
            "last_active": datetime.utcnow().isoformat(),
            "total_data_points": 0,
            "total_analyses": 0
        }

        result = db.table("users").insert(user_data).execute()

        logger.info(f"New user initialized: {user_uuid}")

        return UserInitResponse(
            user_uuid=user_uuid,
            created_at=datetime.utcnow()
        )

    except Exception as e:
        logger.error(f"Error initializing user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_uuid}/status", response_model=UserStatsResponse)
async def get_user_status(
    user_uuid: str,
    db: Client = Depends(get_supabase)
):
    """Get user statistics and status"""
    try:
        # Get user data
        result = db.table("users").select("*").eq("id", user_uuid).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="User not found")

        user = result.data[0]

        # Get conversation count
        conv_result = db.table("conversations").select("id", count="exact").eq("user_uuid", user_uuid).execute()
        conversations_count = conv_result.count if conv_result.count else 0

        return UserStatsResponse(
            user_uuid=user_uuid,
            data_points_collected=user.get("total_data_points", 0),
            analyses_count=user.get("total_analyses", 0),
            conversations_count=conversations_count,
            created_at=datetime.fromisoformat(user["created_at"]),
            last_active=datetime.fromisoformat(user["last_active"])
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
