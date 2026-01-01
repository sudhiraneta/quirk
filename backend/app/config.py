"""Application configuration"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # API Settings
    app_name: str = "Quirk API"
    app_version: str = "2.0.0"
    app_env: str = "development"
    debug: bool = True
    api_base_url: str = "http://localhost:8000"

    # OpenAI
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"  # Faster model for better latency

    # Supabase
    supabase_url: str
    supabase_key: str

    # Redis
    redis_url: str = "redis://localhost:6379"
    redis_ttl_roast: int = 3600  # 1 hour
    redis_ttl_discovery: int = 600  # 10 minutes

    # Database
    database_pool_size: int = 10
    database_max_overflow: int = 20

    # LLM Settings
    llm_temperature: float = 0.7
    llm_max_tokens: int = 250  # Reduced for concise 5-7 line outputs

    # Data Collection
    browsing_history_days: int = 7  # Reduced from 30 for faster queries
    max_pins_for_analysis: int = 100  # Reduced from 500 for speed

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
