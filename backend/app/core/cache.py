"""Redis cache manager"""

import redis.asyncio as redis
import json
from typing import Optional, Any
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class RedisCache:
    """Redis cache manager for application-level caching"""

    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None

    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis_client = await redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis_client.ping()
            logger.info("Connected to Redis successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.redis_client = None

    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Disconnected from Redis")

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.redis_client:
            return None

        try:
            value = await self.redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Redis GET error: {e}")
            return None

    async def set(self, key: str, value: Any, expire: int = 3600):
        """Set value in cache with expiration (seconds)"""
        if not self.redis_client:
            return False

        try:
            await self.redis_client.set(
                key,
                json.dumps(value),
                ex=expire
            )
            return True
        except Exception as e:
            logger.error(f"Redis SET error: {e}")
            return False

    async def delete(self, key: str):
        """Delete key from cache"""
        if not self.redis_client:
            return False

        try:
            await self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis DELETE error: {e}")
            return False

    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if not self.redis_client:
            return False

        try:
            return await self.redis_client.exists(key) > 0
        except Exception as e:
            logger.error(f"Redis EXISTS error: {e}")
            return False


# Global cache instance
redis_cache = RedisCache()
