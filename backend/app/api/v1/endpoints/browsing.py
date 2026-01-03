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
        try:
            browsing_result = db.table("daily_browsing").select("raw_data").eq(
                "user_uuid", user_uuid
            ).eq("date", date).execute()
        except Exception as db_error:
            logger.error(f"❌ Database error fetching browsing data: {db_error}", exc_info=True)
            raise

        if not browsing_result.data or len(browsing_result.data) == 0:
            logger.error(f"❌ No browsing data found for {user_uuid} on {date}")
            return

        raw_data = browsing_result.data[0].get("raw_data", [])
        if not raw_data:
            logger.error(f"❌ Empty raw_data for {user_uuid} on {date}")
            return

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

        # 3. Call LLM with optimized settings for speed
        try:
            llm = ChatOpenAI(
                model="gpt-4o-mini",  # Fast, cheap
                temperature=0.7,
                max_tokens=settings.llm_max_tokens_analysis,
                api_key=settings.openai_api_key
            )

            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ]

            logger.info("🔄 Calling OpenAI API...")
            result = await llm.ainvoke(messages)
            response_text = result.content.strip()
            logger.info(f"📥 Received LLM response: {response_text[:200]}...")

        except Exception as llm_error:
            logger.error(f"❌ OpenAI API error: {llm_error}", exc_info=True)
            raise

        # Parse JSON (handle markdown wrapping)
        try:
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            analysis_data = json.loads(response_text)
            logger.info(f"✅ LLM analysis complete: score={analysis_data.get('productivity_score')}")
        except json.JSONDecodeError as json_error:
            logger.error(f"❌ Failed to parse LLM response as JSON: {json_error}")
            logger.error(f"❌ Response text: {response_text}")
            raise

        # 4. Save results
        try:
            db.table("daily_analysis").update({
                "productivity_score": analysis_data.get("productivity_score"),
                "analysis_data": analysis_data,
                "processing_status": "completed",
                "llm_model": "gpt-4o-mini",
                "updated_at": datetime.utcnow().isoformat()
            }).eq("user_uuid", user_uuid).eq("date", date).execute()

            logger.info(f"✅ Analysis saved for {user_uuid} on {date}")
        except Exception as db_error:
            logger.error(f"❌ Database error saving analysis: {db_error}", exc_info=True)
            raise

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


# Simplified endpoint for TODAY's browsing data (ONLY endpoint in use)
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
        logger.info(f"📊 Received browsing data for {request.user_uuid} on {request.date}: {len(request.raw_data)} items")

        # 1. Save raw data to daily_browsing table
        browsing_entry = {
            "user_uuid": request.user_uuid,
            "date": request.date,
            "raw_data": [item.dict() for item in request.raw_data],
            "created_at": datetime.utcnow().isoformat()
        }

        # Upsert browsing data AND create analysis placeholder in PARALLEL
        try:
            from concurrent.futures import ThreadPoolExecutor
            import asyncio

            # Define the database operations
            def save_browsing():
                return db.table("daily_browsing").upsert(browsing_entry, on_conflict="user_uuid,date").execute()

            def create_placeholder():
                analysis_entry = {
                    "user_uuid": request.user_uuid,
                    "date": request.date,
                    "processing_status": "pending",
                    "analysis_data": {},
                    "created_at": datetime.utcnow().isoformat()
                }
                return db.table("daily_analysis").upsert(analysis_entry, on_conflict="user_uuid,date").execute()

            # Execute in parallel using thread pool
            with ThreadPoolExecutor(max_workers=2) as executor:
                browsing_future = executor.submit(save_browsing)
                analysis_future = executor.submit(create_placeholder)

                # Wait for both to complete
                browsing_result = browsing_future.result()
                analysis_result = analysis_future.result()

            logger.info(f"✅ Saved {len(request.raw_data)} items to daily_browsing AND created analysis placeholder")
        except Exception as db_error:
            logger.error(f"❌ Database error: {db_error}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Database error: {str(db_error)}")

        # 3. Run LLM analysis IMMEDIATELY (5-10 seconds)
        # Background tasks are unreliable, so we run it synchronously
        try:
            logger.info(f"🚀 Starting immediate LLM analysis for {request.user_uuid}")
            await process_llm_analysis(request.user_uuid, request.date, db)
        except Exception as llm_error:
            logger.error(f"❌ LLM analysis error (non-fatal): {llm_error}", exc_info=True)
            # Don't fail the request - data is saved, analysis can be retried

        return {
            "success": True,
            "message": f"Data saved and analyzed for {request.date}",
            "date": request.date,
            "items_count": len(request.raw_data)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error in save_today_browsing: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


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
