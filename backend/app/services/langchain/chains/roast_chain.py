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
        Main entry point for roast generation
        Returns: Dict with personality_name, roast, vibe_check, breakdown
        """
        try:
            # 1. Prepare context (read-optimized)
            context = await self.prepare_context(
                user_uuid,
                include_pinterest=True,
                include_browsing=True,
                limit=500
            )

            # 2. Extract keywords
            keywords = self.extract_keywords(context)

            # 3. Summarize data for prompt (token optimization)
            prompt_vars = {
                "keywords": ", ".join(keywords),
                "pinterest_count": len(context["pinterest"]),
                "pinterest_summary": self._summarize_pinterest(context["pinterest"]),
                "browsing_summary": self._summarize_browsing(context["browsing"]),
                "browsing_days": settings.browsing_history_days,
                "top_platforms": ", ".join(context["browsing"].get("top_platforms", [])),
                "past_pattern": self._extract_past_pattern(context["past_analyses"])
            }

            # 4. Run LLM chain
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

    def _get_fallback_roast(self) -> Dict[str, Any]:
        """Fallback roast if LLM fails"""
        return {
            "personality_name": "The Digital Explorer",
            "roast": "Your digital footprint is like a box of chocolates - we never know what we're gonna get, but it's always interesting",
            "vibe_check": "You're giving 'eclectic chaos' energy and we're here for it",
            "breakdown": [
                {"trait": "Curious Explorer", "percentage": 40},
                {"trait": "Digital Minimalist", "percentage": 30},
                {"trait": "Balanced Baddie", "percentage": 30}
            ]
        }
