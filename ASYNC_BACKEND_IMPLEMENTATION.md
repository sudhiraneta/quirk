# 🚀 Async Backend Implementation (Database-First)

## Architecture Flow

```
Frontend collects data
    ↓
POST /api/v1/browsing/today
    ↓
1. Save raw data to database (FAST)
2. Queue LLM analysis (async background task)
3. Return confirmation immediately
    ↓
[Background: LLM processes data]
    ↓
4. Save analysis to database
    ↓
GET /api/v1/analysis/today/{user_uuid}
    ↓
5. Return saved analysis from database
```

**Benefits:**
- ✅ Frontend gets instant response (no 5-10s wait)
- ✅ LLM processing happens in background
- ✅ Analysis cached in database
- ✅ Can retry failed LLM calls
- ✅ User can refresh to check if analysis is ready

---

## Database Schema

```sql
-- Raw browsing data (saved immediately)
CREATE TABLE daily_browsing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID NOT NULL,
    date DATE NOT NULL,
    raw_data JSONB NOT NULL,  -- [{url, title, hostname, visit_count, last_visit_time}]
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_uuid, date)
);

-- LLM analysis results (saved after background processing)
CREATE TABLE daily_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID NOT NULL,
    date DATE NOT NULL,
    productivity_score INTEGER,
    analysis_data JSONB NOT NULL,  -- Full LLM response
    processing_status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
    llm_model TEXT,  -- gpt-4o-mini, gpt-4, etc.
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_uuid, date)
);

CREATE INDEX idx_daily_browsing_user_date ON daily_browsing(user_uuid, date);
CREATE INDEX idx_daily_analysis_user_date ON daily_analysis(user_uuid, date);
CREATE INDEX idx_daily_analysis_status ON daily_analysis(processing_status);
```

---

## Backend Implementation

### File: `backend/app/api/v1/endpoints/browsing.py`

```python
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List
from datetime import date, datetime
import json

router = APIRouter()

class BrowsingItem(BaseModel):
    url: str
    title: str
    hostname: str
    visit_count: int
    last_visit_time: str

class TodayBrowsingRequest(BaseModel):
    user_uuid: str
    raw_data: List[BrowsingItem]
    date: str

@router.post("/browsing/today")
async def save_today_browsing(
    request: TodayBrowsingRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Step 1: Save raw data to database
    Step 2: Queue LLM analysis (async)
    Step 3: Return immediately
    """

    # 1. Save raw browsing data to database
    browsing_entry = DailyBrowsing(
        user_uuid=request.user_uuid,
        date=request.date,
        raw_data=[item.dict() for item in request.raw_data]
    )

    # Upsert (insert or update if exists)
    existing = db.query(DailyBrowsing).filter(
        DailyBrowsing.user_uuid == request.user_uuid,
        DailyBrowsing.date == request.date
    ).first()

    if existing:
        existing.raw_data = [item.dict() for item in request.raw_data]
        existing.created_at = datetime.now()
    else:
        db.add(browsing_entry)

    db.commit()

    # 2. Create analysis placeholder (status: pending)
    analysis_entry = DailyAnalysis(
        user_uuid=request.user_uuid,
        date=request.date,
        processing_status='pending',
        analysis_data={}
    )

    existing_analysis = db.query(DailyAnalysis).filter(
        DailyAnalysis.user_uuid == request.user_uuid,
        DailyAnalysis.date == request.date
    ).first()

    if not existing_analysis:
        db.add(analysis_entry)
        db.commit()

    # 3. Queue LLM analysis (background task)
    background_tasks.add_task(
        process_llm_analysis,
        user_uuid=request.user_uuid,
        analysis_date=request.date,
        db=db
    )

    # 4. Return immediately
    return {
        "success": True,
        "message": f"Data saved. Analysis queued.",
        "date": request.date,
        "items_count": len(request.raw_data)
    }
```

---

## Background LLM Processing

### File: `backend/app/services/llm_processor.py`

```python
from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from typing import List
import json

class ProductivityAnalysis(BaseModel):
    productivity_score: int = Field(description="Score 0-100, target 60")
    summary: str = Field(description="1-2 sentence summary")
    top_productive: List[dict] = Field(description="Top 3 productive sites")
    top_distractions: List[dict] = Field(description="Top 3 distractions")
    active_hours: dict = Field(description="Peak browsing time")
    motivation: str = Field(description="1-2 sentence motivation")
    doom_scrolling_alert: dict = Field(description="Doom scrolling detection")

def process_llm_analysis(user_uuid: str, analysis_date: str, db: Session):
    """
    Background task: Process LLM analysis
    """
    try:
        # 1. Update status to 'processing'
        analysis_record = db.query(DailyAnalysis).filter(
            DailyAnalysis.user_uuid == user_uuid,
            DailyAnalysis.date == analysis_date
        ).first()

        if not analysis_record:
            return

        analysis_record.processing_status = 'processing'
        db.commit()

        # 2. Get raw browsing data
        browsing_data = db.query(DailyBrowsing).filter(
            DailyBrowsing.user_uuid == user_uuid,
            DailyBrowsing.date == analysis_date
        ).first()

        if not browsing_data:
            analysis_record.processing_status = 'failed'
            db.commit()
            return

        # 3. Get user's 7-day history for personalization
        user_history = get_user_7day_stats(user_uuid, db)

        # 4. Call LLM
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
        parser = PydanticOutputParser(pydantic_object=ProductivityAnalysis)

        # Prepare data for LLM (minimal, top 15 sites)
        prepared_data = prepare_data_for_llm(browsing_data.raw_data)

        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a productivity analyzer. Analyze browsing data.

OUTPUT FORMAT:
{format_instructions}

RULES:
- Keep it SHORT: Top 3-5 items only
- Summary: 1-2 sentences max
- Score: Target 60/100 average
- Be SPECIFIC: "Gmail" not "google.com"
- Separate Google services (Gmail, Calendar, Docs, Drive)
- Flag 80+ social media visits as doom scrolling
"""),
            ("human", """Analyze this browsing data from TODAY:

Top Sites:
{sites_data}

Total: {total_sites} sites, {total_visits} visits

Active Hours:
{active_hours}

User's 7-Day Average Score: {avg_score}

Provide:
1. Productivity score (0-100, target 60)
2. Top 3 productive sites
3. Top 3 distractions
4. 1-line summary
5. 1-line motivation
6. Doom scrolling alert if needed
""")
        ])

        chain = prompt | llm | parser

        # Calculate active hours
        active_hours = calculate_active_hours(browsing_data.raw_data)

        result = chain.invoke({
            "sites_data": json.dumps(prepared_data['top_sites'], indent=2),
            "total_sites": prepared_data['total_sites'],
            "total_visits": prepared_data['total_visits'],
            "active_hours": json.dumps(active_hours, indent=2),
            "avg_score": user_history.get('avg_score', 60),
            "format_instructions": parser.get_format_instructions()
        })

        # 5. Save analysis to database
        analysis_record.productivity_score = result.productivity_score
        analysis_record.analysis_data = result.dict()
        analysis_record.processing_status = 'completed'
        analysis_record.llm_model = 'gpt-4o-mini'
        analysis_record.updated_at = datetime.now()

        db.commit()

        print(f"✅ Analysis completed for {user_uuid} on {analysis_date}")

    except Exception as e:
        print(f"❌ LLM analysis failed: {e}")

        # Mark as failed
        if analysis_record:
            analysis_record.processing_status = 'failed'
            analysis_record.analysis_data = {"error": str(e)}
            db.commit()

def prepare_data_for_llm(raw_data: List[dict]) -> dict:
    """Organize data for LLM - keep minimal for speed"""

    # Group by hostname
    grouped = {}
    for item in raw_data:
        host = item['hostname']
        if host not in grouped:
            grouped[host] = {
                "hostname": host,
                "total_visits": 0,
                "titles": []
            }
        grouped[host]["total_visits"] += item['visit_count']
        if item['title'] and len(grouped[host]["titles"]) < 3:
            grouped[host]["titles"].append(item['title'])

    # Sort by visit count
    sorted_sites = sorted(grouped.values(), key=lambda x: x["total_visits"], reverse=True)

    return {
        "top_sites": sorted_sites[:15],  # Top 15 only
        "total_sites": len(grouped),
        "total_visits": sum(item['visit_count'] for item in raw_data)
    }

def calculate_active_hours(raw_data: List[dict]) -> dict:
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

def get_user_7day_stats(user_uuid: str, db: Session) -> dict:
    """Get user's 7-day average for personalization"""
    from datetime import timedelta

    seven_days_ago = date.today() - timedelta(days=7)

    analyses = db.query(DailyAnalysis).filter(
        DailyAnalysis.user_uuid == user_uuid,
        DailyAnalysis.date >= seven_days_ago,
        DailyAnalysis.processing_status == 'completed'
    ).all()

    if not analyses:
        return {"avg_score": 60}

    scores = [a.productivity_score for a in analyses if a.productivity_score]
    avg_score = sum(scores) // len(scores) if scores else 60

    return {
        "avg_score": avg_score,
        "days_analyzed": len(analyses)
    }
```

---

## Get Analysis Endpoint

### File: `backend/app/api/v1/endpoints/analysis.py`

```python
from fastapi import APIRouter, HTTPException
from datetime import date

router = APIRouter()

@router.get("/analysis/today/{user_uuid}")
async def get_today_analysis(user_uuid: str, db: Session = Depends(get_db)):
    """
    Get today's analysis from database
    Returns immediately if available, or status if still processing
    """

    today = date.today().isoformat()

    # Check if analysis exists
    analysis = db.query(DailyAnalysis).filter(
        DailyAnalysis.user_uuid == user_uuid,
        DailyAnalysis.date == today
    ).first()

    if not analysis:
        raise HTTPException(
            status_code=404,
            detail="No analysis found. Please send browsing data first."
        )

    # Check processing status
    if analysis.processing_status == 'pending':
        return {
            "status": "pending",
            "message": "Analysis queued. Check back in a few seconds."
        }

    if analysis.processing_status == 'processing':
        return {
            "status": "processing",
            "message": "LLM is analyzing your data. Almost done!"
        }

    if analysis.processing_status == 'failed':
        raise HTTPException(
            status_code=500,
            detail="Analysis failed. Please try again."
        )

    # Return completed analysis
    return {
        "status": "completed",
        "date": analysis.date,
        "productivity_score": analysis.productivity_score,
        **analysis.analysis_data
    }

@router.post("/analysis/roast/{user_uuid}")
async def get_roast(user_uuid: str, db: Session = Depends(get_db)):
    """
    Generate personalized roast based on today's productivity
    """

    today = date.today().isoformat()

    # Get today's analysis
    analysis = db.query(DailyAnalysis).filter(
        DailyAnalysis.user_uuid == user_uuid,
        DailyAnalysis.date == today,
        DailyAnalysis.processing_status == 'completed'
    ).first()

    if not analysis:
        raise HTTPException(
            status_code=404,
            detail="No analysis available. View analytics first."
        )

    # Generate roast using LLM
    # (Use roast prompt from LLM_PROMPTS.md)
    roast_data = generate_roast_llm(
        productivity_score=analysis.productivity_score,
        analysis_data=analysis.analysis_data,
        user_uuid=user_uuid,
        db=db
    )

    return roast_data
```

---

## Frontend Updates

### File: `quirk/background/service-worker.js`

```javascript
// Updated: collectAndSendTodayBrowsingData
async function collectAndSendTodayBrowsingData() {
  try {
    const uuid = await getUserUUID();
    const todayData = await collectTodayBrowsingHistory();

    // Send to backend (async processing)
    const response = await fetch(`${API_BASE_URL}/browsing/today`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_uuid: uuid,
        raw_data: todayData,
        date: new Date().toISOString().split('T')[0]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Data sent, analysis queued:', result);

    return { success: true, ...result };

  } catch (error) {
    console.error('❌ Failed to send browsing data:', error);
    return { success: false, error: error.message };
  }
}

// New: getTodayAnalysisFromLLM
async function getTodayAnalysisFromLLM() {
  try {
    const uuid = await getUserUUID();

    const response = await fetch(`${API_BASE_URL}/analysis/today/${uuid}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const analysis = await response.json();

    // Check if still processing
    if (analysis.status === 'pending' || analysis.status === 'processing') {
      return {
        success: false,
        processing: true,
        message: analysis.message
      };
    }

    return { success: true, analysis };

  } catch (error) {
    console.error('❌ Failed to get analysis:', error);
    return { success: false, error: error.message };
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'collectAndSendBrowsingData') {
    collectAndSendTodayBrowsingData()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getTodayAnalysis') {
    getTodayAnalysisFromLLM()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // ... other actions
});
```

### File: `quirk/popup.js`

```javascript
// Updated: showBrowsingAnalytics with polling
async function showBrowsingAnalytics() {
  statusEl.innerHTML = '<div class="loading">📊 Collecting data...</div>';

  try {
    // Step 1: Collect and send data (triggers async LLM)
    await chrome.runtime.sendMessage({ action: 'collectAndSendBrowsingData' });

    // Step 2: Poll for analysis (check every 2 seconds)
    statusEl.innerHTML = '<div class="loading">🤖 AI analyzing... (5-10 seconds)</div>';

    let attempts = 0;
    const maxAttempts = 10;  // 20 seconds max

    const pollAnalysis = async () => {
      const response = await chrome.runtime.sendMessage({ action: 'getTodayAnalysis' });

      if (response.success) {
        // Analysis ready!
        displayAnalysis(response.analysis);
        return;
      }

      if (response.processing) {
        // Still processing, try again
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(pollAnalysis, 2000);  // Check again in 2 seconds
        } else {
          statusEl.innerHTML = '<div class="error">Analysis taking longer than expected. Refresh in a few seconds.</div>';
        }
      } else {
        throw new Error(response.error || 'Analysis failed');
      }
    };

    await pollAnalysis();

  } catch (error) {
    statusEl.innerHTML = `<div class="error">Analysis unavailable: ${error.message}</div>`;
  }
}
```

---

## Performance Characteristics

| Step | Time | Notes |
|------|------|-------|
| Frontend collects data | 1-2s | Chrome history API |
| POST /browsing/today | <1s | Database insert only |
| **User gets response** | **2-3s total** | ✅ No waiting for LLM |
| Background LLM processing | 5-10s | gpt-4o-mini analysis |
| Database save | <1s | Analysis stored |
| GET /analysis/today | <100ms | Read from cache |

**User Experience:**
1. Click "View Analytics" → Data sent (2-3s)
2. Shows "AI analyzing..." with polling
3. Analysis appears when ready (5-10s total)
4. Subsequent views: instant (<100ms from DB)

---

## Summary

**Architecture:**
- ✅ Frontend sends data → immediate response
- ✅ LLM processes in background (FastAPI BackgroundTasks)
- ✅ Analysis saved to database
- ✅ Frontend polls for results
- ✅ Second view = instant (cached in DB)

**Benefits over immediate LLM call:**
- Frontend never waits >3 seconds
- Retry logic for failed LLM calls
- Analysis cached for future requests
- Can queue multiple users' analyses
- Proper separation of concerns

**Total time to user:**
- First view: 7-13 seconds (with polling)
- Second view: <100ms (from database)
