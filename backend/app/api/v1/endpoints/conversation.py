"""Conversation endpoints (friend mode)"""

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
import uuid
import logging

from app.models.schemas import (
    ConversationMessageRequest, ConversationMessageResponse,
    ConversationHistoryResponse, ConversationMessage
)
from app.models.enums import MessageRole
from app.db.supabase_client import get_supabase
from app.services.langchain.chains.friend_chain import FriendChain
from supabase import Client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/message", response_model=ConversationMessageResponse)
async def send_message(
    request: ConversationMessageRequest,
    db: Client = Depends(get_supabase)
):
    """
    Send a message in friend mode (conversational AI)
    - Load conversation history
    - Generate contextual response via FriendChain
    - Save message exchange
    """
    try:
        conversation_id = request.conversation_id

        # Create new conversation if needed
        if not conversation_id:
            conv_result = db.table("conversations").insert({
                "user_uuid": request.user_uuid,
                "started_at": datetime.utcnow().isoformat(),
                "last_message_at": datetime.utcnow().isoformat(),
                "message_count": 0
            }).execute()

            conversation_id = conv_result.data[0]["id"] if conv_result.data else None

        # Initialize friend chain
        friend_chain = FriendChain(db)

        # Generate response using LangChain
        chat_response = await friend_chain.chat(
            user_uuid=request.user_uuid,
            message=request.message,
            conversation_id=conversation_id
        )

        assistant_message = chat_response["message"]
        tone = chat_response["tone"]
        context_used = chat_response["context_used"]

        # Save user message
        db.table("conversation_messages").insert({
            "conversation_id": conversation_id,
            "role": MessageRole.USER.value,
            "content": request.message,
            "created_at": datetime.utcnow().isoformat()
        }).execute()

        # Save assistant message
        db.table("conversation_messages").insert({
            "conversation_id": conversation_id,
            "role": MessageRole.ASSISTANT.value,
            "content": assistant_message,
            "context_used": {"sources": context_used},
            "created_at": datetime.utcnow().isoformat()
        }).execute()

        # Update conversation metadata
        db.table("conversations").update({
            "last_message_at": datetime.utcnow().isoformat(),
            "message_count": 2  # Simple increment for now
        }).eq("id", conversation_id).execute()

        logger.info(f"Processed message in conversation {conversation_id}")

        return ConversationMessageResponse(
            conversation_id=conversation_id,
            message=assistant_message,
            tone=tone,
            context_used=context_used,
            created_at=datetime.utcnow()
        )

    except Exception as e:
        logger.error(f"Error processing conversation message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{conversation_id}/history", response_model=ConversationHistoryResponse)
async def get_conversation_history(
    conversation_id: str,
    db: Client = Depends(get_supabase)
):
    """Get conversation history"""
    try:
        # Get conversation metadata
        conv_result = db.table("conversations").select("*").eq("id", conversation_id).execute()

        if not conv_result.data:
            raise HTTPException(status_code=404, detail="Conversation not found")

        conversation = conv_result.data[0]

        # Get messages
        messages_result = db.table("conversation_messages").select("*").eq(
            "conversation_id", conversation_id
        ).order("created_at").execute()

        messages = [
            ConversationMessage(
                role=MessageRole(msg["role"]),
                content=msg["content"],
                timestamp=datetime.fromisoformat(msg["created_at"])
            )
            for msg in messages_result.data
        ] if messages_result.data else []

        return ConversationHistoryResponse(
            conversation_id=conversation_id,
            messages=messages,
            started_at=datetime.fromisoformat(conversation["started_at"])
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching conversation history: {e}")
        raise HTTPException(status_code=500, detail=str(e))
