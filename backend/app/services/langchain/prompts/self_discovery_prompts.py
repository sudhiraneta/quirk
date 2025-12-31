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
INSIGHT_GENERATION_TEMPLATE = """You are a compassionate psychologist providing self-discovery insights.

DETECTED PATTERNS:
{patterns}

FOCUS AREAS: {focus_areas}

TASK: Generate deep psychological insights that:
1. Explain what these patterns reveal about their personality and values
2. Connect patterns to potential motivations, needs, or fears
3. Identify cognitive biases or blind spots (gently)
4. Highlight strengths and growth opportunities

Be specific, evidence-based, and constructive. Avoid generic advice like "be more mindful."

Return insights as JSON organized by category:
{{
  "insights": [
    {{
      "category": "Category name (e.g., Digital Habits, Career Aspirations)",
      "observation": "Main insight about what this reveals",
      "patterns": ["supporting pattern 1", "supporting pattern 2"],
      "psychological_drivers": "What motivates this behavior"
    }},
    ...
  ]
}}
"""

# Step 3: Suggestion Generation
SUGGESTION_GENERATION_TEMPLATE = """You are a personal development coach creating actionable steps.

INSIGHTS:
{insights}

USER'S DIGITAL BEHAVIOR PATTERNS:
{patterns_summary}

TASK: Create specific, actionable suggestions that:
1. Are concrete and achievable (not vague like "be more mindful")
2. Leverage their existing interests and patterns
3. Address identified growth areas
4. Include next steps or resources when relevant
5. Are personalized to their actual digital behavior

Provide 5-7 suggestions with clear rationale.

Return as JSON:
{{
  "action_items": [
    {{
      "suggestion": "Specific actionable suggestion",
      "rationale": "Why this matters based on their patterns",
      "category": "Category (e.g., career, wellness, relationships)"
    }},
    ...
  ]
}}
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
