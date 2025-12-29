"""Enums for the application"""

from enum import Enum


class AnalysisMode(str, Enum):
    """Analysis mode types"""
    ROAST = "roast"
    SELF_DISCOVERY = "self_discovery"
    FRIEND = "friend"


class BrowsingCategory(str, Enum):
    """Browsing history category types"""
    SOCIAL_MEDIA = "social_media"
    SHOPPING = "shopping"
    VIDEO = "video"
    NEWS = "news"
    OTHER = "other"


class MessageRole(str, Enum):
    """Conversation message roles"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
