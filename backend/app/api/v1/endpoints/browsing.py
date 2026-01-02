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


# New simplified endpoint for TODAY's browsing data
from pydantic import BaseModel
from typing import List

class BrowsingItemToday(BaseModel):
    url: str
    title: str
    hostname: str
    visit_count: int
    last_visit_time: str

class TodayBrowsingRequest(BaseModel):
    user_uuid: str
    raw_data: List[BrowsingItemToday]
    date: str

@router.post("/today")
async def save_today_browsing(
    request: TodayBrowsingRequest,
    background_tasks: BackgroundTasks,
    db: Client = Depends(get_supabase)
):
    """
    Save TODAY's raw browsing data
    - Saves to database immediately
    - Queues LLM analysis in background
    - Returns confirmation instantly
    """
    try:
        # 1. Save raw data to daily_browsing table
        browsing_entry = {
            "user_uuid": request.user_uuid,
            "date": request.date,
            "raw_data": [item.dict() for item in request.raw_data],
            "created_at": datetime.utcnow().isoformat()
        }

        # Upsert (update if exists for this date)
        result = db.table("daily_browsing").upsert(browsing_entry, on_conflict="user_uuid,date").execute()

        logger.info(f"✅ Saved {len(request.raw_data)} items for {request.user_uuid} on {request.date}")

        # 2. Create analysis placeholder with status 'pending'
        analysis_entry = {
            "user_uuid": request.user_uuid,
            "date": request.date,
            "processing_status": "pending",
            "analysis_data": {},
            "created_at": datetime.utcnow().isoformat()
        }

        db.table("daily_analysis").upsert(analysis_entry, on_conflict="user_uuid,date").execute()

        # 3. Queue LLM analysis (background task)
        # TODO: Implement LLM analysis background task
        # background_tasks.add_task(process_llm_analysis, request.user_uuid, request.date, db)

        return {
            "success": True,
            "message": f"Data saved. Analysis queued for {request.date}",
            "date": request.date,
            "items_count": len(request.raw_data)
        }

    except Exception as e:
        logger.error(f"Error saving today's browsing: {e}")
        raise HTTPException(status_code=500, detail=str(e))
