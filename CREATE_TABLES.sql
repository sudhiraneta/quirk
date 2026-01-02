-- RUN THIS IN SUPABASE SQL EDITOR
-- Required for backend to work

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
