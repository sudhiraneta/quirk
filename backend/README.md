# Quirk Backend API

FastAPI backend for Quirk personality analysis Chrome extension.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

Required variables:
- `OPENAI_API_KEY` - Get from https://platform.openai.com/api-keys
- `SUPABASE_URL` - Get from Supabase dashboard
- `SUPABASE_KEY` - Anon/public key from Supabase

### 3. Set Up Database

1. Create a Supabase project
2. Run `database_setup.sql` in the Supabase SQL Editor
3. Verify tables created

### 4. Run Server

```bash
python -m app.main
```

Server runs on http://localhost:8000  
API docs: http://localhost:8000/docs

## 📝 See Main README

For complete documentation, see the [main README](../README.md) in the project root.

---

**Built with FastAPI, LangChain, and GPT-4o**
