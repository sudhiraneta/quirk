/**
 * Shared utility functions
 */

import { PLATFORM_PATTERNS, CATEGORIES } from './constants.js';

/**
 * Categorize a URL by domain
 * @param {string} url
 * @returns {{category: string, platform: string}}
 */
export function categorizeUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    // Check against known patterns
    for (const [pattern, info] of Object.entries(PLATFORM_PATTERNS)) {
      if (hostname.includes(pattern)) {
        return info;
      }
    }

    // Default
    return { category: CATEGORIES.OTHER, platform: extractPlatform(url) };
  } catch (e) {
    return { category: CATEGORIES.OTHER, platform: 'unknown' };
  }
}

/**
 * Extract platform name from URL
 * @param {string} url
 * @returns {string}
 */
export function extractPlatform(url) {
  try {
    const hostname = new URL(url).hostname;
    const domain = hostname.replace('www.', '').split('.')[0];
    return domain;
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Format error message for user display
 * @param {Error} error
 * @returns {string}
 */
export function formatError(error) {
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Debounce function
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
