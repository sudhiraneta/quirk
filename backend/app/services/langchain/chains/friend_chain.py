"""Friend mode chain - Conversational AI with empathy and context"""

from typing import Dict, Any, List, Optional
import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage
from supabase import Client

from app.config import settings
from app.services.langchain.chains.base_chain import QuirkBaseChain
from app.services.langchain.prompts.friend_prompts import get_friend_prompt
from app.models.enums import MessageRole

logger = logging.getLogger(__name__)


class FriendChain(QuirkBaseChain):
    """Conversational chain with empathy and context awareness"""

    def __init__(self, db_client: Client):
        super().__init__(db_client)
        self.llm = ChatOpenAI(
            model=settings.openai_model,
            temperature=0.8,  # More creative for natural conversation
            max_tokens=500,    # Conversational responses should be concise
            api_key=settings.openai_api_key
        )

    async def chat(
        self,
        user_uuid: str,
        message: str,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Handle conversational message with context and memory
        Returns: conversation_id, message, tone, context_used
        """
        try:
            # 1. Load conversation history if exists
            chat_history = []
            if conversation_id:
                chat_history = await self._load_conversation_history(conversation_id)

            # 2. Get relevant user context based on message
            user_context = await self._get_user_summary(user_uuid)
            relevant_context = await self._get_relevant_context(user_uuid, message)

            # 3. Build prompt with context and history
            prompt = get_friend_prompt()

            # Format chat history for LangChain
            formatted_history = []
            for msg in chat_history:
                if msg["role"] == "user":
                    formatted_history.append(HumanMessage(content=msg["content"]))
                else:
                    formatted_history.append(AIMessage(content=msg["content"]))

            # 4. Run conversation chain
            chain = prompt | self.llm
            result = await chain.ainvoke({
                "user_context_summary": user_context,
                "relevant_context": relevant_context,
                "chat_history": formatted_history,
                "input": message
            })

            response_message = result.content.strip()

            # 5. Determine tone (simple heuristic)
            tone = self._detect_tone(message, response_message)

            # 6. Context sources used
            context_sources = []
            if "pinterest" in relevant_context.lower():
                context_sources.append("pinterest_pins")
            if "browsing" in relevant_context.lower() or "platform" in relevant_context.lower():
                context_sources.append("browsing_history")

            logger.info(f"Generated friend mode response for conversation {conversation_id}")

            return {
                "message": response_message,
                "tone": tone,
                "context_used": context_sources
            }

        except Exception as e:
            logger.error(f"Error in friend chat: {e}")
            return self._get_fallback_response(message)

    async def _load_conversation_history(self, conversation_id: str) -> List[Dict]:
        """Load conversation messages from database"""
        try:
            result = self.db.table("conversation_messages").select("*").eq(
                "conversation_id", conversation_id
            ).order("created_at").execute()

            messages = []
            if result.data:
                for msg in result.data:
                    messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })

            logger.info(f"Loaded {len(messages)} messages from conversation {conversation_id}")
            return messages

        except Exception as e:
            logger.error(f"Error loading conversation history: {e}")
            return []

    async def _get_user_summary(self, user_uuid: str) -> str:
        """Get a brief summary of user's digital behavior"""
        try:
            # Get quick stats
            context = await self.prepare_context(
                user_uuid,
                include_pinterest=True,
                include_browsing=True,
                limit=100  # Limited for summary
            )

            summary_parts = []

            # Pinterest interests
            if context.get("pinterest"):
                top_categories = []
                for pin in context["pinterest"][:10]:
                    if pin.get("category"):
                        top_categories.append(pin["category"])

                if top_categories:
                    from collections import Counter
                    common_cats = Counter(top_categories).most_common(3)
                    cats_str = ", ".join([cat for cat, _ in common_cats])
                    summary_parts.append(f"Pinterest interests: {cats_str}")

            # Browsing habits
            if context.get("browsing", {}).get("top_platforms"):
                platforms = context["browsing"]["top_platforms"][:3]
                summary_parts.append(f"Active on: {', '.join(platforms)}")

            # Keywords
            if context.get("keywords"):
                keywords_str = ", ".join(context["keywords"][:5])
                summary_parts.append(f"Key themes: {keywords_str}")

            if summary_parts:
                return " | ".join(summary_parts)
            else:
                return "Getting to know your digital patterns"

        except Exception as e:
            logger.error(f"Error getting user summary: {e}")
            return "New user exploring digital spaces"

    async def _get_relevant_context(self, user_uuid: str, message: str) -> str:
        """
        Get context relevant to the user's message
        TODO: Implement vector similarity search for better context retrieval
        For now, return general context
        """
        try:
            # Simple keyword matching for now
            message_lower = message.lower()

            context_parts = []

            # Check if message relates to specific topics
            if any(word in message_lower for word in ["pinterest", "pins", "saved", "board"]):
                context = await self.prepare_context(user_uuid, include_pinterest=True, include_browsing=False, limit=50)
                if context.get("pinterest"):
                    context_parts.append(f"Recent Pinterest activity: {len(context['pinterest'])} pins saved")

            if any(word in message_lower for word in ["browse", "watch", "spend time", "online"]):
                context = await self.prepare_context(user_uuid, include_pinterest=False, include_browsing=True, limit=50)
                if context.get("browsing", {}).get("top_platforms"):
                    platforms = ", ".join(context["browsing"]["top_platforms"][:3])
                    context_parts.append(f"Most active platforms: {platforms}")

            if context_parts:
                return " | ".join(context_parts)
            else:
                return "General browsing and interest patterns available"

        except Exception as e:
            logger.error(f"Error getting relevant context: {e}")
            return "Context available but not directly relevant to this message"

    def _detect_tone(self, user_message: str, assistant_response: str) -> str:
        """Simple tone detection based on message content"""
        user_message_lower = user_message.lower()
        response_lower = assistant_response.lower()

        # Check for emotional keywords
        if any(word in user_message_lower for word in ["sad", "worried", "anxious", "stressed", "overwhelmed"]):
            return "empathetic"
        elif any(word in user_message_lower for word in ["happy", "excited", "great", "awesome"]):
            return "celebratory"
        elif "?" in user_message:
            return "helpful"
        elif any(word in response_lower for word in ["notice", "pattern", "seems like"]):
            return "observant"
        else:
            return "supportive"

    def _get_fallback_response(self, message: str) -> Dict[str, Any]:
        """Fallback response if LLM fails"""
        return {
            "message": "Thanks for sharing that with me! I'm here to listen and help however I can. Tell me more about what's on your mind.",
            "tone": "supportive",
            "context_used": []
        }
