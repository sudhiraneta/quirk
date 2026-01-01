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

// Browsing Categories
export const CATEGORIES = {
  SOCIAL_MEDIA: 'social_media',
  SHOPPING: 'shopping',
  VIDEO: 'video',
  NEWS: 'news',
  OTHER: 'other'
};

// Platform Detection Patterns
export const PLATFORM_PATTERNS = {
  'instagram.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'instagram' },
  'twitter.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'twitter' },
  'x.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'twitter' },
  'tiktok.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'tiktok' },
  'linkedin.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'linkedin' },
  'facebook.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'facebook' },
  'youtube.com': { category: CATEGORIES.VIDEO, platform: 'youtube' },
  'vimeo.com': { category: CATEGORIES.VIDEO, platform: 'vimeo' },
  'amazon.com': { category: CATEGORIES.SHOPPING, platform: 'amazon' },
  'ebay.com': { category: CATEGORIES.SHOPPING, platform: 'ebay' },
  'etsy.com': { category: CATEGORIES.SHOPPING, platform: 'etsy' },
  'pinterest.com': { category: CATEGORIES.SOCIAL_MEDIA, platform: 'pinterest' }
};

// Collection Settings
export const COLLECTION_SETTINGS = {
  HISTORY_DAYS: 30,
  HISTORY_SYNC_INTERVAL: 6 * 60 * 60 * 1000, // 6 hours in milliseconds
  MAX_HISTORY_ITEMS: 10000
};
