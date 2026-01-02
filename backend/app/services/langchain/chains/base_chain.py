"""Base chain class with shared context preparation logic"""

from typing import Dict, Any, List, Optional
from collections import Counter
import logging
from supabase import Client

from app.config import settings

logger = logging.getLogger(__name__)


class QuirkBaseChain:
    """Base class for all Quirk analysis chains with context preparation"""

    def __init__(self, db_client: Client):
        self.db = db_client

    async def prepare_context(
        self,
        user_uuid: str,
        include_browsing: bool = True,
        limit: int = 500
    ) -> Dict[str, Any]:
        """
        Retrieve and prepare user context from database
        Returns structured context for LLM prompts
        """
        context = {
            "browsing": {},
            "past_analyses": [],
            "keywords": []
        }

        try:
            # Fetch browsing history summary
            if include_browsing:
                context["browsing"] = await self._get_browsing_summary(user_uuid)

            # Get past analyses for consistency
            context["past_analyses"] = await self._get_past_analyses(user_uuid, limit=3)

            # Extract connecting keywords
            context["keywords"] = self.extract_keywords(context)

            logger.info(f"Prepared context for user {user_uuid}: {len(context.get('browsing', {}).get('platform_breakdown', {}))} platforms")

        except Exception as e:
            logger.error(f"Error preparing context: {e}")

        return context

    async def _get_browsing_summary(self, user_uuid: str) -> Dict:
        """Query and aggregate browsing history"""
        try:
            result = self.db.table("browsing_history").select("*").eq(
                "user_uuid", user_uuid
            ).order("last_visit", desc=True).limit(1000).execute()

            if not result.data:
                return {}

            # Aggregate by platform and category
            platform_stats = {}
            category_stats = {}

            for item in result.data:
                platform = item.get("platform", "unknown")
                category = item.get("category", "other")

                # Platform stats
                if platform not in platform_stats:
                    platform_stats[platform] = {
                        "visit_count": 0,
                        "total_time_minutes": 0
                    }

                platform_stats[platform]["visit_count"] += item.get("visit_count", 1)
                platform_stats[platform]["total_time_minutes"] += (item.get("time_spent_seconds", 0) // 60)

                # Category stats
                category_stats[category] = category_stats.get(category, 0) + 1

            # Get top platforms
            top_platforms = sorted(
                platform_stats.items(),
                key=lambda x: x[1]["visit_count"],
                reverse=True
            )[:5]

            return {
                "platform_breakdown": platform_stats,
                "category_breakdown": category_stats,
                "top_platforms": [p[0] for p in top_platforms],
                "total_visits": sum(p[1]["visit_count"] for p in top_platforms)
            }

        except Exception as e:
            logger.error(f"Error fetching browsing summary: {e}")
            return {}

    async def _get_past_analyses(self, user_uuid: str, limit: int = 3) -> List[Dict]:
        """Get past analyses for consistency"""
        try:
            result = self.db.table("analyses").select("*").eq(
                "user_uuid", user_uuid
            ).order("created_at", desc=True).limit(limit).execute()

            return result.data if result.data else []
        except Exception as e:
            logger.error(f"Error fetching past analyses: {e}")
            return []

    def extract_keywords(self, context: Dict[str, Any]) -> List[str]:
        """Extract connecting keywords from user's digital footprint"""
        keywords = []

        # From browsing platforms
        if context.get("browsing", {}).get("top_platforms"):
            keywords.extend(context["browsing"]["top_platforms"][:5])

        # Deduplicate and limit
        return list(set(keywords))[:15]

    def _summarize_browsing(self, browsing: Dict) -> str:
        """Condense browsing history for LLM prompt (token optimization)"""
        if not browsing or not browsing.get("platform_breakdown"):
            return "No browsing data available"

        platforms = browsing.get("platform_breakdown", {})
        summary = []

        for platform, stats in sorted(
            platforms.items(),
            key=lambda x: x[1]["visit_count"],
            reverse=True
        )[:5]:  # Top 5 platforms
            summary.append(
                f"- {platform.title()}: {stats['visit_count']} visits, "
                f"{stats['total_time_minutes']} minutes"
            )

        return "\n".join(summary)

    def _extract_past_pattern(self, past_analyses: List[Dict]) -> str:
        """Extract consistent themes from past analyses"""
        if not past_analyses:
            return "First analysis - no historical pattern"

        # Extract personality names from past analyses
        patterns = []
        for analysis in past_analyses:
            output_data = analysis.get("output_data", {})
            if isinstance(output_data, dict):
                personality_name = output_data.get("personality_name")
                if personality_name:
                    patterns.append(personality_name)

        if patterns:
            return f"Consistent pattern: {', '.join(patterns[:3])}"
        else:
            return "Previous analyses available but no clear pattern"
