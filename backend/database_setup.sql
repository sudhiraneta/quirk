-- Quirk Database Setup for Supabase
-- Run this SQL in your Supabase SQL Editor

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Tables
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    extension_version VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_data_points INTEGER DEFAULT 0,
    total_analyses INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);

-- Browsing history table
CREATE TABLE IF NOT EXISTS browsing_history (
    id BIGSERIAL PRIMARY KEY,
    user_uuid UUID REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    visit_count INTEGER DEFAULT 1,
    last_visit TIMESTAMP WITH TIME ZONE NOT NULL,
    time_spent_seconds INTEGER,
    category VARCHAR(50), -- social_media, shopping, video, etc.
    platform VARCHAR(50), -- instagram, youtube, amazon, etc.
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_browsing_user_uuid ON browsing_history(user_uuid);
CREATE INDEX IF NOT EXISTS idx_browsing_last_visit ON browsing_history(last_visit);
CREATE INDEX IF NOT EXISTS idx_browsing_category ON browsing_history(category);
CREATE INDEX IF NOT EXISTS idx_browsing_platform ON browsing_history(platform);
CREATE INDEX IF NOT EXISTS idx_browsing_user_last_visit ON browsing_history(user_uuid, last_visit DESC);

-- Pinterest pins table
CREATE TABLE IF NOT EXISTS pinterest_pins (
    id BIGSERIAL PRIMARY KEY,
    user_uuid UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    alt_text TEXT,
    board_name VARCHAR(255),
    category VARCHAR(100),
    full_text TEXT,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pins_user_uuid ON pinterest_pins(user_uuid);
CREATE INDEX IF NOT EXISTS idx_pins_collected_at ON pinterest_pins(collected_at);
CREATE INDEX IF NOT EXISTS idx_pins_category ON pinterest_pins(category);

-- Embeddings table (for vector search)
CREATE TABLE IF NOT EXISTS embeddings (
    id BIGSERIAL PRIMARY KEY,
    user_uuid UUID REFERENCES users(id) ON DELETE CASCADE,
    source_type VARCHAR(50), -- 'pinterest', 'browsing'
    source_id BIGINT,
    embedding_vector vector(1536), -- OpenAI embedding dimension
    text_content TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_user_uuid ON embeddings(user_uuid);
CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_type, source_id);
-- Vector similarity index (requires pgvector extension)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding_vector vector_cosine_ops) WITH (lists = 100);

-- Analyses table
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(20) NOT NULL, -- roast, self_discovery, friend
    input_data JSONB,
    output_data JSONB,
    llm_model VARCHAR(50),
    token_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyses_user_uuid ON analyses(user_uuid);
CREATE INDEX IF NOT EXISTS idx_analyses_mode ON analyses(mode);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at);
CREATE INDEX IF NOT EXISTS idx_analyses_user_mode_created ON analyses(user_uuid, mode, created_at DESC);

-- Conversations table (for friend mode)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    message_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_uuid ON conversations(user_uuid);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- Conversation messages table
CREATE TABLE IF NOT EXISTS conversation_messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    context_used JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON conversation_messages(created_at);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to increment user data points
CREATE OR REPLACE FUNCTION increment_user_data_points(user_id UUID, increment_by INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET total_data_points = total_data_points + increment_by,
        last_active = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment user analyses count
CREATE OR REPLACE FUNCTION increment_user_analyses(user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET total_analyses = total_analyses + 1,
        last_active = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Row Level Security (RLS) - Optional but recommended
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE browsing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinterest_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now - adjust as needed)
CREATE POLICY "Enable all operations for all users" ON users FOR ALL USING (true);
CREATE POLICY "Enable all operations for browsing_history" ON browsing_history FOR ALL USING (true);
CREATE POLICY "Enable all operations for pinterest_pins" ON pinterest_pins FOR ALL USING (true);
CREATE POLICY "Enable all operations for embeddings" ON embeddings FOR ALL USING (true);
CREATE POLICY "Enable all operations for analyses" ON analyses FOR ALL USING (true);
CREATE POLICY "Enable all operations for conversations" ON conversations FOR ALL USING (true);
CREATE POLICY "Enable all operations for conversation_messages" ON conversation_messages FOR ALL USING (true);

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify tables created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verify pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Test data insertion (optional)
-- INSERT INTO users (extension_version) VALUES ('2.0.0');
