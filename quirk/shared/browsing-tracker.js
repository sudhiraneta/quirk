/**
 * Browsing History Tracker
 * Collects and analyzes user browsing patterns
 */

import { PLATFORM_PATTERNS, CATEGORIES } from './constants.js';

/**
 * Collect browsing history from the last N days
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Browsing history items
 */
export async function collectBrowsingHistory(days = 30) {
  const microsecondsPerDay = 1000 * 1000 * 60 * 60 * 24;
  const startTime = Date.now() * 1000 - (days * microsecondsPerDay);

  try {
    const historyItems = await chrome.history.search({
      text: '',
      startTime: startTime / 1000, // Convert to milliseconds
      maxResults: 10000
    });

    console.log(`📊 Found ${historyItems.length} browsing history items from last ${days} days`);

    // Process and categorize items
    const processedItems = historyItems
      .map(item => processHistoryItem(item))
      .filter(item => item !== null);

    // Aggregate by URL to get visit counts
    const aggregated = aggregateByUrl(processedItems);

    console.log(`📊 Processed ${aggregated.length} unique URLs`);
    return aggregated;
  } catch (error) {
    console.error('Error collecting browsing history:', error);
    return [];
  }
}

/**
 * Process a single history item
 */
function processHistoryItem(item) {
  try {
    const url = new URL(item.url);
    const hostname = url.hostname.replace('www.', '');

    // Skip chrome:// and extension:// URLs
    if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
      return null;
    }

    // Detect platform and category
    const { platform, category } = detectPlatformAndCategory(hostname, item.title);

    return {
      url: item.url,
      title: item.title || '',
      hostname: hostname,
      platform: platform,
      category: category,
      visit_count: item.visitCount || 1,
      last_visit: new Date(item.lastVisitTime).toISOString(),
      typed_count: item.typedCount || 0
    };
  } catch (error) {
    console.error('Error processing history item:', error);
    return null;
  }
}

/**
 * Detect platform and category from hostname and title
 */
function detectPlatformAndCategory(hostname, title) {
  // Check against known platforms
  for (const [pattern, info] of Object.entries(PLATFORM_PATTERNS)) {
    if (hostname.includes(pattern.replace('*.', ''))) {
      return {
        platform: info.platform,
        category: info.category
      };
    }
  }

  // Fallback categorization based on hostname/title keywords
  const text = `${hostname} ${title}`.toLowerCase();

  if (text.match(/shop|store|buy|cart|checkout|product|amazon|ebay/)) {
    return { platform: hostname, category: CATEGORIES.SHOPPING };
  }

  if (text.match(/news|article|blog|post|read/)) {
    return { platform: hostname, category: CATEGORIES.NEWS };
  }

  if (text.match(/youtube|vimeo|video|watch|stream/)) {
    return { platform: hostname, category: CATEGORIES.VIDEO };
  }

  if (text.match(/facebook|twitter|instagram|tiktok|linkedin|social/)) {
    return { platform: hostname, category: CATEGORIES.SOCIAL_MEDIA };
  }

  return { platform: hostname, category: CATEGORIES.OTHER };
}

/**
 * Aggregate browsing items by URL
 */
function aggregateByUrl(items) {
  const urlMap = new Map();

  items.forEach(item => {
    const existing = urlMap.get(item.url);
    if (existing) {
      existing.visit_count += item.visit_count;
      // Keep the most recent visit time
      if (new Date(item.last_visit) > new Date(existing.last_visit)) {
        existing.last_visit = item.last_visit;
      }
    } else {
      urlMap.set(item.url, { ...item });
    }
  });

  return Array.from(urlMap.values());
}

/**
 * Get browsing analytics summary
 */
export function getBrowsingAnalytics(browsingData) {
  const analytics = {
    total_sites: browsingData.length,
    total_visits: 0,
    top_platforms: [],
    top_categories: [],
    daily_habits: [],
    platform_breakdown: {},
    category_breakdown: {}
  };

  // Calculate totals and breakdowns
  browsingData.forEach(item => {
    analytics.total_visits += item.visit_count;

    // Platform breakdown
    if (!analytics.platform_breakdown[item.platform]) {
      analytics.platform_breakdown[item.platform] = {
        visit_count: 0,
        sites: []
      };
    }
    analytics.platform_breakdown[item.platform].visit_count += item.visit_count;
    analytics.platform_breakdown[item.platform].sites.push(item.title || item.hostname);

    // Category breakdown
    if (!analytics.category_breakdown[item.category]) {
      analytics.category_breakdown[item.category] = 0;
    }
    analytics.category_breakdown[item.category] += item.visit_count;
  });

  // Get top platforms
  analytics.top_platforms = Object.entries(analytics.platform_breakdown)
    .sort((a, b) => b[1].visit_count - a[1].visit_count)
    .slice(0, 10)
    .map(([platform, data]) => ({
      platform,
      visit_count: data.visit_count,
      percentage: ((data.visit_count / analytics.total_visits) * 100).toFixed(1)
    }));

  // Get top categories
  analytics.top_categories = Object.entries(analytics.category_breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({
      category,
      visit_count: count,
      percentage: ((count / analytics.total_visits) * 100).toFixed(1)
    }));

  // Identify daily habits (sites visited frequently)
  analytics.daily_habits = browsingData
    .filter(item => item.visit_count > 5) // Visited more than 5 times
    .sort((a, b) => b.visit_count - a.visit_count)
    .slice(0, 10)
    .map(item => ({
      site: item.hostname,
      title: item.title,
      visit_count: item.visit_count,
      category: item.category
    }));

  return analytics;
}
