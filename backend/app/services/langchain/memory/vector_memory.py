"""Vector memory management for semantic search using embeddings"""

from typing import List, Dict, Any, Optional
import logging
from langchain_openai import OpenAIEmbeddings
from supabase import Client

from app.config import settings

logger = logging.getLogger(__name__)


class QuirkVectorMemory:
    """Manages vector embeddings for semantic search"""

    def __init__(self, db_client: Client):
        self.db = db_client
        self.embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small"  # OpenAI's latest embedding model
        )

    async def add_pinterest_embeddings(
        self,
        user_uuid: str,
        pins: List[Dict]
    ):
        """
        Generate and store embeddings for Pinterest pins
        (WRITE-OPTIMIZED - called as background task)
        """
        try:
            if not pins:
                return

            # Prepare texts and metadata
            texts = []
            metadatas = []

            for pin in pins:
                # Combine all text fields
                text_parts = []
                if pin.get("title"):
                    text_parts.append(pin["title"])
                if pin.get("description"):
                    text_parts.append(pin["description"])
                if pin.get("category"):
                    text_parts.append(pin["category"])

                text = " ".join(text_parts).strip()

                if text:
                    texts.append(text)
                    metadatas.append({
                        "user_uuid": user_uuid,
                        "source_type": "pinterest",
                        "source_id": pin.get("id"),
                        "category": pin.get("category"),
                        "board_name": pin.get("board_name")
                    })

            if not texts:
                logger.warning("No text content to embed from Pinterest pins")
                return

            # Generate embeddings in batch
            embedding_vectors = await self.embeddings.aembed_documents(texts)

            # Insert into database
            embedding_records = []
            for i, (text, vector, metadata) in enumerate(zip(texts, embedding_vectors, metadatas)):
                embedding_records.append({
                    "user_uuid": user_uuid,
                    "source_type": "pinterest",
                    "source_id": metadata["source_id"],
                    "embedding_vector": vector,
                    "text_content": text[:500],  # Limit text storage
                    "metadata": metadata
                })

            # Batch insert (in chunks of 100 to avoid payload limits)
            chunk_size = 100
            for i in range(0, len(embedding_records), chunk_size):
                chunk = embedding_records[i:i + chunk_size]
                self.db.table("embeddings").insert(chunk).execute()

            logger.info(f"Added {len(embedding_records)} Pinterest embeddings for user {user_uuid}")

        except Exception as e:
            logger.error(f"Error adding Pinterest embeddings: {e}")

    async def add_browsing_embeddings(
        self,
        user_uuid: str,
        browsing_items: List[Dict]
    ):
        """
        Generate and store embeddings for browsing history
        (WRITE-OPTIMIZED - called as background task)
        """
        try:
            if not browsing_items:
                return

            # Prepare texts and metadata
            texts = []
            metadatas = []

            for item in browsing_items:
                # Combine URL and title
                text_parts = []
                if item.get("title"):
                    text_parts.append(item["title"])
                if item.get("url"):
                    # Extract domain and path for context
                    from urllib.parse import urlparse
                    parsed = urlparse(item["url"])
                    text_parts.append(f"{parsed.netloc} {parsed.path}")
                if item.get("platform"):
                    text_parts.append(item["platform"])

                text = " ".join(text_parts).strip()

                if text:
                    texts.append(text)
                    metadatas.append({
                        "user_uuid": user_uuid,
                        "source_type": "browsing",
                        "source_id": item.get("id"),
                        "platform": item.get("platform"),
                        "category": item.get("category")
                    })

            if not texts:
                logger.warning("No text content to embed from browsing history")
                return

            # Generate embeddings in batch
            embedding_vectors = await self.embeddings.aembed_documents(texts)

            # Insert into database
            embedding_records = []
            for text, vector, metadata in zip(texts, embedding_vectors, metadatas):
                embedding_records.append({
                    "user_uuid": user_uuid,
                    "source_type": "browsing",
                    "source_id": metadata["source_id"],
                    "embedding_vector": vector,
                    "text_content": text[:500],
                    "metadata": metadata
                })

            # Batch insert (in chunks)
            chunk_size = 100
            for i in range(0, len(embedding_records), chunk_size):
                chunk = embedding_records[i:i + chunk_size]
                self.db.table("embeddings").insert(chunk).execute()

            logger.info(f"Added {len(embedding_records)} browsing embeddings for user {user_uuid}")

        except Exception as e:
            logger.error(f"Error adding browsing embeddings: {e}")

    async def similarity_search(
        self,
        user_uuid: str,
        query: str,
        source_type: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search for similar content using vector similarity
        (READ-OPTIMIZED - fast semantic search)
        """
        try:
            # Generate query embedding
            query_embedding = await self.embeddings.aembed_query(query)

            # Build SQL query for vector similarity search
            # Note: This uses pgvector's <=> operator for cosine distance
            similarity_query = f"""
                SELECT
                    id,
                    user_uuid,
                    source_type,
                    source_id,
                    text_content,
                    metadata,
                    1 - (embedding_vector <=> '{query_embedding}') as similarity_score
                FROM embeddings
                WHERE user_uuid = '{user_uuid}'
                {"AND source_type = '" + source_type + "'" if source_type else ""}
                ORDER BY embedding_vector <=> '{query_embedding}'
                LIMIT {limit}
            """

            # Execute raw SQL query
            result = self.db.rpc("execute_sql", {"sql": similarity_query}).execute()

            if result.data:
                logger.info(f"Found {len(result.data)} similar items for query: '{query[:50]}...'")
                return result.data
            else:
                # Fallback: use stored procedure if available
                logger.warning("Direct SQL query failed, using fallback method")
                return []

        except Exception as e:
            logger.error(f"Error in similarity search: {e}")
            return []

    async def get_user_embedding_stats(self, user_uuid: str) -> Dict[str, int]:
        """Get statistics about user's embeddings"""
        try:
            result = self.db.table("embeddings").select(
                "source_type", count="exact"
            ).eq("user_uuid", user_uuid).execute()

            stats = {
                "total": result.count if result.count else 0,
                "pinterest": 0,
                "browsing": 0
            }

            if result.data:
                for item in result.data:
                    source_type = item.get("source_type", "unknown")
                    # This is a simplified version - actual aggregation would be done in SQL
                    if source_type == "pinterest":
                        stats["pinterest"] += 1
                    elif source_type == "browsing":
                        stats["browsing"] += 1

            return stats

        except Exception as e:
            logger.error(f"Error getting embedding stats: {e}")
            return {"total": 0, "pinterest": 0, "browsing": 0}
