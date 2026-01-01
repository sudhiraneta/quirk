"""
OPTIMIZED Metrics API - Fast analytics endpoint
Minimal database queries, heavy caching
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging
from functools import lru_cache

from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter()


# Cache metrics for 5 minutes to reduce DB load
@lru_cache(maxsize=100)
def _cached_metrics_with_tz(user_uuid: str, days: int, timezone: str, cache_key: str):
    """Cached version of metrics calculation with timezone"""
    return _fetch_and_calculate_metrics(user_uuid, days, timezone)


@router.get("/{user_uuid}")
async def get_metrics(
    user_uuid: str,
    days: int = None,  # Optional: 1 (today), 3 (returning users), 7 (full history)
    timezone: str = "UTC"  # User's timezone (e.g., "America/New_York", "Asia/Kolkata")
) -> Dict[str, Any]:
    """
    FAST metrics endpoint with timezone support

    Free tier logic:
    - New users: Show today only (days=1)
    - Returning users: Show last 3 days by default
    - If requested: Show full 7 days
    - Data older than 7 days is auto-deleted

    Query params:
    - days: 1 (today), 3 (default), 7 (full week)
    - timezone: IANA timezone (e.g., "America/Los_Angeles")
    """
    try:
        import time as time_mod

        # Determine days to show
        if days is None:
            # Check if new vs returning user
            days = await _get_default_days(user_uuid)

        # Cache per user + days + timezone + 5min window
        cache_key = f"{user_uuid}_{days}_{timezone}_{int(time_mod.time() // 300)}"

        metrics = _cached_metrics_with_tz(user_uuid, days, timezone, cache_key)
        return metrics

    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        return _empty_metrics()


async def _get_default_days(user_uuid: str) -> int:
    """
    Smart default: 1 for new users, 3 for returning users
    New user = no data older than 1 day
    """
    try:
        db = get_supabase_client()

        # Check oldest browsing data
        result = db.table("browsing_history").select("last_visit").eq(
            "user_uuid", user_uuid
        ).order("last_visit", desc=False).limit(1).execute()

        if not result.data:
            return 1  # Brand new user - today only

        from datetime import datetime, timedelta
        oldest = datetime.fromisoformat(result.data[0]["last_visit"])
        days_ago = (datetime.now() - oldest).days

        if days_ago < 1:
            return 1  # New user - show today
        else:
            return 3  # Returning user - show last 3 days

    except Exception:
        return 3  # Default to 3 days


def _fetch_and_calculate_metrics(user_uuid: str, days: int = 3, timezone: str = "UTC") -> Dict[str, Any]:
    """Fast metrics calculation with timezone support"""
    try:
        from datetime import datetime, timedelta
        from zoneinfo import ZoneInfo
        db = get_supabase_client()

        # Get current time in user's timezone
        try:
            user_tz = ZoneInfo(timezone)
        except Exception:
            user_tz = ZoneInfo("UTC")  # Fallback to UTC

        now_local = datetime.now(user_tz)

        # Calculate cutoff date (beginning of day N days ago in user's timezone)
        cutoff_local = (now_local - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
        cutoff = cutoff_local.isoformat()

        # OPTIMIZED: Get records from last N days, limit 100
        result = db.table("browsing_history").select(
            "url, platform, category, visit_count, time_spent_seconds, last_visit"
        ).eq("user_uuid", user_uuid).gte(
            "last_visit", cutoff
        ).order("last_visit", desc=True).limit(100).execute()

        if not result.data or len(result.data) == 0:
            return _empty_metrics()

        # FAST aggregation
        sites = {}
        categories = {"productive": 0, "entertainment": 0, "shopping": 0, "other": 0}
        total_time = 0
        total_visits = 0

        for item in result.data:
            platform = item.get("platform", "unknown")
            visits = item.get("visit_count", 1)
            time_ms = item.get("time_spent_seconds", 0) * 1000

            total_visits += visits
            total_time += time_ms

            # Aggregate by platform
            if platform not in sites:
                sites[platform] = {"visits": 0, "time": 0, "cat": _quick_categorize(platform)}

            sites[platform]["visits"] += visits
            sites[platform]["time"] += time_ms

            # Category totals
            cat = sites[platform]["cat"]
            categories[cat] = categories.get(cat, 0) + time_ms

        # Top 5 sites only (FAST)
        top_sites = sorted(sites.items(), key=lambda x: x[1]["time"], reverse=True)[:5]

        # Calculate productivity score
        prod_score = int((categories.get("productive", 0) / total_time * 100)) if total_time > 0 else 0

        return {
            "overview": {
                "total_sites": len(sites),
                "total_visits": total_visits,
                "total_time": _fmt(total_time),
                "productivity_score": prod_score
            },
            "top_sites": [
                {
                    "site": site,
                    "time": _fmt(data["time"]),
                    "visits": data["visits"],
                    "category": data["cat"]
                }
                for site, data in top_sites
            ],
            "categories": {
                cat: {
                    "time": _fmt(time_val),
                    "percent": int((time_val / total_time * 100)) if total_time > 0 else 0
                }
                for cat, time_val in categories.items()
                if time_val > 0
            },
            "insights": _quick_insights(prod_score, top_sites[0][0] if top_sites else "")
        }

    except Exception as e:
        logger.error(f"Metrics calc error: {e}")
        return _empty_metrics()


def _quick_categorize(platform: str) -> str:
    """Ultra-fast categorization"""
    p = platform.lower()

    if any(x in p for x in ['github', 'stack', 'code', 'dev']):
        return 'productive'
    if any(x in p for x in ['youtube', 'netflix', 'instagram', 'twitter', 'tiktok']):
        return 'entertainment'
    if any(x in p for x in ['amazon', 'shop', 'ebay']):
        return 'shopping'

    return 'other'


def _fmt(ms: int) -> str:
    """Fast time formatter"""
    m = ms // 60000
    h = m // 60
    return f"{h}h {m%60}m" if h > 0 else f"{m}m"


def _quick_insights(score: int, top_site: str) -> list:
    """Generate 2-3 quick insights"""
    insights = []

    if score > 60:
        insights.append(f"💻 {score}% productive - crushing it!")
    elif score > 30:
        insights.append(f"⚖️ {score}% productive - balanced")
    else:
        insights.append(f"🎮 {score}% productive - chill mode")

    if top_site:
        insights.append(f"📍 Top site: {top_site}")

    return insights


def _empty_metrics():
    """Empty state"""
    return {
        "overview": {"total_sites": 0, "total_visits": 0, "total_time": "0m", "productivity_score": 0},
        "top_sites": [],
        "categories": {},
        "insights": ["📊 No data yet - start browsing!"]
    }
