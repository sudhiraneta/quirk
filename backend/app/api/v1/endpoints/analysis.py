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


@router.post("/roast/{user_uuid}", response_model=RoastAnalysisResponse)
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

        # Build response
        analysis_id = str(uuid.uuid4())
        breakdown = [
            PersonalityBreakdown(trait=item["trait"], percentage=item["percentage"])
            for item in roast_result["breakdown"]
        ]

        response = RoastAnalysisResponse(
            mode=AnalysisMode.ROAST,
            personality_name=roast_result["personality_name"],
            roast=roast_result["roast"],
            vibe_check=roast_result["vibe_check"],
            breakdown=breakdown,
            data_summary=data_summary,
            analysis_id=analysis_id,
            created_at=datetime.utcnow()
        )

        # Cache the response (1 hour TTL)
        await redis_cache.set(cache_key, response.dict(), expire=settings.redis_ttl_roast)

        # Save analysis to database (background task)
        background_tasks.add_task(
            save_analysis_to_db,
            user_uuid,
            AnalysisMode.ROAST.value,
            roast_result,
            analysis_id,
            db
        )

        logger.info(f"Generated roast analysis for user {user_uuid}")
        return response

    except Exception as e:
        logger.error(f"Error generating roast: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/self-discovery/{user_uuid}", response_model=SelfDiscoveryResponse)
async def generate_self_discovery(
    user_uuid: str,
    background_tasks: BackgroundTasks,
    db: Client = Depends(get_supabase)
):
    """
    Generate deep self-discovery analysis (READ-OPTIMIZED)
    - Multi-step LangChain analysis
    - Deeper insights than roast mode
    """
    try:
        # Check cache (shorter TTL for self-discovery)
        cache_key = f"self_discovery:{user_uuid}"
        cached = await redis_cache.get(cache_key)
        if cached:
            logger.info(f"Returning cached self-discovery for user {user_uuid}")
            return SelfDiscoveryResponse(**cached)

        # Initialize self-discovery chain
        discovery_chain = SelfDiscoveryChain(db)

        # Generate analysis using LangChain
        analysis_result = await discovery_chain.generate_analysis(
            user_uuid,
            focus_areas=[]  # No focus areas for now
        )

        # Get data summary
        context = await discovery_chain.prepare_context(user_uuid, limit=1000)
        data_summary = DataSummary(
            pinterest_pins_analyzed=len(context.get("pinterest", [])),
            browsing_days_analyzed=settings.browsing_history_days,
            top_platforms=context.get("browsing", {}).get("top_platforms", []),
            total_data_points=len(context.get("pinterest", [])) + len(context.get("browsing", {}).get("platform_breakdown", {}))
        )

        # Build response
        analysis_id = str(uuid.uuid4())
        insights = [
            Insight(**insight) for insight in analysis_result.get("insights", [])
        ]
        trends = Trends(**analysis_result.get("trends", {}))

        response = SelfDiscoveryResponse(
            mode=AnalysisMode.SELF_DISCOVERY,
            insights=insights,
            trends=trends,
            action_items=analysis_result.get("action_items", []),
            data_summary=data_summary,
            analysis_id=analysis_id,
            created_at=datetime.utcnow()
        )

        # Cache the response (10 min TTL)
        await redis_cache.set(cache_key, response.dict(), expire=settings.redis_ttl_discovery)

        # Save analysis to database (background task)
        background_tasks.add_task(
            save_analysis_to_db,
            user_uuid,
            AnalysisMode.SELF_DISCOVERY.value,
            analysis_result,
            analysis_id,
            db
        )

        logger.info(f"Generated self-discovery analysis for user {user_uuid}")
        return response

    except Exception as e:
        logger.error(f"Error generating self-discovery: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# NEW: Today's analysis endpoint
from datetime import date as date_class

@router.get("/today/{user_uuid}")
async def get_today_analysis(
    user_uuid: str,
    db: Client = Depends(get_supabase)
):
    """
    Get today's LLM analysis from database
    Returns analysis if ready, or status if still processing
    """
    try:
        today = date_class.today().isoformat()

        # Check if analysis exists
        result = db.table("daily_analysis").select("*").eq(
            "user_uuid", user_uuid
        ).eq("date", today).execute()

        if not result.data or len(result.data) == 0:
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
