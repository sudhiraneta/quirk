# 🚀 Backend Implementation Guide

## LangChain Setup

### Install Dependencies:
```bash
pip install langchain openai python-dotenv
```

### Environment:
```env
OPENAI_API_KEY=your_key_here
DATABASE_URL=postgresql://...
```

---

## 📊 **Clean & Concise LLM Response Format**

### Keep it SHORT:
- Top 3-5 items ONLY
- 1-2 line summary
- Crystal clear scoring

### Example Response:
```json
{
  "productivity_score": 67,
  "summary": "Solid work on Gmail (23 visits) and Docs (15 visits), but Instagram (89 visits) needs limits.",

  "top_productive": [
    { "service": "Gmail", "visits": 23 },
    { "service": "Google Docs", "visits": 15 },
    { "service": "Slack", "visits": 12 }
  ],

  "top_distractions": [
    { "service": "Instagram", "visits": 89, "warning": true },
    { "service": "YouTube", "visits": 45 },
    { "service": "Twitter/X", "visits": 34 }
  ],

  "active_hours": {
    "peak": "night_owl",  // or "early_bird" or "standard"
    "night_browsing_pct": 67
  },

  "motivation": "Great focus during work hours! Try limiting Instagram to scheduled 15-min breaks."
}
```

---

## 🎯 **LangChain Implementation**

### File: `backend/services/llm_analyzer.py`

```python
from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from typing import List
import json

class ProductivityAnalysis(BaseModel):
    """Structured output for productivity analysis"""
    productivity_score: int = Field(description="Score 0-100, target average 60")
    summary: str = Field(description="1-2 sentence summary")
    top_productive: List[dict] = Field(description="Top 3 productive sites")
    top_distractions: List[dict] = Field(description="Top 3 distractions")
    active_hours: dict = Field(description="Peak browsing time")
    motivation: str = Field(description="1-2 sentence motivation")

class LLMAnalyzer:
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4-turbo-preview",
            temperature=0.7
        )
        self.parser = PydanticOutputParser(pydantic_object=ProductivityAnalysis)

    def analyze_today(self, raw_data: List[dict], user_history: dict = None):
        """
        Analyze today's browsing data

        Args:
            raw_data: List of {url, title, hostname, visit_count, last_visit_time}
            user_history: {7day_average, personal_best, etc.}
        """

        # Calculate active hours
        active_hours = self._calculate_active_hours(raw_data)

        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a productivity analyst. Analyze browsing data.

OUTPUT FORMAT:
{format_instructions}

RULES:
- Keep it SHORT: Top 3-5 items only
- Summary: 1-2 sentences max
- Score: Use the formula (target average 60/100)
- Be SPECIFIC: Say "Gmail" not "google.com"
- List websites within Google separately
"""),
            ("human", """Analyze this data:

Raw Browsing Data (TODAY):
{raw_data}

Active Hours:
{active_hours}

User History:
{user_history}

Provide concise analysis with:
1. Productivity score (0-100, avg should be 60)
2. Top 3 productive sites
3. Top 3 distractions
4. 1-line summary
5. 1-line motivation
""")
        ])

        chain = prompt | self.llm | self.parser

        result = chain.invoke({
            "raw_data": json.dumps(raw_data, indent=2),
            "active_hours": json.dumps(active_hours),
            "user_history": json.dumps(user_history or {}),
            "format_instructions": self.parser.get_format_instructions()
        })

        return result.dict()

    def _calculate_active_hours(self, raw_data: List[dict]) -> dict:
        """Calculate when user is most active"""
        from datetime import datetime

        hours_count = {
            "work_hours": 0,      # 9am-5pm
            "evening_hours": 0,   # 5pm-11pm
            "night_hours": 0,     # 11pm-6am
            "morning_hours": 0    # 6am-9am
        }

        for item in raw_data:
            dt = datetime.fromisoformat(item['last_visit_time'].replace('Z', '+00:00'))
            hour = dt.hour

            if 9 <= hour < 17:
                hours_count["work_hours"] += item['visit_count']
            elif 17 <= hour < 23:
                hours_count["evening_hours"] += item['visit_count']
            elif hour >= 23 or hour < 6:
                hours_count["night_hours"] += item['visit_count']
            else:
                hours_count["morning_hours"] += item['visit_count']

        total = sum(hours_count.values())

        # Determine peak time
        peak = max(hours_count.items(), key=lambda x: x[1])[0]
        peak_label = {
            "work_hours": "standard",
            "evening_hours": "evening",
            "night_hours": "night_owl",
            "morning_hours": "early_bird"
        }[peak]

        return {
            "peak": peak_label,
            "night_browsing_pct": round((hours_count["night_hours"] / total) * 100) if total > 0 else 0,
            "work_hours_pct": round((hours_count["work_hours"] / total) * 100) if total > 0 else 0
        }

# Usage in API
analyzer = LLMAnalyzer()

@router.post("/analysis/today")
async def get_today_analysis(user_uuid: str, db: Session = Depends(get_db)):
    # Get today's raw data from DB
    raw_data = db.query(BrowsingData).filter(
        BrowsingData.user_uuid == user_uuid,
        BrowsingData.date == date.today()
    ).first()

    # Get user history for personalization
    user_history = get_user_7day_stats(user_uuid, db)

    # LLM analyzes
    analysis = analyzer.analyze_today(
        raw_data.raw_data,
        user_history
    )

    # Save to DB
    save_analysis(user_uuid, analysis, db)

    return analysis
```

---

## 📐 **Productivity Score Formula (Python)**

```python
def calculate_productivity_score(raw_data: List[dict], user_history: dict = None) -> int:
    """
    Calculate productivity score (0-100)
    Target average: 60/100
    """

    # A. Productive visits (0-35 points)
    productive_score = 0
    work_tools = ['mail.google.com', 'calendar.google.com', 'docs.google.com',
                  'slack.com', 'github.com', 'notion.so']
    educational = ['stackoverflow.com', 'developer.mozilla.org', 'coursera.org']

    for item in raw_data:
        if any(tool in item['hostname'] for tool in work_tools):
            productive_score += min(item['visit_count'] * 1.5, 35)
        elif any(edu in item['hostname'] for edu in educational):
            productive_score += min(item['visit_count'] * 2.0, 35)

    productive_score = min(productive_score, 35)

    # B. Distraction penalty (-50 to 0)
    distraction_penalty = 0
    social_media = ['instagram.com', 'tiktok.com', 'facebook.com', 'twitter.com', 'x.com']

    for item in raw_data:
        if any(sm in item['hostname'] for sm in social_media):
            if item['visit_count'] > 15:
                excess = item['visit_count'] - 15
                distraction_penalty -= excess * 0.8

            if item['visit_count'] > 60:  # Doom scrolling
                distraction_penalty -= (item['visit_count'] - 60) * 1.5

    distraction_penalty = max(distraction_penalty, -50)

    # C. Focus bonus (0-15)
    total_visits = sum(item['visit_count'] for item in raw_data)
    productive_visits = sum(item['visit_count'] for item in raw_data
                           if any(tool in item['hostname'] for tool in work_tools + educational))

    productive_ratio = productive_visits / total_visits if total_visits > 0 else 0

    if productive_ratio >= 0.8:
        focus_bonus = 15
    elif productive_ratio >= 0.6:
        focus_bonus = 10
    elif productive_ratio >= 0.4:
        focus_bonus = 5
    else:
        focus_bonus = 0

    # D. Time adjustment (-10 to +10)
    active_hours = calculate_active_hours(raw_data)
    time_adjustment = 0

    if active_hours['night_browsing_pct'] > 40:
        time_adjustment -= 10
    elif active_hours['work_hours_pct'] > 70 and productive_ratio > 0.6:
        time_adjustment += 10

    # E. Personalization (0-10)
    personalization = 0
    if user_history and 'avg_7day' in user_history:
        temp_score = productive_score + distraction_penalty + focus_bonus + time_adjustment
        if temp_score > user_history['avg_7day']:
            personalization += 5

    # Final calculation
    raw_score = productive_score + distraction_penalty + focus_bonus + time_adjustment + personalization

    # Normalize to target 60 average
    final_score = max(0, min(100, raw_score))

    return final_score
```

---

## 🎯 **Key Points**

1. ✅ **Short & Clean**: Top 3-5 items only
2. ✅ **Crystal Clear**: 1-2 line summary
3. ✅ **Valid Score**: Using the formula (target 60 avg)
4. ✅ **Personalized**: Night owl vs early bird
5. ✅ **Specific**: Gmail, not google.com
6. ✅ **Motivating**: Positive framing

