-- RUN THIS IN SUPABASE SQL EDITOR
-- Required for backend to work

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

CREATE TABLE IF NOT EXISTS daily_browsing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    raw_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_uuid, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_browsing_user_date ON daily_browsing(user_uuid, date);

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
