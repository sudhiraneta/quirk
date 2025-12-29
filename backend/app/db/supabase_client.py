"""Supabase client for database operations"""

from supabase import create_client, Client
from typing import Optional
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class SupabaseClient:
    """Supabase database client wrapper"""

    def __init__(self):
        self.client: Optional[Client] = None

    def init_client(self):
        """Initialize Supabase client"""
        try:
            self.client = create_client(
                settings.supabase_url,
                settings.supabase_key
            )
            logger.info("Supabase client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            raise

    def get_client(self) -> Client:
        """Get Supabase client instance"""
        if not self.client:
            self.init_client()
        return self.client


# Global Supabase client instance
supabase_client = SupabaseClient()


def get_supabase() -> Client:
    """Dependency to get Supabase client"""
    return supabase_client.get_client()
