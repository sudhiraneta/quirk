"""Browsing history endpoints"""

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from datetime import datetime
import logging

from app.models.schemas import BrowsingHistoryRequest, DataSaveResponse
from app.db.supabase_client import get_supabase
from supabase import Client

logger = logging.getLogger(__name__)
router = APIRouter()


async def generate_embeddings_async(user_uuid: str, item_ids: list):
    """Background task to generate embeddings for browsing history"""
    # TODO: Implement embedding generation
    logger.info(f"Generating embeddings for {len(item_ids)} browsing items (user: {user_uuid})")
    pass


@router.post("/history", response_model=DataSaveResponse)
async def save_browsing_history(
    request: BrowsingHistoryRequest,
    background_tasks: BackgroundTasks,
    db: Client = Depends(get_supabase)
):
    """
    Save browsing history data (WRITE-OPTIMIZED)
    - Fast batch insert
    - Queue embedding generation in background
    - Return immediately
    """
    try:
        # Prepare data for batch insert
        browsing_data = []
        for item in request.history:
            browsing_data.append({
                "user_uuid": request.user_uuid,
                "url": item.url,
                "title": item.title,
                "visit_count": item.visit_count,
                "last_visit": item.last_visit.isoformat(),
                "time_spent_seconds": item.time_spent_seconds,
                "category": item.category.value,
                "platform": item.platform,
                "metadata": item.metadata,
                "created_at": datetime.utcnow().isoformat()
            })

        # Batch insert
        result = db.table("browsing_history").insert(browsing_data).execute()

        inserted_count = len(result.data) if result.data else 0
        inserted_ids = [item["id"] for item in result.data] if result.data else []

        # Update user's total data points
        db.rpc("increment_user_data_points", {
            "user_id": request.user_uuid,
            "increment_by": inserted_count
        }).execute()

        # Queue embedding generation in background (don't wait)
        if inserted_ids:
            background_tasks.add_task(generate_embeddings_async, request.user_uuid, inserted_ids)

        logger.info(f"Saved {inserted_count} browsing history items for user {request.user_uuid}")

        return DataSaveResponse(
            status="success",
            processed_count=inserted_count,
            message=f"Queued {inserted_count} items for embedding generation"
        )

    except Exception as e:
        logger.error(f"Error saving browsing history: {e}")
        raise HTTPException(status_code=500, detail=str(e))
