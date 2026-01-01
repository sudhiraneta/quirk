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
    """ULTRA-FAST metrics with minimal processing"""
    try:
        from datetime import datetime, timedelta
        from zoneinfo import ZoneInfo
        db = get_supabase_client()

        # Calculate cutoff
        try:
            user_tz = ZoneInfo(timezone)
        except Exception:
            user_tz = ZoneInfo("UTC")

        now_local = datetime.now(user_tz)
        cutoff_local = (now_local - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
        cutoff = cutoff_local.isoformat()

        # SINGLE OPTIMIZED QUERY - limit to 50 for speed
        result = db.table("browsing_history").select(
            "platform, visit_count, time_spent_seconds"
        ).eq("user_uuid", user_uuid).gte(
            "last_visit", cutoff
        ).limit(50).execute()

        if not result.data:
            return _empty_metrics()

        # FAST aggregation (no sorting, minimal loops)
        sites = {}
        cats = {"productive": 0, "entertainment": 0, "shopping": 0, "other": 0}
        total_time = 0
        total_visits = 0

        for item in result.data:
            p = item.get("platform", "unknown")
            v = item.get("visit_count", 1)
            t = item.get("time_spent_seconds", 0) * 1000

            total_visits += v
            total_time += t

            if p not in sites:
                sites[p] = {"v": 0, "t": 0, "c": _quick_categorize(p)}

            sites[p]["v"] += v
            sites[p]["t"] += t
            cats[sites[p]["c"]] = cats.get(sites[p]["c"], 0) + t

        # Top 3 sites only
        top = sorted(sites.items(), key=lambda x: x[1]["t"], reverse=True)[:3]

        prod_score = int((cats.get("productive", 0) / total_time * 100)) if total_time > 0 else 0

        return {
            "overview": {
                "total_sites": len(sites),
                "total_visits": total_visits,
                "total_time": _fmt(total_time),
                "productivity_score": prod_score
            },
            "top_sites": [{"site": s, "time": _fmt(d["t"]), "visits": d["v"], "category": d["c"]} for s, d in top],
            "categories": {c: {"time": _fmt(tv), "percent": int((tv / total_time * 100)) if total_time > 0 else 0} for c, tv in cats.items() if tv > 0},
            "insights": _quick_insights(prod_score, top[0][0] if top else "")
        }

    except Exception as e:
        logger.error(f"Metrics error: {e}")
        return _empty_metrics()


def _quick_categorize(platform: str) -> str:
    """
    Ultra-fast categorization

    IMPORTANT: Gmail, LinkedIn, browsing = NOT productive
    Only actual coding/docs work counts as productive
    """
    p = platform.lower()

    # Productive = ONLY actual work (coding, docs, tools)
    if any(x in p for x in ['github', 'stackoverflow', 'vscode', 'gitlab', 'replit', 'codesandbox']):
        return 'productive'

    # Docs/Tools = productive IF actively working
    if any(x in p for x in ['notion', 'docs.google', 'sheets.google', 'trello', 'asana', 'figma']):
        return 'productive'

    # Entertainment (time-wasting)
    if any(x in p for x in ['youtube', 'netflix', 'instagram', 'twitter', 'tiktok', 'facebook', 'reddit']):
        return 'entertainment'

    # Shopping
    if any(x in p for x in ['amazon', 'shop', 'ebay', 'walmart']):
        return 'shopping'

    # Gmail, LinkedIn, browsing = OTHER (not productive!)
    # Just loading/scrolling doesn't count as work
    if any(x in p for x in ['gmail', 'mail', 'linkedin', 'outlook', 'calendar']):
        return 'other'

    return 'other'


def _fmt(ms: int) -> str:
    """Fast time formatter"""
    m = ms // 60000
    h = m // 60
    return f"{h}h {m%60}m" if h > 0 else f"{m}m"


def _quick_insights(score: int, top_site: str) -> list:
    """Generate 2-3 quick insights with FLAGS for excessive usage"""
    insights = []

    # Productivity insight with flags
    if score > 60:
        insights.append(f"💻 {score}% productive - crushing it!")
    elif score > 30:
        insights.append(f"⚖️ {score}% productive - balanced")
    else:
        insights.append(f"🚩 {score}% productive - mostly time-wasting!")

    # Flag excessive usage of specific sites
    if top_site:
        site_lower = top_site.lower()

        # Flag AI overreliance
        if any(x in site_lower for x in ['chatgpt', 'claude', 'openai', 'bard']):
            insights.append(f"🚩 Top site: {top_site} - AI dependency detected")

        # Flag social media addiction
        elif any(x in site_lower for x in ['instagram', 'twitter', 'tiktok', 'facebook']):
            insights.append(f"🚩 Top site: {top_site} - social media addict")

        # Flag video addiction
        elif any(x in site_lower for x in ['youtube', 'netflix', 'twitch']):
            insights.append(f"🚩 Top site: {top_site} - video binge mode")

        # Flag LinkedIn scrolling
        elif 'linkedin' in site_lower:
            insights.append(f"🚩 Top site: {top_site} - fake networking alert")

        # Flag email obsession
        elif any(x in site_lower for x in ['gmail', 'mail', 'outlook']):
            insights.append(f"🚩 Top site: {top_site} - inbox checking addiction")

        else:
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
