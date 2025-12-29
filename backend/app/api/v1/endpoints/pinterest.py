"""Pinterest data endpoints"""

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from datetime import datetime
import logging

from app.models.schemas import PinterestPinsRequest, DataSaveResponse
from app.db.supabase_client import get_supabase
from supabase import Client

logger = logging.getLogger(__name__)
router = APIRouter()


async def generate_pinterest_embeddings_async(user_uuid: str, pin_ids: list):
    """Background task to generate embeddings for Pinterest pins"""
    # TODO: Implement embedding generation
    logger.info(f"Generating embeddings for {len(pin_ids)} Pinterest pins (user: {user_uuid})")
    pass


@router.post("/pins", response_model=DataSaveResponse)
async def save_pinterest_pins(
    request: PinterestPinsRequest,
    background_tasks: BackgroundTasks,
    db: Client = Depends(get_supabase)
):
    """
    Save Pinterest pins (WRITE-OPTIMIZED)
    - Fast batch insert
    - Queue embedding generation in background
    - Return immediately
    """
    try:
        # Prepare data for batch insert
        pins_data = []
        for pin in request.pins:
            # Combine all text for full_text field
            full_text = f"{pin.title or ''} {pin.description or ''} {pin.alt_text or ''} {pin.category or ''}".strip()

            pins_data.append({
                "user_uuid": request.user_uuid,
                "title": pin.title,
                "description": pin.description,
                "alt_text": pin.alt_text,
                "board_name": pin.board_name,
                "category": pin.category,
                "full_text": full_text,
                "collected_at": datetime.utcnow().isoformat()
            })

        # Batch insert
        result = db.table("pinterest_pins").insert(pins_data).execute()

        inserted_count = len(result.data) if result.data else 0
        inserted_ids = [item["id"] for item in result.data] if result.data else []

        # Update user's total data points
        db.rpc("increment_user_data_points", {
            "user_id": request.user_uuid,
            "increment_by": inserted_count
        }).execute()

        # Queue embedding generation in background
        if inserted_ids:
            background_tasks.add_task(generate_pinterest_embeddings_async, request.user_uuid, inserted_ids)

        logger.info(f"Saved {inserted_count} Pinterest pins for user {request.user_uuid}")

        return DataSaveResponse(
            status="success",
            processed_count=inserted_count,
            message=f"Queued {inserted_count} pins for embedding generation"
        )

    except Exception as e:
        logger.error(f"Error saving Pinterest pins: {e}")
        raise HTTPException(status_code=500, detail=str(e))
