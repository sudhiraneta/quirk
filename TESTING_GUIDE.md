# 🧪 Testing Guide - API Endpoints

## ✅ What's Been Fixed

### Backend Endpoints
1. **POST /api/v1/browsing/today** - Saves today's raw browsing data
2. **GET /api/v1/analysis/today/{uuid}** - Gets today's analysis (with status)
3. **POST /api/v1/analysis/roast/{uuid}** - Generates roast (fixed path parameter)
4. **POST /api/v1/analysis/self-discovery/{uuid}** - Self-discovery mode

### Frontend
1. **API URL** - Changed to `http://localhost:8000/api/v1` (from production)
2. **Blue UI** - Changed to white background with black text
3. **Extension** - Ready to test with local backend

### Database
1. **New tables added** to `database_setup.sql`:
   - `daily_browsing` - Stores today's raw browsing data
   - `daily_analysis` - Stores LLM analysis results

---

## 🚨 REQUIRED: Run SQL in Supabase

**You MUST run this SQL in your Supabase SQL Editor before testing:**

```sql
-- Daily browsing data table (NEW: for today's raw data)
CREATE TABLE IF NOT EXISTS daily_browsing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    raw_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_uuid, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_browsing_user_date ON daily_browsing(user_uuid, date);

-- Daily analysis table (NEW: for LLM analysis results)
CREATE TABLE IF NOT EXISTS daily_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    productivity_score INTEGER,
    analysis_data JSONB NOT NULL,
    processing_status VARCHAR(20) DEFAULT 'pending',
    llm_model VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_uuid, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_analysis_user_date ON daily_analysis(user_uuid, date);
CREATE INDEX IF NOT EXISTS idx_daily_analysis_status ON daily_analysis(processing_status);
```

**Steps:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor (left sidebar)
4. Paste the SQL above
5. Click "Run" or press Ctrl+Enter

---

## 🧪 Testing Steps

### 1. Reload Chrome Extension
```
1. Go to chrome://extensions/
2. Find "Quirk" extension
3. Click the reload button (🔄)
```

### 2. Backend is Already Running
```bash
# Server running at http://localhost:8000
# Check health:
curl http://localhost:8000/health
```

### 3. Test Extension Flow

#### A. Test "View Browsing Analytics"
1. Click extension icon
2. Click "📊 View Browsing Analytics" button
3. Should see:
   - "📊 Collecting today's browsing data..."
   - Data sent to `/browsing/today`
   - Message: "Analysis queued. Check back in a few seconds."

**What happens:**
- Extension collects today's browsing history
- Sends to `POST /browsing/today`
- Backend saves to `daily_browsing` table
- Creates placeholder in `daily_analysis` table (status: 'pending')
- Frontend shows "Analysis queued" message

#### B. Test "Get Roasted"
1. Click "Get Roasted" button
2. Should call:
   - `getBrowsingAnalytics` first (collects data)
   - Then `POST /analysis/roast/{uuid}`
3. Should show roast analysis

#### C. Test "Self-Discovery"
1. Click "Self-Discovery" button
2. Should call:
   - `getBrowsingAnalytics` first
   - Then `POST /analysis/self-discovery/{uuid}`
3. Should show insights

---

## 📊 Manual API Testing

### Test 1: Create a test user
```bash
curl -X POST http://localhost:8000/api/v1/users/initialize \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response:
```json
{
  "user_id": "some-uuid-here",
  "message": "User initialized successfully"
}
```

### Test 2: Send browsing data
```bash
curl -X POST http://localhost:8000/api/v1/browsing/today \
  -H "Content-Type: application/json" \
  -d '{
    "user_uuid": "YOUR_USER_UUID_HERE",
    "date": "2026-01-01",
    "raw_data": [
      {
        "url": "https://github.com/trending",
        "title": "Trending - GitHub",
        "hostname": "github.com",
        "visit_count": 10,
        "last_visit_time": "2026-01-01T10:30:00Z"
      },
      {
        "url": "https://instagram.com/explore",
        "title": "Explore - Instagram",
        "hostname": "instagram.com",
        "visit_count": 95,
        "last_visit_time": "2026-01-01T14:20:00Z"
      },
      {
        "url": "https://mail.google.com/mail/u/0/#inbox",
        "title": "Inbox - Gmail",
        "hostname": "mail.google.com",
        "visit_count": 23,
        "last_visit_time": "2026-01-01T09:15:00Z"
      }
    ]
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Data saved. Analysis queued for 2026-01-01",
  "date": "2026-01-01",
  "items_count": 3
}
```

### Test 3: Get today's analysis
```bash
curl http://localhost:8000/api/v1/analysis/today/YOUR_USER_UUID_HERE
```

Expected response (while LLM not implemented):
```json
{
  "status": "pending",
  "message": "Analysis queued. Check back in a few seconds."
}
```

---

## ⚠️ Known Limitations

### 1. LLM Analysis Not Implemented Yet
- The `/browsing/today` endpoint saves data ✅
- Creates analysis placeholder with status 'pending' ✅
- **Background LLM processing NOT implemented yet** ❌

**TODO:**
```python
# In browsing.py line 135:
# background_tasks.add_task(process_llm_analysis, request.user_uuid, request.date, db)
```

This means:
- Data saves successfully
- Analysis status stays "pending"
- Need to implement the LLM background worker

### 2. Metrics Dashboard Error
```
metrics-dashboard.js:13
Cannot read properties of null (reading 'addEventListener')
```

**Fix needed:**
- Check if element exists before adding event listener
- OR ensure the HTML element is present

---

## 🎯 Current Status

| Feature | Status | Notes |
|---------|--------|-------|
| POST /browsing/today | ✅ Working | Saves to DB (needs Supabase tables) |
| GET /analysis/today/{uuid} | ⚠️ Partial | Returns status, LLM not implemented |
| POST /roast/{uuid} | ✅ Working | Uses existing RoastChain |
| POST /self-discovery/{uuid} | ✅ Working | Uses existing SelfDiscoveryChain |
| Frontend → Localhost | ✅ Fixed | Now points to http://localhost:8000 |
| Blue UI → White UI | ✅ Fixed | White background, black text |
| Database tables | ⏳ **PENDING** | **Run SQL in Supabase first!** |

---

## 🚀 Next Steps

1. **Run SQL in Supabase** (REQUIRED!)
2. **Reload extension** in Chrome
3. **Test `/browsing/today` endpoint** manually
4. **Test extension buttons** (View Analytics, Get Roasted, Self-Discovery)
5. **Implement LLM background worker** (see ASYNC_BACKEND_IMPLEMENTATION.md)

---

## 🐛 Debugging

### Check backend logs
```bash
# Logs are output to the terminal where backend is running
# Look for:
# ✅ Saved X items for user Y on date Z
# ❌ Error messages
```

### Check browser console
```
1. Open extension popup
2. Right-click → Inspect
3. Go to Console tab
4. Look for error messages
```

### Check Supabase tables
```sql
-- Check if data was saved
SELECT * FROM daily_browsing ORDER BY created_at DESC LIMIT 5;

-- Check analysis status
SELECT user_uuid, date, processing_status FROM daily_analysis ORDER BY created_at DESC LIMIT 5;
```

---

## ✅ Testing Checklist

- [ ] Ran SQL in Supabase to create tables
- [ ] Reloaded Chrome extension
- [ ] Backend server running at http://localhost:8000
- [ ] Tested health endpoint (`curl http://localhost:8000/health`)
- [ ] Tested `/browsing/today` with curl
- [ ] Tested "View Browsing Analytics" button
- [ ] Tested "Get Roasted" button
- [ ] Tested "Self-Discovery" button
- [ ] Checked Supabase tables for data

---

**Backend server is running. Ready to test!**
