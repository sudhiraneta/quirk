# Quirk 🎭

**AI-Powered Personality Analyzer for Pinterest & Browsing Data**

Quirk is a Chrome extension that analyzes your Pinterest boards and browsing habits to generate witty personality insights using GPT-4o. Get roasted, discover yourself, or chat with an AI friend who knows your digital vibe.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Python](https://img.shields.io/badge/python-3.10+-green)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-teal)
![License](https://img.shields.io/badge/license-MIT-orange)

## ✨ Features

### 🔥 Three Analysis Modes

1. **Roast Mode** - Fast, witty personality roasts based on your digital footprint
2. **Self-Discovery Mode** - Deep insights with actionable recommendations
3. **Friend Mode** - Conversational AI that knows your vibe

### 🎯 What It Analyzes

- Pinterest boards, pins, and saved content
- Browsing history across platforms (Instagram, YouTube, TikTok, etc.)
- Time spent on different platforms
- Content categories and interests

### 🧠 Powered By

- **OpenAI GPT-4o** - Advanced personality analysis
- **LangChain** - Structured LLM workflows
- **Supabase** - PostgreSQL database with pgvector for embeddings
- **Redis** - Fast response caching (1 hour for roasts, 10 min for discovery)

---

## 🏗️ Project Structure

```
quirk/
├── quirk/                      # Chrome Extension
│   ├── manifest.json           # Extension config (v3)
│   ├── popup.js                # Extension UI logic
│   ├── content-script.js       # Pinterest data extraction
│   ├── personality-templates.js # Personality archetypes
│   └── shared/
│       └── constants.js        # API endpoints & config
│
├── backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── main.py            # FastAPI app entry point
│   │   ├── config.py          # Settings & environment vars
│   │   ├── api/v1/endpoints/  # API routes
│   │   │   ├── users.py       # User initialization
│   │   │   ├── pinterest.py   # Pinterest data ingestion
│   │   │   ├── browsing.py    # Browsing history
│   │   │   ├── analysis.py    # Roast & self-discovery
│   │   │   └── conversation.py # Friend mode chat
│   │   ├── services/langchain/ # LLM chains & prompts
│   │   │   ├── chains/
│   │   │   │   ├── base_chain.py          # Context preparation
│   │   │   │   ├── roast_chain.py         # Roast analysis
│   │   │   │   ├── self_discovery_chain.py # Deep insights
│   │   │   │   └── friend_chain.py        # Conversational AI
│   │   │   └── prompts/        # LLM prompt templates
│   │   ├── db/
│   │   │   └── supabase_client.py # Database connection
│   │   └── core/
│   │       ├── cache.py       # Redis caching
│   │       └── logging.py     # Logging config
│   ├── database_setup.sql     # Database schema
│   ├── requirements.txt       # Python dependencies
│   └── .env.example          # Environment template
│
└── README.md                  # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Chrome Browser
- Supabase Account (free tier works)
- OpenAI API Key
- Redis (optional, for caching)

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/quirk.git
cd quirk
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys (see Configuration section)
```

### 3. Database Setup

1. Create a Supabase project at https://supabase.com
2. Go to SQL Editor in your Supabase dashboard
3. Run the entire `backend/database_setup.sql` script
4. This creates 7 tables with indexes and RLS policies

### 4. Start Backend Server

```bash
cd backend
source venv/bin/activate
python -m app.main

# Server runs on http://localhost:8000
# API docs: http://localhost:8000/docs
```

### 5. Install Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `quirk/` directory
5. Extension installed! 🎉

---

## ⚙️ Configuration

### Backend Environment Variables

Create `backend/.env` with the following:

```bash
# OpenAI API
OPENAI_API_KEY=sk-proj-your-openai-api-key-here

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key-here

# Redis (optional - defaults work for local Redis)
REDIS_URL=redis://localhost:6379

# App Settings
APP_ENV=development
DEBUG=True
API_BASE_URL=http://localhost:8000
```

**Get Your API Keys:**
- **OpenAI:** https://platform.openai.com/api-keys
- **Supabase URL & Key:** https://supabase.com/dashboard → Your Project → Settings → API

### Extension Configuration

Update `quirk/shared/constants.js`:

```javascript
const API_BASE_URL = "http://localhost:8000/api/v1";
// For production, change to your deployed backend URL
```

---

## 📊 Database Schema

The application uses 7 tables:

| Table | Purpose |
|-------|---------|
| `users` | User metadata with UUIDs |
| `browsing_history` | Website visits, categories, time spent |
| `pinterest_pins` | Pin titles, descriptions, boards, categories |
| `embeddings` | Vector embeddings for semantic search (pgvector) |
| `analyses` | Stored analysis results (roast, self-discovery, friend) |
| `conversations` | Friend mode chat sessions |
| `conversation_messages` | Individual chat messages |

**Key Features:**
- pgvector extension for semantic similarity search
- Optimized indexes on user_uuid, timestamps, categories
- Row Level Security (RLS) policies enabled
- Helper functions for incrementing counters

---

## 🔌 API Endpoints

### Users
- `POST /api/v1/users/initialize` - Create new user
- `GET /api/v1/users/{user_uuid}/status` - Get user stats

### Data Collection
- `POST /api/v1/browsing/history` - Save browsing history (batch)
- `POST /api/v1/pinterest/pins` - Save Pinterest pins (batch)

### Analysis
- `POST /api/v1/analysis/roast` - Generate roast (cached 1 hour)
- `POST /api/v1/analysis/self-discovery` - Generate deep insights (cached 10 min)

### Friend Mode
- `POST /api/v1/conversation/message` - Send chat message
- `GET /api/v1/conversation/{id}/history` - Get conversation history

**Full API Documentation:** http://localhost:8000/docs (when server is running)

---

## 🎭 How It Works

### 1. Data Collection (Write-Optimized)

```
User browses Pinterest/web
    ↓
Extension captures data
    ↓
Batch sent to backend
    ↓
Stored in Supabase (fast inserts)
    ↓
Embeddings queued (background task)
```

### 2. Analysis Generation (Read-Optimized)

```
User requests analysis
    ↓
Check Redis cache (hit = instant return)
    ↓
Fetch user data from DB
    ↓
Aggregate & summarize data
    ↓
Generate LLM prompt with context
    ↓
Call GPT-4o via LangChain
    ↓
Parse & validate JSON response
    ↓
Cache result (Redis)
    ↓
Return to user
```

### 3. Performance Optimizations

- **Caching:** Redis stores analyses (1hr roast, 10min discovery)
- **Database Indexes:** Fast queries on user_uuid, timestamps, categories
- **Batch Inserts:** Browsing/Pinterest data saved in bulk
- **Background Tasks:** Embedding generation queued asynchronously
- **Data Summarization:** Token optimization before LLM calls

---

## 🛠️ Development

### Running Tests

```bash
cd backend
pytest
```

### Code Quality

The codebase follows:
- **FastAPI** best practices with dependency injection
- **Pydantic** models for request/response validation (40+ schemas)
- **Async/await** for non-blocking I/O operations
- **Structured logging** for debugging
- **Type hints** throughout Python code

### Architecture Decisions

**Why LangChain?**
- Structured prompt management
- Easy LLM swapping (GPT-4o → Claude, etc.)
- Built-in retry logic and error handling
- Conversation memory for Friend mode

**Why Supabase?**
- Managed PostgreSQL with pgvector
- Built-in auth (future feature)
- Real-time subscriptions (future feature)
- Free tier is generous

**Why Redis?**
- Sub-millisecond cache lookups
- Automatic TTL expiration
- Graceful degradation if unavailable

---

## 📦 Deployment

### Backend Deployment Options

**Recommended: Railway / Render**

```bash
# Railway
railway login
railway init
railway up

# Render
# Connect GitHub repo, set environment variables via dashboard
```

**Docker:**

```dockerfile
# Coming soon - Dockerfile included in next release
```

**Environment Variables for Production:**
- Set `APP_ENV=production`
- Set `DEBUG=False`
- Use production Supabase URL
- Secure OpenAI API key (use secrets manager)

### Extension Deployment

1. Update `quirk/shared/constants.js` with production API URL
2. Zip the `quirk/` directory
3. Submit to Chrome Web Store

---

## 🔐 Security

**Important Security Practices:**

✅ **DO:**
- Keep `.env` file in `.gitignore` (already configured)
- Rotate API keys regularly
- Use environment variables for all secrets
- Enable Supabase RLS policies in production
- Use HTTPS for production backend

❌ **DON'T:**
- Commit `.env` files to Git
- Share API keys in code or screenshots
- Use service_role keys in frontend
- Disable RLS without proper auth

**Current Security Status:**
- ⚠️ RLS policies are permissive (`USING (true)`) - restrict in production
- ⚠️ No user authentication - add in production
- ✅ API keys loaded from environment variables
- ✅ CORS configured for Chrome extensions

---

## 📝 TODO / Roadmap

- [ ] Embedding generation background tasks (defined but not implemented)
- [ ] User authentication system
- [ ] Service worker for extension background tasks
- [ ] Materialized views for analytics dashboard
- [ ] Quality metrics and evaluation framework
- [ ] Docker deployment support
- [ ] Rate limiting for API endpoints
- [ ] Email notifications for insights
- [ ] Export data feature (JSON, PDF)
- [ ] Multi-language support

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

- **OpenAI** for GPT-4o API
- **LangChain** for LLM framework
- **Supabase** for managed PostgreSQL
- **FastAPI** for the amazing web framework

---

## 📞 Support

- **Issues:** https://github.com/yourusername/quirk/issues
- **Discussions:** https://github.com/yourusername/quirk/discussions

---

**Built with ❤️ by Sudhira Badugu**

*Quirk: Because your Pinterest boards say more about you than your LinkedIn profile.*
