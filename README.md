# Quirk

**Daily productivity score from your browsing data. Black & white. No BS.**

![Version](https://img.shields.io/badge/version-2.1.0-blue)
![Python](https://img.shields.io/badge/python-3.10+-green)
![License](https://img.shields.io/badge/license-MIT-orange)

---

## What It Does

Daily productivity score (0-100). Target: 60.

```
Chrome browsing → Backend saves → LLM analyzes → Score + insights
```

**Example:**
- Gmail (23 visits) = productive
- Instagram (89 visits) = doom scrolling detected
- Score: 67/100

---

## Why This Architecture

### Design Decisions

| Decision | Why |
|----------|-----|
| **TODAY only** | Daily feedback loop. Not buried in 30-day history. |
| **Raw data to backend** | No frontend logic. LLM does ALL categorization. |
| **Score target: 60** | Realistic. Not inflated. 60 = good day. |
| **Black & white UI** | Zero distractions. ChatGPT style. |
| **Chrome profile email** | Auto-login. No OAuth popup. |
| **Database-first** | Async LLM. Frontend never waits >3s. |
| **gpt-4o-mini** | 3-5s response. Not 20-30s like gpt-4. |

### Data Flow

```
Extension collects today's URLs
  ↓
POST /browsing/today (saves to DB, returns <3s)
  ↓
Background: LLM analyzes (5-10s)
  ↓
GET /analysis/today/{uuid} (returns from DB cache)
```

**No frontend categorization.** LLM separates:
- Gmail vs Google Calendar vs Google Docs
- LinkedIn Jobs vs LinkedIn Feed
- Productive vs doom scrolling (80+ visits flagged)

---

## API

### POST /api/v1/browsing/today

**Saves raw data. Returns immediately.**

```json
{
  "user_uuid": "abc-123",
  "date": "2026-01-02",
  "raw_data": [
    {
      "url": "https://mail.google.com/mail/u/0/#inbox",
      "title": "Inbox (23) - Gmail",
      "hostname": "mail.google.com",
      "visit_count": 23,
      "last_visit_time": "2026-01-02T10:30:00Z"
    }
  ]
}
```

**Response:** `{"success": true, "items_count": 15}`

---

### GET /api/v1/analysis/today/{uuid}

**Returns LLM analysis from cache.**

```json
{
  "status": "completed",
  "productivity_score": 67,
  "summary": "Solid Gmail (23) and Docs (15). Instagram (89) needs limits.",
  "top_productive": [
    {"service": "Gmail", "visits": 23},
    {"service": "Google Docs", "visits": 15}
  ],
  "top_distractions": [
    {"service": "Instagram", "visits": 89, "warning": true}
  ],
  "motivation": "Great focus! Try 15-min Instagram breaks."
}
```

---

### POST /api/v1/analysis/roast/{uuid}

**Personalized roast based on productivity score.**

```json
{
  "personality_name": "The 2AM Productivity Phantom",
  "roast": "34/100? Your battery performs better. Instagram: 147 visits. Google Docs: 3.",
  "vibe_check": "Night owl meets doom scrolling champion.",
  "breakdown": [
    {"trait": "Night Owl Syndrome", "percentage": 92}
  ]
}
```

---

## Quick Start

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt

# Configure .env
cp .env.example .env
# Add: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY

# Start server
python -m app.main
# → http://localhost:8000
```

### 2. Database Tables

**Run in Supabase SQL Editor:**

```sql
CREATE TABLE daily_browsing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    raw_data JSONB NOT NULL,
    UNIQUE(user_uuid, date)
);

CREATE TABLE daily_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    productivity_score INTEGER,
    analysis_data JSONB NOT NULL,
    processing_status VARCHAR(20) DEFAULT 'pending',
    UNIQUE(user_uuid, date)
);
```

Full schema: `backend/database_setup.sql`

### 3. Extension Install

```
1. chrome://extensions/
2. Enable Developer mode
3. Load unpacked → Select quirk/
4. Click extension icon → Side panel opens
```

---

## Productivity Score Formula

```python
Score = Productive Time (0-35 pts)
      + Distraction Penalty (-50 to 0 pts)
      + Focus Bonus (0-15 pts)
      + Time Adjustment (-10 to +10 pts)
      + Personal Growth (0-10 pts)

Target: 60/100
```

**Why this formula:**
- Doom scrolling hurts significantly (-50 pts max)
- Night browsing = penalty
- Beat your 7-day average = bonus
- Realistic scoring (60 = good, not 80)

---

## Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| **Extension** | Vanilla JS | No frameworks. Fast. Simple. |
| **Backend** | FastAPI | Async. Type-safe. Fast. |
| **LLM** | gpt-4o-mini | 3-5s response. $0.0003/request. |
| **Database** | Supabase PostgreSQL | Managed. JSONB for flexibility. |
| **Auth** | Chrome Identity API | No OAuth popup. Auto-login. |
| **Deploy** | Render | GitHub auto-deploy. HTTPS. |

---

## Architecture Highlights

### 1. No Frontend Logic

**Old approach:**
```javascript
// ❌ Don't do this
if (hostname.includes('google.com')) {
  category = 'productivity';
}
```

**New approach:**
```javascript
// ✅ Just send raw data
{
  url: "https://mail.google.com/mail/u/0/#inbox",
  visit_count: 23
}
// LLM figures out: "Gmail" = productive
```

### 2. Async Database-First

**Why:**
- Frontend gets response in <3s
- LLM processes in background (5-10s)
- Results cached in database
- Second view: <100ms

**Alternative (bad):**
- Frontend waits 10s for LLM
- User sees frozen UI
- Can't retry failures

### 3. Target 60 (Not 40 or 80)

**Why 60:**
- 40 = too harsh (demoralizing)
- 80 = too easy (inflated)
- 60 = realistic "good day"

Formula calibrated so:
- Average user: 50-65
- Productive day: 70-85
- Exceptional: 90+

---

## Security

**Authentication:**
- Chrome profile email (no password)
- UUID generated from Chrome identity
- Backend validates on every request

**API Keys:**
- Stored in backend `.env` only
- Never exposed to frontend
- Rotated regularly

**Database:**
- RLS policies enabled
- User data isolated by UUID
- HTTPS only in production

---

## Deployment

### Production Backend

**URL:** https://quirk-kvxe.onrender.com

**Deploy:**
```bash
git push origin main
# Render auto-deploys in ~2-5 min
```

**Environment:**
- `OPENAI_API_KEY` → OpenAI key
- `SUPABASE_URL` → Project URL
- `SUPABASE_KEY` → Anon key
- `APP_ENV=production`
- `DEBUG=False`

### Extension

**Update API URL:**
```javascript
// quirk/shared/constants.js
export const API_BASE_URL = 'https://quirk-kvxe.onrender.com/api/v1';
```

**Package:**
```bash
cd quirk/
zip -r quirk.zip . -x "*.git*" "node_modules/*"
# Upload to Chrome Web Store
```

---

## Known Issues

**1. LLM Background Worker**
- Status: Queued but not implemented
- Impact: Analysis stays "pending"
- Fix: See `ASYNC_BACKEND_IMPLEMENTATION.md`

**2. Database Tables**
- Status: Must create manually
- Impact: 500 errors on `/browsing/today`
- Fix: Run `CREATE_TABLES.sql` in Supabase

**3. Extension Caching**
- Status: Chrome caches aggressively
- Impact: Changes don't appear after reload
- Fix: Remove extension → Clear cache → Reload

---

## Documentation

**Implementation:**
- `ASYNC_BACKEND_IMPLEMENTATION.md` - Database-first architecture
- `FAST_IMPLEMENTATION.md` - <15s LLM optimization
- `LLM_PROMPTS.md` - Analysis prompts

**Setup:**
- `TESTING_GUIDE.md` - API testing
- `CREATE_TABLES.sql` - Database schema
- `RELOAD_EXTENSION.md` - Fix caching issues

---

## Contributing

**Guidelines:**
- Frontend: Zero logic. Data collection only.
- Backend: LLM decides everything. No hardcoded rules.
- UI: Black & white. No colors.
- Commit: Clear messages. Test first.

**Process:**
```bash
git checkout -b feature/name
git commit -m "Add feature"
git push origin feature/name
# Open PR
```

---

## License

MIT

---

## Credits

- OpenAI (gpt-4o-mini)
- Supabase (PostgreSQL)
- FastAPI (Python web framework)
- Render (deployment)

**Built by Sudhira Badugu**
