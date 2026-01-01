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
        Main entry point for roast generation using REAL METRICS
        Returns: Dict with personality_name, roast, vibe_check, breakdown
        """
        try:
            # 1. Get REAL metrics from metrics table
            metrics = await self._get_metrics(user_uuid)

            # 2. Build prompt with REAL data
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
                "most_visited_sites": top_sites_str
            }

            # 3. Run LLM chain with METRICS
            chain = self.prompt | self.llm
            result = await chain.ainvoke(prompt_vars)

            # 5. Parse JSON response
            response_text = result.content.strip()

            # Try to extract JSON if wrapped in markdown
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            parsed_result = json.loads(response_text)

            # Validate percentages sum to 100
            total_percentage = sum(item["percentage"] for item in parsed_result["breakdown"])
            if total_percentage != 100:
                logger.warning(f"Percentages sum to {total_percentage}, adjusting...")
                # Adjust the first item to make it sum to 100
                if parsed_result["breakdown"]:
                    diff = 100 - total_percentage
                    parsed_result["breakdown"][0]["percentage"] += diff

            logger.info(f"Generated roast for user {user_uuid}")
            return parsed_result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            logger.error(f"Response was: {result.content if 'result' in locals() else 'N/A'}")
            # Return fallback response
            return self._get_fallback_roast()
        except Exception as e:
            logger.error(f"Error generating roast: {e}")
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

    def _get_fallback_roast(self) -> Dict[str, Any]:
        """Fallback roast if LLM fails"""
        return {
            "personality_name": "Digital Ghost",
            "roast": "Not enough data to roast you yet",
            "vibe_check": "Mystery mode activated",
            "breakdown": [
                {"trait": "Unknown", "percentage": 100}
            ]
        }
