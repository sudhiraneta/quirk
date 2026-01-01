"""Prompt templates for self-discovery mode"""

from langchain_core.prompts import ChatPromptTemplate

# Step 1: Pattern Detection
PATTERN_DETECTION_TEMPLATE = """You are a behavioral pattern analyst examining digital footprints.

USER DATA:
{user_context}

TASK: Identify meaningful behavioral patterns across these dimensions:

1. **Content Consumption Patterns**
   - What types of content do they engage with most?
   - Are there recurring themes or topics?

2. **Time-Based Patterns**
   - When are they most active online?
   - Any seasonal or cyclical patterns?

3. **Interest Evolution**
   - How have their interests changed over time?
   - What's growing vs declining in focus?

4. **Emotional Resonance**
   - What content seems to resonate emotionally?
   - Any aspirational vs actual behavior gaps?

Return your analysis as JSON:
{{
  "content_patterns": ["pattern 1", "pattern 2", ...],
  "time_patterns": ["pattern 1", "pattern 2", ...],
  "interest_evolution": ["observation 1", "observation 2", ...],
  "emotional_patterns": ["pattern 1", "pattern 2", ...]
}}
"""

# Step 2: Insight Generation
INSIGHT_GENERATION_TEMPLATE = """Provide BRIEF self-discovery insights. Keep each insight to 1-2 sentences max.

PATTERNS:
{patterns}

FOCUS: {focus_areas}

TASK: Generate 3-4 SHORT insights. Each insight should be:
- 1-2 sentences total
- Specific to their actual behavior
- Actionable, not generic

Return as JSON:
{{
  "insights": [
    {{
      "category": "Category (2-3 words)",
      "observation": "One short sentence about what this reveals",
      "patterns": ["pattern1", "pattern2"],
      "psychological_drivers": "One short sentence on motivation"
    }}
  ]
}}

Keep it CONCISE. Quality over quantity.
"""

# Step 3: Suggestion Generation
SUGGESTION_GENERATION_TEMPLATE = """Create SHORT, specific action items. 1 sentence each.

INSIGHTS:
{insights}

PATTERNS:
{patterns_summary}

TASK: Provide 3-5 BRIEF action items:
- Each suggestion: 1 sentence max
- Specific and actionable
- Based on their actual behavior

Return as JSON:
{{
  "action_items": [
    {{
      "suggestion": "One specific action (10-15 words)",
      "rationale": "Why (1 short sentence)",
      "category": "Category"
    }}
  ]
}}

Keep it SHORT and ACTIONABLE.
"""

# Trend Analysis
TREND_ANALYSIS_TEMPLATE = """Compare these analyses over time and identify trends.

PAST ANALYSES:
{past_analyses}

CURRENT DATA:
{current_context}

Identify:
1. Interest shifts (what's growing vs declining)
2. Personality stability vs changes
3. Behavioral pattern evolution
4. Progress toward aspirational goals

Return as JSON:
{{
  "analysis": "Overall trend summary",
  "personality_evolution": "How their personality has evolved",
  "interest_shifts": ["shift 1", "shift 2", ...],
  "progress_indicators": ["indicator 1", "indicator 2", ...]
}}
"""


def get_pattern_detection_prompt() -> ChatPromptTemplate:
    """Get pattern detection prompt"""
    return ChatPromptTemplate.from_template(PATTERN_DETECTION_TEMPLATE)


def get_insight_generation_prompt() -> ChatPromptTemplate:
    """Get insight generation prompt"""
    return ChatPromptTemplate.from_template(INSIGHT_GENERATION_TEMPLATE)


def get_suggestion_generation_prompt() -> ChatPromptTemplate:
    """Get suggestion generation prompt"""
    return ChatPromptTemplate.from_template(SUGGESTION_GENERATION_TEMPLATE)


def get_trend_analysis_prompt() -> ChatPromptTemplate:
    """Get trend analysis prompt"""
    return ChatPromptTemplate.from_template(TREND_ANALYSIS_TEMPLATE)
