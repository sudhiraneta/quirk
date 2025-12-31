"""Pydantic schemas for API requests and responses"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.models.enums import AnalysisMode, BrowsingCategory, MessageRole


# ============================================================================
# Request Schemas
# ============================================================================

class UserInitRequest(BaseModel):
    """Request to initialize a new user"""
    extension_version: str = Field(..., description="Extension version")


class BrowsingHistoryItem(BaseModel):
    """Single browsing history item"""
    url: str = Field(..., description="Page URL")
    title: Optional[str] = Field(None, description="Page title")
    visit_count: int = Field(1, description="Number of visits")
    last_visit: datetime = Field(..., description="Last visit timestamp")
    time_spent_seconds: Optional[int] = Field(None, description="Time spent on page")
    category: BrowsingCategory = Field(..., description="Category of website")
    platform: Optional[str] = Field(None, description="Platform name (e.g., instagram, youtube)")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class BrowsingHistoryRequest(BaseModel):
    """Request to save browsing history"""
    user_uuid: str = Field(..., description="User UUID")
    history: List[BrowsingHistoryItem] = Field(..., description="List of browsing history items")


class PinterestPin(BaseModel):
    """Single Pinterest pin"""
    title: Optional[str] = Field(None, description="Pin title")
    description: Optional[str] = Field(None, description="Pin description")
    alt_text: Optional[str] = Field(None, description="Image alt text")
    board_name: Optional[str] = Field(None, description="Board name")
    category: Optional[str] = Field(None, description="Pin category")


class PinterestPinsRequest(BaseModel):
    """Request to save Pinterest pins"""
    user_uuid: str = Field(..., description="User UUID")
    pins: List[PinterestPin] = Field(..., description="List of Pinterest pins")


class RoastAnalysisRequest(BaseModel):
    """Request for roast mode analysis"""
    user_uuid: str = Field(..., description="User UUID")
    include_pinterest: bool = Field(True, description="Include Pinterest data in analysis")
    include_browsing: bool = Field(True, description="Include browsing history in analysis")


class SelfDiscoveryRequest(BaseModel):
    """Request for self-discovery mode analysis"""
    user_uuid: str = Field(..., description="User UUID")
    focus_areas: Optional[List[str]] = Field(
        None,
        description="Focus areas for analysis (e.g., career, relationships, hobbies)"
    )


class ConversationMessageRequest(BaseModel):
    """Request to send a message in friend mode"""
    user_uuid: str = Field(..., description="User UUID")
    message: str = Field(..., description="User's message")
    conversation_id: Optional[str] = Field(None, description="Conversation ID (optional for new conversation)")


class FeedbackRequest(BaseModel):
    """Request to submit user feedback"""
    analysis_id: str = Field(..., description="Analysis ID")
    user_uuid: str = Field(..., description="User UUID")
    rating: int = Field(..., ge=1, le=5, description="Rating from 1-5")
    feedback_text: Optional[str] = Field(None, description="Optional feedback text")


# ============================================================================
# Response Schemas
# ============================================================================

class UserInitResponse(BaseModel):
    """Response for user initialization"""
    user_uuid: str = Field(..., description="Generated user UUID")
    created_at: datetime = Field(..., description="Creation timestamp")


class DataSaveResponse(BaseModel):
    """Generic response for data save operations"""
    status: str = Field(..., description="Status (success/error)")
    processed_count: int = Field(..., description="Number of items processed")
    message: Optional[str] = Field(None, description="Optional message")


class PersonalityBreakdown(BaseModel):
    """Personality trait breakdown"""
    trait: str = Field(..., description="Trait name")
    percentage: int = Field(..., ge=0, le=100, description="Percentage (0-100)")


class DataSummary(BaseModel):
    """Summary of data used for analysis"""
    pinterest_pins_analyzed: int = Field(0, description="Number of Pinterest pins analyzed")
    browsing_days_analyzed: int = Field(0, description="Number of days of browsing history analyzed")
    top_platforms: List[str] = Field(default_factory=list, description="Top platforms")
    total_data_points: int = Field(0, description="Total data points analyzed")


class RoastAnalysisResponse(BaseModel):
    """Response for roast mode analysis"""
    mode: AnalysisMode = Field(AnalysisMode.ROAST, description="Analysis mode")
    personality_name: str = Field(..., description="Creative personality archetype name")
    roast: str = Field(..., description="Witty roast text")
    vibe_check: str = Field(..., description="One-liner vibe check")
    breakdown: List[PersonalityBreakdown] = Field(..., description="Personality breakdown")
    data_summary: DataSummary = Field(..., description="Summary of data analyzed")
    analysis_id: str = Field(..., description="Analysis ID for reference")
    created_at: datetime = Field(..., description="Creation timestamp")


class Insight(BaseModel):
    """Single insight from self-discovery analysis"""
    category: str = Field(..., description="Insight category")
    observation: str = Field(..., description="Main observation")
    patterns: List[str] = Field(..., description="Identified patterns")
    psychological_drivers: str = Field(..., description="What motivates this behavior")


class Trends(BaseModel):
    """Trend analysis over time"""
    analysis: str = Field(..., description="Trend analysis text")
    personality_evolution: Optional[str] = Field(None, description="How personality has evolved")
    interest_shifts: Optional[List[str]] = Field(None, description="Interest shifts detected")


class SelfDiscoveryResponse(BaseModel):
    """Response for self-discovery mode analysis"""
    mode: AnalysisMode = Field(AnalysisMode.SELF_DISCOVERY, description="Analysis mode")
    insights: List[Insight] = Field(..., description="List of insights")
    trends: Trends = Field(..., description="Trend analysis")
    action_items: List[str] = Field(..., description="Actionable recommendations")
    data_summary: DataSummary = Field(..., description="Summary of data analyzed")
    analysis_id: str = Field(..., description="Analysis ID for reference")
    created_at: datetime = Field(..., description="Creation timestamp")


class ConversationMessageResponse(BaseModel):
    """Response for conversation message"""
    conversation_id: str = Field(..., description="Conversation ID")
    message: str = Field(..., description="Assistant's response message")
    tone: str = Field(..., description="Tone of the response")
    context_used: List[str] = Field(..., description="List of context sources used")
    created_at: datetime = Field(..., description="Creation timestamp")


class ConversationMessage(BaseModel):
    """Single conversation message"""
    role: MessageRole = Field(..., description="Message role")
    content: str = Field(..., description="Message content")
    timestamp: datetime = Field(..., description="Message timestamp")


class ConversationHistoryResponse(BaseModel):
    """Response for conversation history"""
    conversation_id: str = Field(..., description="Conversation ID")
    messages: List[ConversationMessage] = Field(..., description="List of messages")
    started_at: datetime = Field(..., description="Conversation start time")


class AnalysisHistoryItem(BaseModel):
    """Single analysis history item"""
    id: str = Field(..., description="Analysis ID")
    mode: AnalysisMode = Field(..., description="Analysis mode")
    created_at: datetime = Field(..., description="Creation timestamp")
    summary: str = Field(..., description="Brief summary of analysis")


class AnalysisHistoryResponse(BaseModel):
    """Response for analysis history"""
    analyses: List[AnalysisHistoryItem] = Field(..., description="List of past analyses")
    total_count: int = Field(..., description="Total number of analyses")


class UserStatsResponse(BaseModel):
    """Response for user statistics"""
    user_uuid: str = Field(..., description="User UUID")
    data_points_collected: int = Field(..., description="Total data points collected")
    analyses_count: int = Field(..., description="Total number of analyses")
    conversations_count: int = Field(..., description="Total number of conversations")
    created_at: datetime = Field(..., description="Account creation date")
    last_active: datetime = Field(..., description="Last activity timestamp")


class EvaluationMetrics(BaseModel):
    """Evaluation metrics response"""
    accuracy_score: float = Field(..., ge=0.0, le=1.0, description="Accuracy score")
    consistency_score: float = Field(..., ge=0.0, le=1.0, description="Consistency score")
    engagement_rate: float = Field(..., ge=0.0, le=1.0, description="Engagement rate")
    avg_quality_score: float = Field(..., ge=0.0, le=1.0, description="Average quality score")


class HealthCheckResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., description="Health status")
    version: str = Field(..., description="API version")
    environment: str = Field(..., description="Environment")
