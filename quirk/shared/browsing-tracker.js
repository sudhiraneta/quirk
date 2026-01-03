/**
 * Browsing History Tracker
 * Collects RAW browsing data - NO organizing, let LLM do everything
 */

/**
 * Collect TODAY's browsing history only
 * @returns {Promise<Array>} Raw browsing history items
 */
export async function collectTodayBrowsingHistory() {
  try {
    // Get start of today (midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startTime = today.getTime();

    // Only fetch top 200 items (sorted by most recent)
    // Backend only uses top 15 anyway, but get extra for deduping
    const historyItems = await chrome.history.search({
      text: '',
      startTime: startTime,
      maxResults: 200  // Reduced from 10000 for faster collection
    });

    console.log(`📊 Found ${historyItems.length} browsing items from today`);

    // Just collect RAW data - no categorization, no organization
    const rawData = historyItems
      .map(item => {
        try {
          const url = new URL(item.url);

          // Skip chrome:// and extension:// URLs
          if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
            return null;
          }

          return {
            url: item.url,
            title: item.title || '',
            hostname: url.hostname.replace('www.', ''),
            visit_count: item.visitCount || 1,
            last_visit_time: new Date(item.lastVisitTime).toISOString()
          };
        } catch (error) {
          return null;
        }
      })
      .filter(item => item !== null)
      .sort((a, b) => b.visit_count - a.visit_count)  // Sort by most visited
      .slice(0, 100);  // Only send top 100 sites to backend

    console.log(`📊 Collected ${rawData.length} sites from today`);
    return rawData;
  } catch (error) {
    console.error('Error collecting browsing history:', error);
    return [];
  }
}

// That's it! No more organizing code.
// LLM will handle EVERYTHING:
// - Categorization (Gmail vs Google Search vs YouTube)
// - Productivity scoring
// - Doom scrolling detection
// - Motivation messages
// - All analysis
