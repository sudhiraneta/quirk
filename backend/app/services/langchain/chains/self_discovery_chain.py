"""Self-discovery mode chain - Deep, multi-step personality analysis"""

from typing import Dict, Any, List
import json
import logging
from langchain_openai import ChatOpenAI
from supabase import Client

from app.config import settings
from app.services.langchain.chains.base_chain import QuirkBaseChain
from app.services.langchain.prompts.self_discovery_prompts import (
    get_pattern_detection_prompt,
    get_insight_generation_prompt,
    get_suggestion_generation_prompt,
    get_trend_analysis_prompt
)

logger = logging.getLogger(__name__)


class SelfDiscoveryChain(QuirkBaseChain):
    """Deep, reflective personality analysis with actionable insights"""

    def __init__(self, db_client: Client):
        super().__init__(db_client)
        self.llm = ChatOpenAI(
            model=settings.openai_model,
            temperature=0.6,  # Slightly lower for more consistent insights
            max_tokens=2000,   # More tokens for detailed analysis
            api_key=settings.openai_api_key
        )

    async def generate_analysis(
        self,
        user_uuid: str,
        focus_areas: List[str] = None
    ) -> Dict[str, Any]:
        """
        Main entry point for self-discovery analysis
        Multi-step chain: pattern detection -> insights -> suggestions
        """
        try:
            # 1. Prepare comprehensive context
            context = await self.prepare_context(
                user_uuid,
                include_pinterest=True,
                include_browsing=True,
                limit=1000  # More data for deeper analysis
            )

            # 2. Format context for LLM
            user_context_str = self._format_context_for_llm(context)

            # 3. Step 1: Detect patterns
            patterns = await self._detect_patterns(user_context_str)

            # 4. Step 2: Generate insights
            insights = await self._generate_insights(
                patterns,
                focus_areas or ["general", "digital habits", "interests"]
            )

            # 5. Step 3: Create action items
            action_items = await self._generate_suggestions(insights, patterns)

            # 6. Analyze trends (if past data exists)
            trends = await self._analyze_trends(user_uuid, context)

            logger.info(f"Generated self-discovery analysis for user {user_uuid}")

            return {
                "patterns": patterns,
                "insights": insights,
                "action_items": action_items,
                "trends": trends
            }

        except Exception as e:
            logger.error(f"Error generating self-discovery analysis: {e}")
            return self._get_fallback_analysis()

    async def _detect_patterns(self, user_context: str) -> Dict[str, Any]:
        """Step 1: Detect behavioral patterns"""
        try:
            prompt = get_pattern_detection_prompt()
            chain = prompt | self.llm
            result = await chain.ainvoke({"user_context": user_context})

            # Parse JSON response
            response_text = self._extract_json(result.content)
            return json.loads(response_text)

        except Exception as e:
            logger.error(f"Error detecting patterns: {e}")
            return {
                "content_patterns": ["Diverse content consumption"],
                "time_patterns": ["Regular engagement"],
                "interest_evolution": ["Consistent interests"],
                "emotional_patterns": ["Balanced emotional resonance"]
            }

    async def _generate_insights(self, patterns: Dict, focus_areas: List[str]) -> List[Dict]:
        """Step 2: Generate psychological insights"""
        try:
            prompt = get_insight_generation_prompt()
            chain = prompt | self.llm
            result = await chain.ainvoke({
                "patterns": json.dumps(patterns, indent=2),
                "focus_areas": ", ".join(focus_areas)
            })

            # Parse JSON response
            response_text = self._extract_json(result.content)
            parsed = json.loads(response_text)
            return parsed.get("insights", [])

        except Exception as e:
            logger.error(f"Error generating insights: {e}")
            return [{
                "category": "Digital Habits",
                "observation": "Your digital behavior shows a balanced approach to online engagement",
                "patterns": ["Regular but not excessive use", "Diverse content interests"],
                "psychological_drivers": "Curiosity and self-improvement motivation"
            }]

    async def _generate_suggestions(self, insights: List[Dict], patterns: Dict) -> List[str]:
        """Step 3: Create actionable suggestions"""
        try:
            prompt = get_suggestion_generation_prompt()
            chain = prompt | self.llm
            result = await chain.ainvoke({
                "insights": json.dumps(insights, indent=2),
                "patterns_summary": json.dumps(patterns, indent=2)
            })

            # Parse JSON response
            response_text = self._extract_json(result.content)
            parsed = json.loads(response_text)

            # Extract just the suggestion text
            action_items = parsed.get("action_items", [])
            if action_items and isinstance(action_items[0], dict):
                return [item["suggestion"] for item in action_items]
            return action_items

        except Exception as e:
            logger.error(f"Error generating suggestions: {e}")
            return [
                "Set specific time blocks for intentional content consumption",
                "Create a personal project based on your recurring interests",
                "Track one habit aligned with your digital aspirations for 30 days"
            ]

    async def _analyze_trends(self, user_uuid: str, current_context: Dict) -> Dict[str, Any]:
        """Analyze trends by comparing to past analyses"""
        try:
            past_analyses = await self._get_past_analyses(user_uuid, limit=5)

            if not past_analyses or len(past_analyses) < 2:
                return {
                    "analysis": "Not enough historical data for trend analysis yet",
                    "personality_evolution": None,
                    "interest_shifts": None
                }

            # Format past analyses
            past_summary = self._format_past_analyses(past_analyses)

            prompt = get_trend_analysis_prompt()
            chain = prompt | self.llm
            result = await chain.ainvoke({
                "past_analyses": past_summary,
                "current_context": json.dumps({
                    "pinterest_categories": [p.get("category") for p in current_context.get("pinterest", [])[:20]],
                    "top_platforms": current_context.get("browsing", {}).get("top_platforms", [])
                }, indent=2)
            })

            # Parse JSON response
            response_text = self._extract_json(result.content)
            return json.loads(response_text)

        except Exception as e:
            logger.error(f"Error analyzing trends: {e}")
            return {
                "analysis": "Your interests show consistency over time",
                "personality_evolution": "Stable core traits",
                "interest_shifts": []
            }

    def _format_context_for_llm(self, context: Dict) -> str:
        """Format context data into readable text for LLM"""
        sections = []

        if context.get("pinterest"):
            sections.append(f"## Pinterest ({len(context['pinterest'])} pins)")
            sections.append(self._summarize_pinterest(context["pinterest"]))

        if context.get("browsing"):
            sections.append("\n## Browsing History")
            sections.append(self._summarize_browsing(context["browsing"]))

        if context.get("keywords"):
            sections.append(f"\n## Key Interests: {', '.join(context['keywords'])}")

        return "\n".join(sections)

    def _format_past_analyses(self, past_analyses: List[Dict]) -> str:
        """Format past analyses for trend analysis"""
        summaries = []
        for i, analysis in enumerate(past_analyses, 1):
            output_data = analysis.get("output_data", {})
            summaries.append(f"Analysis {i} ({analysis.get('created_at', 'unknown date')}):")
            summaries.append(f"  Mode: {analysis.get('mode', 'unknown')}")
            if isinstance(output_data, dict):
                if "personality_name" in output_data:
                    summaries.append(f"  Personality: {output_data['personality_name']}")
            summaries.append("")

        return "\n".join(summaries)

    def _extract_json(self, text: str) -> str:
        """Extract JSON from LLM response (handles markdown wrapping)"""
        text = text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return text

    def _get_fallback_analysis(self) -> Dict[str, Any]:
        """Fallback analysis if LLM fails"""
        return {
            "patterns": {},
            "insights": [{
                "category": "Digital Behavior",
                "observation": "Your digital footprint shows thoughtful engagement",
                "patterns": ["Consistent usage", "Diverse interests"],
                "psychological_drivers": "Curiosity and growth mindset"
            }],
            "action_items": [
                "Continue exploring diverse content areas",
                "Consider documenting your learnings",
                "Set intentional goals for your digital consumption"
            ],
            "trends": {
                "analysis": "Building your digital profile",
                "personality_evolution": None,
                "interest_shifts": []
            }
        }
