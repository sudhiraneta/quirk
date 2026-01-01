/**
 * Time Tracker - Tracks actual time spent on sites with productivity categorization
 * Core metrics engine for Quirk
 */

const PRODUCTIVITY_CATEGORIES = {
  // Work & Development
  CODING: {
    keywords: ['github', 'stackoverflow', 'gitlab', 'vscode', 'replit', 'codesandbox', 'codepen', 'leetcode'],
    platforms: ['code.visualstudio.com', 'github.com', 'stackoverflow.com', 'gitlab.com'],
    category: 'productive',
    subcategory: 'coding',
    emoji: '💻'
  },

  // Learning & Education
  LEARNING: {
    keywords: ['coursera', 'udemy', 'khan', 'edx', 'skillshare', 'medium', 'dev.to', 'documentation'],
    platforms: ['coursera.org', 'udemy.com', 'khanacademy.org', 'medium.com', 'dev.to'],
    category: 'productive',
    subcategory: 'learning',
    emoji: '📚'
  },

  // Work Tools
  PRODUCTIVITY_TOOLS: {
    keywords: ['notion', 'trello', 'asana', 'slack', 'teams', 'zoom', 'calendar', 'docs', 'sheets'],
    platforms: ['notion.so', 'trello.com', 'asana.com', 'slack.com', 'zoom.us', 'docs.google.com'],
    category: 'productive',
    subcategory: 'tools',
    emoji: '🛠️'
  },

  // Email
  EMAIL: {
    keywords: ['gmail', 'outlook', 'mail', 'inbox'],
    platforms: ['mail.google.com', 'outlook.com', 'yahoo.com/mail'],
    category: 'neutral',
    subcategory: 'communication',
    emoji: '📧'
  },

  // Social Media
  SOCIAL_MEDIA: {
    keywords: ['instagram', 'twitter', 'facebook', 'tiktok', 'snapchat', 'linkedin', 'reddit'],
    platforms: ['instagram.com', 'twitter.com', 'x.com', 'facebook.com', 'tiktok.com', 'linkedin.com', 'reddit.com'],
    category: 'entertainment',
    subcategory: 'social',
    emoji: '📱'
  },

  // Video Streaming
  VIDEO_STREAMING: {
    keywords: ['youtube', 'netflix', 'hulu', 'disney', 'prime video', 'twitch', 'vimeo'],
    platforms: ['youtube.com', 'netflix.com', 'hulu.com', 'disneyplus.com', 'twitch.tv'],
    category: 'entertainment',
    subcategory: 'video',
    emoji: '🎬'
  },

  // Shopping
  SHOPPING: {
    keywords: ['amazon', 'ebay', 'shop', 'cart', 'checkout', 'store', 'walmart', 'target'],
    platforms: ['amazon.com', 'ebay.com', 'walmart.com', 'target.com', 'etsy.com'],
    category: 'shopping',
    subcategory: 'ecommerce',
    emoji: '🛒'
  },

  // News
  NEWS: {
    keywords: ['news', 'cnn', 'bbc', 'reuters', 'nytimes', 'washingtonpost', 'guardian'],
    platforms: ['cnn.com', 'bbc.com', 'reuters.com', 'nytimes.com'],
    category: 'neutral',
    subcategory: 'news',
    emoji: '📰'
  },

  // Design
  DESIGN: {
    keywords: ['figma', 'canva', 'adobe', 'photoshop', 'behance', 'dribbble'],
    platforms: ['figma.com', 'canva.com', 'behance.net', 'dribbble.com'],
    category: 'productive',
    subcategory: 'design',
    emoji: '🎨'
  },

  // Search
  SEARCH: {
    keywords: ['google.com/search', 'bing.com/search', 'duckduckgo'],
    platforms: [],
    category: 'neutral',
    subcategory: 'search',
    emoji: '🔍'
  }
};

class TimeTracker {
  constructor() {
    this.activeTab = null;
    this.startTime = null;
    this.sessions = new Map(); // URL -> {totalTime, activeTime, visits, category}
    this.dailyMetrics = new Map(); // date -> metrics
    this.isUserActive = true;
    this.lastActivityTime = Date.now();

    this.init();
  }

  init() {
    // Track active tab changes
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.onTabChanged(activeInfo.tabId);
    });

    // Track URL changes
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url && tab.active) {
        this.onTabChanged(tabId);
      }
    });

    // Track window focus
    chrome.windows.onFocusChanged.addListener((windowId) => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        this.onWindowBlurred();
      } else {
        this.onWindowFocused(windowId);
      }
    });

    // Detect user activity
    chrome.idle.onStateChanged.addListener((state) => {
      this.isUserActive = (state === 'active');
      if (!this.isUserActive) {
        this.saveCurrentSession();
      }
    });

    // Save sessions periodically
    setInterval(() => this.saveCurrentSession(), 30000); // Every 30 seconds
  }

  async onTabChanged(tabId) {
    // Save previous session
    this.saveCurrentSession();

    // Start new session
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && !tab.url.startsWith('chrome://')) {
      this.activeTab = {
        url: tab.url,
        title: tab.title,
        tabId: tabId
      };
      this.startTime = Date.now();
    }
  }

  onWindowBlurred() {
    this.isUserActive = false;
    this.saveCurrentSession();
  }

  async onWindowFocused(windowId) {
    this.isUserActive = true;
    const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
    if (tabs[0]) {
      this.onTabChanged(tabs[0].id);
    }
  }

  saveCurrentSession() {
    if (!this.activeTab || !this.startTime) return;

    const now = Date.now();
    const duration = now - this.startTime;

    // Only count if spent at least 2 seconds (avoid accidental switches)
    if (duration < 2000) return;

    const { hostname, category, subcategory } = this.categorizeUrl(this.activeTab.url);
    const key = hostname;

    // Update session data
    const existing = this.sessions.get(key) || {
      hostname: hostname,
      url: this.activeTab.url,
      title: this.activeTab.title,
      totalTime: 0,
      activeTime: 0,
      visits: 0,
      category: category,
      subcategory: subcategory,
      lastVisit: now,
      searchQueries: []
    };

    existing.totalTime += duration;
    existing.activeTime += this.isUserActive ? duration : 0;
    existing.visits += 1;
    existing.lastVisit = now;

    // Extract search queries
    if (category === 'neutral' && subcategory === 'search') {
      const query = this.extractSearchQuery(this.activeTab.url);
      if (query && !existing.searchQueries.includes(query)) {
        existing.searchQueries.push(query);
      }
    }

    this.sessions.set(key, existing);

    // Update daily metrics
    this.updateDailyMetrics(category, duration);

    // Reset for next session
    this.startTime = now;
  }

  categorizeUrl(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      const fullUrl = url.toLowerCase();

      // Check each category
      for (const [name, config] of Object.entries(PRODUCTIVITY_CATEGORIES)) {
        // Check platforms
        if (config.platforms.some(platform => hostname.includes(platform))) {
          return {
            hostname,
            category: config.category,
            subcategory: config.subcategory,
            emoji: config.emoji
          };
        }

        // Check keywords in URL
        if (config.keywords.some(keyword => fullUrl.includes(keyword))) {
          return {
            hostname,
            category: config.category,
            subcategory: config.subcategory,
            emoji: config.emoji
          };
        }
      }

      // Default: other
      return {
        hostname,
        category: 'other',
        subcategory: 'uncategorized',
        emoji: '🌐'
      };
    } catch (e) {
      return {
        hostname: 'unknown',
        category: 'other',
        subcategory: 'uncategorized',
        emoji: '🌐'
      };
    }
  }

  extractSearchQuery(url) {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;

      // Google search
      if (url.includes('google.com/search')) {
        return params.get('q');
      }

      // Bing search
      if (url.includes('bing.com/search')) {
        return params.get('q');
      }

      // YouTube search
      if (url.includes('youtube.com/results')) {
        return params.get('search_query');
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  updateDailyMetrics(category, duration) {
    const today = new Date().toISOString().split('T')[0];
    const metrics = this.dailyMetrics.get(today) || {
      date: today,
      productive: 0,
      entertainment: 0,
      shopping: 0,
      neutral: 0,
      other: 0
    };

    metrics[category] = (metrics[category] || 0) + duration;
    this.dailyMetrics.set(today, metrics);
  }

  async getMetrics() {
    this.saveCurrentSession(); // Save current before generating metrics

    const sessions = Array.from(this.sessions.values());

    // Sort by total time
    sessions.sort((a, b) => b.totalTime - a.totalTime);

    // Calculate totals
    const totalTime = sessions.reduce((sum, s) => sum + s.totalTime, 0);
    const activeTime = sessions.reduce((sum, s) => sum + s.activeTime, 0);

    // Category breakdown
    const categoryBreakdown = {};
    sessions.forEach(session => {
      if (!categoryBreakdown[session.category]) {
        categoryBreakdown[session.category] = {
          time: 0,
          activeTime: 0,
          sites: 0
        };
      }
      categoryBreakdown[session.category].time += session.totalTime;
      categoryBreakdown[session.category].activeTime += session.activeTime;
      categoryBreakdown[session.category].sites += 1;
    });

    // Productivity score (0-100)
    const productiveTime = (categoryBreakdown.productive?.time || 0);
    const productivityScore = totalTime > 0
      ? Math.round((productiveTime / totalTime) * 100)
      : 0;

    // Top sites
    const topSites = sessions.slice(0, 10).map(s => ({
      hostname: s.hostname,
      title: s.title,
      totalTime: s.totalTime,
      activeTime: s.activeTime,
      visits: s.visits,
      category: s.category,
      subcategory: s.subcategory,
      timeFormatted: this.formatTime(s.totalTime),
      activePercent: Math.round((s.activeTime / s.totalTime) * 100)
    }));

    // Collect all search queries
    const allSearches = [];
    sessions.forEach(s => {
      if (s.searchQueries) {
        allSearches.push(...s.searchQueries);
      }
    });

    // Daily patterns (last 7 days)
    const dailyPatterns = Array.from(this.dailyMetrics.values()).slice(-7);

    return {
      overview: {
        totalTime,
        activeTime,
        totalSites: sessions.length,
        productivityScore,
        activePercent: totalTime > 0 ? Math.round((activeTime / totalTime) * 100) : 0
      },
      topSites,
      categoryBreakdown,
      searchQueries: allSearches.slice(0, 20), // Top 20 searches
      dailyPatterns,
      sessions: sessions.map(s => ({
        ...s,
        timeFormatted: this.formatTime(s.totalTime)
      }))
    };
  }

  formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Save to Chrome storage
  async saveToStorage() {
    await chrome.storage.local.set({
      timeTrackerSessions: Array.from(this.sessions.entries()),
      timeTrackerDaily: Array.from(this.dailyMetrics.entries())
    });
  }

  // Load from Chrome storage
  async loadFromStorage() {
    const data = await chrome.storage.local.get(['timeTrackerSessions', 'timeTrackerDaily']);

    if (data.timeTrackerSessions) {
      this.sessions = new Map(data.timeTrackerSessions);
    }

    if (data.timeTrackerDaily) {
      this.dailyMetrics = new Map(data.timeTrackerDaily);
    }
  }
}

// Export singleton instance
export const timeTracker = new TimeTracker();

// Load saved data on init
timeTracker.loadFromStorage();

// Save periodically
setInterval(() => timeTracker.saveToStorage(), 60000); // Every minute
