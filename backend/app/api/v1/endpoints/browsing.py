"""Browsing history endpoints"""

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from datetime import datetime
import logging
import json
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from app.models.schemas import BrowsingHistoryRequest, DataSaveResponse
from app.db.supabase_client import get_supabase
from app.config import settings
from supabase import Client

logger = logging.getLogger(__name__)
router = APIRouter()


async def generate_embeddings_async(user_uuid: str, item_ids: list):
    """Background task to generate embeddings for browsing history"""
    # TODO: Implement embedding generation
    logger.info(f"Generating embeddings for {len(item_ids)} browsing items (user: {user_uuid})")
    pass


async def process_llm_analysis(user_uuid: str, date: str, db: Client):
    """
    Background task to analyze TODAY's browsing data with LLM
    - Fetch raw_data from daily_browsing
    - Send to gpt-4o-mini for analysis
    - Save results to daily_analysis
    """
    try:
        logger.info(f"🤖 Starting LLM analysis for {user_uuid} on {date}")

        # 1. Get raw browsing data
        browsing_result = db.table("daily_browsing").select("raw_data").eq(
            "user_uuid", user_uuid
        ).eq("date", date).execute()

        if not browsing_result.data:
            logger.error(f"No browsing data found for {user_uuid} on {date}")
            return

        raw_data = browsing_result.data[0]["raw_data"]
        logger.info(f"📊 Analyzing {len(raw_data)} sites")

        # 2. Prepare prompt for LLM
        system_prompt = """You are a productivity analyzer. Analyze today's browsing data and return JSON.

Focus on:
- Productivity score (0-100, target: 60)
- Top productive sites
- Top distractions
- Motivation message

Return ONLY valid JSON in this format:
{
  "productivity_score": 67,
  "summary": "Brief summary of the day",
  "top_productive": [{"service": "Gmail", "visits": 23}],
  "top_distractions": [{"service": "Instagram", "visits": 89, "warning": true}],
  "motivation": "Encouraging message"
}"""

        # Summarize data for LLM (keep it concise for gpt-4o-mini)
        sites_summary = []
        for site in raw_data[:15]:  # Top 15 sites only
            sites_summary.append({
                "title": site.get("title", "")[:50],
                "hostname": site.get("hostname", ""),
                "visits": site.get("visit_count", 0)
            })

        user_prompt = f"Today's browsing data:\n{json.dumps(sites_summary, indent=2)}\n\nAnalyze and return JSON."

        # 3. Call LLM
        llm = ChatOpenAI(
            model="gpt-4o-mini",  # Fast, cheap
            temperature=0.7,
            api_key=settings.openai_api_key
        )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]

        logger.info("🔄 Calling OpenAI API...")
        result = await llm.ainvoke(messages)
        response_text = result.content.strip()

        # Parse JSON (handle markdown wrapping)
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        analysis_data = json.loads(response_text)
        logger.info(f"✅ LLM analysis complete: score={analysis_data.get('productivity_score')}")

        # 4. Save results
        db.table("daily_analysis").update({
            "productivity_score": analysis_data.get("productivity_score"),
            "analysis_data": analysis_data,
            "processing_status": "completed",
            "llm_model": "gpt-4o-mini",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("user_uuid", user_uuid).eq("date", date).execute()

        logger.info(f"✅ Analysis saved for {user_uuid} on {date}")

    except Exception as e:
        logger.error(f"❌ Error in LLM analysis: {e}", exc_info=True)
        # Mark as failed
        try:
            db.table("daily_analysis").update({
                "processing_status": "failed",
                "updated_at": datetime.utcnow().isoformat()
            }).eq("user_uuid", user_uuid).eq("date", date).execute()
        except:
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
        background_tasks.add_task(process_llm_analysis, request.user_uuid, request.date, db)
        logger.info(f"✅ Queued LLM analysis task for {request.user_uuid}")

        return {
            "success": True,
            "message": f"Data saved. Analysis queued for {request.date}",
            "date": request.date,
            "items_count": len(request.raw_data)
        }

    except Exception as e:
        logger.error(f"Error saving today's browsing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-now/{user_uuid}")
async def analyze_now(user_uuid: str, db: Client = Depends(get_supabase)):
    """
    TEST ENDPOINT: Manually trigger LLM analysis for today
    Use this to debug LLM issues
    """
    try:
        today = datetime.utcnow().date().isoformat()
        logger.info(f"🔍 Manual analysis requested for {user_uuid} on {today}")

        # Call the LLM analysis directly (not in background)
        await process_llm_analysis(user_uuid, today, db)

        # Get the result
        result = db.table("daily_analysis").select("*").eq(
            "user_uuid", user_uuid
        ).eq("date", today).execute()

        if result.data:
            return {
                "status": "success",
                "message": "Analysis completed",
                "data": result.data[0]
            }
        else:
            return {
                "status": "no_data",
                "message": "No analysis found after processing"
            }

    except Exception as e:
        logger.error(f"Error in manual analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
