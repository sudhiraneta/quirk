# ⚡ Fast Implementation (<30 seconds)

## Why Backend + LLM?

**Can't call OpenAI from frontend:**
- ❌ Exposes API key (anyone can steal it)
- ❌ User pays for API calls
- ❌ No security

**Backend = Secure + Fast:**
- ✅ API key hidden
- ✅ Can cache results
- ✅ Can optimize prompts
- ✅ Total time: **5-15 seconds** (not 30+)

---

## ⚡ Optimized Flow (< 15 seconds)

```
User clicks "View Analytics"
    ↓
Frontend: Collect today's data (1-2s)
    ↓
Frontend: POST /api/v1/analyze-now (sends raw data)
    ↓
Backend: Receive data + call LLM immediately (5-10s)
    ↓
Backend: Return analysis
    ↓
Frontend: Display (< 1s)

TOTAL: 7-13 seconds
```

---

## 🚀 Fast Backend Implementation

### File: `backend/app/api/v1/endpoints/analysis.py`

```python
from fastapi import APIRouter, HTTPException
from openai import OpenAI
import json
from typing import List
from pydantic import BaseModel

router = APIRouter()
client = OpenAI()  # Uses OPENAI_API_KEY from environment

class BrowsingItem(BaseModel):
    url: str
    title: str
    hostname: str
    visit_count: int
    last_visit_time: str

class AnalyzeNowRequest(BaseModel):
    user_uuid: str
    raw_data: List[BrowsingItem]

@router.post("/analyze-now")
async def analyze_now(request: AnalyzeNowRequest):
    """
    Immediate LLM analysis - returns in <15 seconds
    """

    # Step 1: Prepare data (< 1s)
    data_summary = prepare_data_for_llm(request.raw_data)

    # Step 2: Call OpenAI (5-10s)
    analysis = await call_llm_fast(data_summary)

    # Step 3: Return immediately
    return analysis

def prepare_data_for_llm(raw_data: List[BrowsingItem]) -> dict:
    """Organize data for LLM - keep it minimal for speed"""

    # Group by hostname
    grouped = {}
    for item in raw_data:
        host = item.hostname
        if host not in grouped:
            grouped[host] = {
                "hostname": host,
                "total_visits": 0,
                "titles": []
            }
        grouped[host]["total_visits"] += item.visit_count
        if item.title and len(grouped[host]["titles"]) < 3:  # Max 3 titles per site
            grouped[host]["titles"].append(item.title)

    # Sort by visit count
    sorted_sites = sorted(grouped.values(), key=lambda x: x["total_visits"], reverse=True)

    return {
        "top_sites": sorted_sites[:15],  # Top 15 only for speed
        "total_sites": len(grouped),
        "total_visits": sum(item.visit_count for item in raw_data)
    }

async def call_llm_fast(data_summary: dict) -> dict:
    """
    Fast LLM call with minimal prompt
    """

    prompt = f"""Analyze this browsing data from TODAY:

Top Sites:
{json.dumps(data_summary['top_sites'], indent=2)}

Total: {data_summary['total_sites']} sites, {data_summary['total_visits']} visits

Provide SHORT analysis (top 3-5 items only):

1. Productivity score (0-100, target 60)
2. Top 3 productive sites
3. Top 3 distractions
4. 1-line summary
5. 1-line motivation

Respond ONLY with JSON:
{{
  "productivity_score": 67,
  "summary": "One sentence summary.",
  "top_productive": [{{"service": "Gmail", "visits": 23}}],
  "top_distractions": [{{"service": "Instagram", "visits": 89, "warning": true}}],
  "motivation": "One sentence motivation."
}}
"""

    # Call OpenAI (fastest model)
    response = client.chat.completions.create(
        model="gpt-4o-mini",  # FAST & CHEAP (not gpt-4 which is slower)
        messages=[
            {"role": "system", "content": "You are a productivity analyzer. Respond ONLY with valid JSON."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=500,  # Keep it short for speed
        response_format={"type": "json_object"}  # Ensures JSON response
    )

    # Parse response
    result = json.loads(response.choices[0].message.content)

    # Add extras
    result["date"] = datetime.now().strftime("%Y-%m-%d")

    return result
```

---

## Frontend: Single Request

### File: `quirk/popup.js`

```javascript
async function showBrowsingAnalytics() {
  statusEl.innerHTML = '<div class="loading">📊 Analyzing (5-10 seconds)...</div>';

  try {
    // Step 1: Collect today's data
    const todayData = await chrome.runtime.sendMessage({
      action: 'collectTodayData'  // New action
    });

    // Step 2: Get user UUID
    const userResponse = await chrome.runtime.sendMessage({ action: 'getUserUUID' });

    // Step 3: Send to backend for IMMEDIATE analysis
    const response = await fetch(`${API_BASE_URL}/analysis/analyze-now`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_uuid: userResponse.uuid,
        raw_data: todayData
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const analysis = await response.json();

    // Step 4: Display
    displayAnalysis(analysis);

  } catch (error) {
    statusEl.innerHTML = `<div class="error">${error.message}</div>`;
  }
}
```

---

## Service Worker Update

### File: `quirk/background/service-worker.js`

```javascript
// Add new action
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'collectTodayData') {
    collectTodayBrowsingHistory()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // ... rest of actions
});
```

---

## ⚡ Speed Optimizations

### 1. Use gpt-4o-mini (not gpt-4)
- **gpt-4**: 20-30 seconds
- **gpt-4o-mini**: 3-5 seconds ✅

### 2. Limit token count
```python
max_tokens=500  # Short response = faster
```

### 3. Minimal prompt
- Don't send full URLs
- Top 15 sites only
- 3 titles max per site

### 4. JSON response format
```python
response_format={"type": "json_object"}  # Faster parsing
```

### 5. No database wait
- No "save then retrieve"
- Analyze immediately
- Return instantly

---

## 📊 Performance Breakdown

| Step | Time |
|------|------|
| Collect data (frontend) | 1-2s |
| Send to backend | <1s |
| Prepare data | <1s |
| LLM call (gpt-4o-mini) | 3-5s |
| Parse response | <1s |
| Display | <1s |
| **TOTAL** | **7-11s** ✅ |

---

## 💰 Cost Optimization

**gpt-4o-mini pricing:**
- Input: $0.150 / 1M tokens
- Output: $0.600 / 1M tokens

**Per request:**
- Input: ~500 tokens ($0.000075)
- Output: ~300 tokens ($0.00018)
- **Total: $0.000255 per analysis** (quarter of a cent!)

**1000 users/day = $0.25/day = $7.50/month**

---

## 🎯 Summary

1. **Single request**: Frontend → Backend → LLM → Response
2. **Fast model**: gpt-4o-mini (not gpt-4)
3. **Minimal data**: Top 15 sites only
4. **No database delay**: Immediate analysis
5. **Result: 7-11 seconds** ✅

**No 30+ seconds. No queueing. Just fast.**

