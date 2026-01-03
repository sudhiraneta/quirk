"""Analysis endpoints (roast and self-discovery modes)"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from datetime import datetime
import uuid
import logging

from app.models.schemas import (
    RoastAnalysisRequest, RoastAnalysisResponse,
    SelfDiscoveryRequest, SelfDiscoveryResponse,
    PersonalityBreakdown, DataSummary, Insight, Trends
)
from app.models.enums import AnalysisMode
from app.db.supabase_client import get_supabase
from app.core.cache import redis_cache
from app.services.langchain.chains.roast_chain import RoastChain
from app.services.langchain.chains.self_discovery_chain import SelfDiscoveryChain
from app.config import settings
from supabase import Client

logger = logging.getLogger(__name__)
router = APIRouter()


async def save_analysis_to_db(user_uuid: str, mode: str, output_data: dict, analysis_id: str, db: Client):
    """Background task to save analysis to database"""
    try:
        db.table("analyses").insert({
            "id": analysis_id,
            "user_uuid": user_uuid,
            "mode": mode,
            "output_data": output_data,
            "llm_model": settings.openai_model,
            "created_at": datetime.utcnow().isoformat()
        }).execute()

        # Increment user's analysis count
        db.rpc("increment_user_analyses", {"user_id": user_uuid}).execute()

        logger.info(f"Saved {mode} analysis to database: {analysis_id}")
    except Exception as e:
        logger.error(f"Error saving analysis to database: {e}")


@router.post("/roast/{user_uuid}")
async def generate_roast(
    user_uuid: str,
    background_tasks: BackgroundTasks,
    db: Client = Depends(get_supabase)
):
    """
    Generate witty roast analysis (READ-OPTIMIZED)
    - Check cache first
    - Retrieve pre-computed data
    - Generate LLM response via RoastChain
    - Cache result
    """
    try:
        # Check Redis cache
        cache_key = f"roast:{user_uuid}"
        cached = await redis_cache.get(cache_key)
        if cached:
            logger.info(f"Returning cached roast for user {user_uuid}")
            return RoastAnalysisResponse(**cached)

        # Initialize roast chain
        roast_chain = RoastChain(db)

        # Generate roast using LangChain
        roast_result = await roast_chain.generate_roast(user_uuid)

        # Get data summary
        context = await roast_chain.prepare_context(user_uuid)
        data_summary = DataSummary(
            pinterest_pins_analyzed=len(context.get("pinterest", [])),
            browsing_days_analyzed=settings.browsing_history_days,
            top_platforms=context.get("browsing", {}).get("top_platforms", []),
            total_data_points=len(context.get("pinterest", [])) + len(context.get("browsing", {}).get("platform_breakdown", {}))
        )

        # Build simplified response
        response = {
            "roast": roast_result["roast"],
            "vibe": roast_result.get("vibe", "No vibe detected"),
            "data_summary": {
                "browsing_days_analyzed": settings.browsing_history_days,
                "total_data_points": len(context.get("browsing", {}).get("top_sites", []))
            }
        }

        # Cache the response (1 hour TTL)
        await redis_cache.set(cache_key, response, expire=settings.redis_ttl_roast)

        logger.info(f"Generated roast for user {user_uuid}")
        return response

    except Exception as e:
        logger.error(f"Error generating roast: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Self-discovery mode removed - only roast mode is supported


# NEW: Today's analysis endpoint
from datetime import date as date_class

@router.get("/today/{user_uuid}")
async def get_today_analysis(
    user_uuid: str,
    db: Client = Depends(get_supabase)
):
    """
    Get today's LLM analysis from database
    Falls back to yesterday's data if today just started (< 5 sites)
    Returns analysis if ready, or status if still processing
    """
    try:
        # Use UTC date to match what's saved in the database
        from datetime import datetime, timedelta
        today = datetime.utcnow().date().isoformat()

        # Check if analysis exists for today
        result = db.table("daily_analysis").select("*").eq(
            "user_uuid", user_uuid
        ).eq("date", today).execute()

        # If no analysis for today, check if we should use yesterday's data
        if not result.data or len(result.data) == 0:
            from concurrent.futures import ThreadPoolExecutor

            # Fetch today's browsing data AND yesterday's analysis in PARALLEL
            yesterday = (datetime.utcnow().date() - timedelta(days=1)).isoformat()

            def get_today_browsing():
                return db.table("daily_browsing").select("raw_data").eq(
                    "user_uuid", user_uuid
                ).eq("date", today).execute()

            def get_yesterday_analysis():
                return db.table("daily_analysis").select("*").eq(
                    "user_uuid", user_uuid
                ).eq("date", yesterday).execute()

            with ThreadPoolExecutor(max_workers=2) as executor:
                browsing_future = executor.submit(get_today_browsing)
                yesterday_future = executor.submit(get_yesterday_analysis)

                browsing_result = browsing_future.result()
                yesterday_result = yesterday_future.result()

            # If no browsing data OR very few sites (early in the day), use yesterday
            if not browsing_result.data or len(browsing_result.data[0].get("raw_data", [])) < 5:
                logger.info(f"Early day detected for {user_uuid}, falling back to yesterday: {yesterday}")

                if yesterday_result.data and len(yesterday_result.data) > 0:
                    analysis = yesterday_result.data[0]
                    if analysis["processing_status"] == "completed":
                        return {
                            "status": "completed",
                            "date": analysis["date"],
                            "productivity_score": analysis.get("productivity_score"),
                            "early_day_fallback": True,
                            "message": "You just started your day! Here's yesterday's data:",
                            **analysis["analysis_data"]
                        }

            raise HTTPException(
                status_code=404,
                detail="No analysis found. Please view analytics to trigger analysis."
            )

        analysis = result.data[0]

        # Check processing status
        if analysis["processing_status"] == "pending":
            return {
                "status": "pending",
                "message": "Analysis queued. Check back in a few seconds."
            }

        if analysis["processing_status"] == "processing":
            return {
                "status": "processing",
                "message": "AI is analyzing your data. Almost done!"
            }

        if analysis["processing_status"] == "failed":
            raise HTTPException(
                status_code=500,
                detail="Analysis failed. Please try again."
            )

        # Return completed analysis
        return {
            "status": "completed",
            "date": analysis["date"],
            "productivity_score": analysis.get("productivity_score"),
            **analysis["analysis_data"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting today's analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
