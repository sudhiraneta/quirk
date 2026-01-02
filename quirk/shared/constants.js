/**
 * Shared constants for Quirk extension
 */

// API Configuration
export const API_BASE_URL = 'https://quirk-kvxe.onrender.com/api/v1';  // Production API
// export const API_BASE_URL = 'http://localhost:8000/api/v1';  // Local development

// Storage Keys
export const STORAGE_KEYS = {
  USER_UUID: 'userUUID',
  LAST_MODE: 'lastMode',
  LAST_SYNC: 'lastSync'
};

// Analysis Modes
export const MODES = {
  ROAST: 'roast',
  SELF_DISCOVERY: 'self-discovery',
  FRIEND: 'friend'
};

// Browsing Categories (Simplified - LLM will do the real categorization)
export const CATEGORIES = {
  SOCIAL_MEDIA: 'social_media',
  SHOPPING: 'shopping',
  PRODUCTIVITY: 'productivity',
  OTHER: 'other'
};

// Platform Detection Patterns (Simplified - just label the platform, LLM will categorize)
export const PLATFORM_PATTERNS = {
  'instagram.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'Instagram' },
  'twitter.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'Twitter/X' },
  'x.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'Twitter/X' },
  'tiktok.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'TikTok' },
  'linkedin.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'LinkedIn' },
  'facebook.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'Facebook' },
  'youtube.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'YouTube' },
  'twitch.tv': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'Twitch' },
  'reddit.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'Reddit' },
  'amazon.com': { category: CATEGORIES.SHOPPING, platform: 'Amazon' },
  'ebay.com': { category: CATEGORIES.SHOPPING, platform: 'eBay' },
  'etsy.com': { category: CATEGORIES.SHOPPING, platform: 'Etsy' }
};

// Collection Settings
export const COLLECTION_SETTINGS = {
  HISTORY_DAYS: 30,
  HISTORY_SYNC_INTERVAL: 6 * 60 * 60 * 1000, // 6 hours in milliseconds
  MAX_HISTORY_ITEMS: 10000
};
