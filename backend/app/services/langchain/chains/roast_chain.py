"""Roast mode chain - Fast, witty personality analysis"""

from typing import Dict, Any
import json
import logging
from langchain_openai import ChatOpenAI
from supabase import Client

from app.config import settings
from app.services.langchain.chains.base_chain import QuirkBaseChain
from app.services.langchain.prompts.roast_prompts import get_roast_prompt

logger = logging.getLogger(__name__)


class RoastChain(QuirkBaseChain):
    """Fast, witty personality analysis chain"""

    def __init__(self, db_client: Client):
        super().__init__(db_client)
        self.llm = ChatOpenAI(
            model=settings.openai_model,
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
            api_key=settings.openai_api_key
        )
        self.prompt = get_roast_prompt()

    async def generate_roast(self, user_uuid: str) -> Dict[str, Any]:
        """
        Generate creative roast using metrics + daily insights
        Returns: Dict with roast and vibe
        """
        try:
            # Fetch metrics and insights in PARALLEL for speed
            import asyncio
            metrics, daily_insights = await asyncio.gather(
                self._get_metrics(user_uuid),
                self._get_daily_insights(user_uuid)
            )

            # 3. Build prompt with ALL available data
            top_sites_str = ", ".join([s["site"] for s in metrics["top_sites"][:3]]) if metrics["top_sites"] else "none"

            category_str = ", ".join([
                f"{cat}: {data['percent']}%"
                for cat, data in metrics.get("categories", {}).items()
            ]) if metrics.get("categories") else "no data"

            prompt_vars = {
                "productivity_score": metrics["overview"]["productivity_score"],
                "top_site": metrics["top_sites"][0]["site"] if metrics["top_sites"] else "unknown",
                "top_site_time": metrics["top_sites"][0]["time"] if metrics["top_sites"] else "0m",
                "total_time": metrics["overview"]["total_time"],
                "category_breakdown": category_str,
                "most_visited_sites": top_sites_str,
                "daily_insights": daily_insights
            }

            # 4. Run LLM chain with ALL data
            chain = self.prompt | self.llm
            result = await chain.ainvoke(prompt_vars)

            # 5. Parse JSON response (new simpler format)
            response_text = result.content.strip()

            # Try to extract JSON if wrapped in markdown
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            parsed_result = json.loads(response_text)

            logger.info(f"Generated creative roast for user {user_uuid}")
            return parsed_result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            logger.error(f"Response was: {result.content if 'result' in locals() else 'N/A'}")
            return self._get_fallback_roast()
        except Exception as e:
            logger.error(f"Error generating roast: {e}", exc_info=True)
            return self._get_fallback_roast()

    async def _get_metrics(self, user_uuid: str) -> Dict[str, Any]:
        """Fetch real metrics from database - FAST"""
        try:
            # Reuse metrics calculation logic
            from app.api.v1.endpoints.metrics import _fetch_and_calculate_metrics
            return _fetch_and_calculate_metrics(user_uuid)
        except Exception as e:
            logger.error(f"Error fetching metrics: {e}")
            return {
                "overview": {"productivity_score": 0, "total_time": "0m"},
                "top_sites": [],
                "categories": {}
            }

    async def _get_daily_insights(self, user_uuid: str) -> str:
        """Get recent daily analysis insights (ALL 7 days)"""
        try:
            from datetime import datetime, timedelta

            # Get last 7 days of analysis
            today = datetime.utcnow().date()
            week_ago = today - timedelta(days=7)

            result = self.db.table("daily_analysis").select(
                "date, productivity_score, analysis_data"
            ).eq("user_uuid", user_uuid).gte(
                "date", week_ago.isoformat()
            ).order("date", desc=True).limit(7).execute()

            if not result.data:
                return "No daily insights available yet"

            # Format insights - USE ALL 7 DAYS (or however many we have)
            insights = []
            for day in result.data:  # ALL days, not just 3
                score = day.get("productivity_score", 0)
                summary = day.get("analysis_data", {}).get("summary", "")
                # Keep summaries concise for token efficiency
                short_summary = summary[:50] + "..." if len(summary) > 50 else summary
                insights.append(f"{day['date']}: {score}% - {short_summary}")

            return " | ".join(insights) if insights else "Getting started"

        except Exception as e:
            logger.error(f"Error fetching daily insights: {e}")
            return "No insights available"

    def _get_fallback_roast(self) -> Dict[str, Any]:
        """Fallback roast if LLM fails"""
        return {
            "roast": "Not enough data to roast you yet. Start browsing and come back!",
            "vibe": "Mystery mode activated 👻"
        }
