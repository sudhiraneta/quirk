/**
 * Activity Detector - Distinguishes productive work from passive browsing
 *
 * EXAMPLES:
 * - Writing email (compose window) = PRODUCTIVE
 * - Just loading inbox = NOT productive
 * - LinkedIn messaging = PRODUCTIVE
 * - LinkedIn scrolling feed = NOT productive
 */

export class ActivityDetector {

  /**
   * Detect if current activity is productive based on URL patterns
   * @param {string} url - Full URL
   * @param {string} title - Page title
   * @returns {object} {isProductive: boolean, activityType: string}
   */
  static detectActivity(url, title) {
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();

    // GMAIL - Distinguish writing from browsing
    if (urlLower.includes('mail.google.com')) {
      // Writing email = PRODUCTIVE
      if (urlLower.includes('#compose') ||
          urlLower.includes('/compose') ||
          titleLower.includes('compose') ||
          titleLower.includes('draft')) {
        return {
          isProductive: true,
          activityType: 'email_writing',
          category: 'productive'
        };
      }

      // Just browsing inbox = NOT productive
      return {
        isProductive: false,
        activityType: 'email_browsing',
        category: 'other'
      };
    }

    // LINKEDIN - Distinguish messaging from scrolling
    if (urlLower.includes('linkedin.com')) {
      // Messaging, job search, profile editing = PRODUCTIVE
      if (urlLower.includes('/messaging') ||
          urlLower.includes('/jobs') ||
          urlLower.includes('/in/edit') ||
          titleLower.includes('message')) {
        return {
          isProductive: true,
          activityType: 'professional_networking',
          category: 'productive'
        };
      }

      // Scrolling feed = NOT productive
      return {
        isProductive: false,
        activityType: 'social_browsing',
        category: 'other'
      };
    }

    // GOOGLE DOCS - Writing/editing = PRODUCTIVE
    if (urlLower.includes('docs.google.com/document') ||
        urlLower.includes('docs.google.com/spreadsheet')) {
      return {
        isProductive: true,
        activityType: 'document_work',
        category: 'productive'
      };
    }

    // GITHUB - Code review, commits = PRODUCTIVE
    if (urlLower.includes('github.com')) {
      // Viewing repos, PRs, issues = PRODUCTIVE
      if (urlLower.includes('/pull/') ||
          urlLower.includes('/issues/') ||
          urlLower.includes('/commit/') ||
          urlLower.includes('/tree/')) {
        return {
          isProductive: true,
          activityType: 'coding',
          category: 'productive'
        };
      }

      // Just browsing trending = less productive
      if (urlLower.includes('/trending') ||
          urlLower.includes('/explore')) {
        return {
          isProductive: false,
          activityType: 'browsing',
          category: 'other'
        };
      }

      return {
        isProductive: true,
        activityType: 'coding',
        category: 'productive'
      };
    }

    // CHATGPT/CLAUDE - Distinguish work from personal use
    if (urlLower.includes('chat.openai.com') ||
        urlLower.includes('claude.ai')) {

      // Check if working on code/technical topics
      if (titleLower.includes('code') ||
          titleLower.includes('debug') ||
          titleLower.includes('function') ||
          titleLower.includes('api')) {
        return {
          isProductive: true,
          activityType: 'ai_assisted_work',
          category: 'productive'
        };
      }

      // General chat = depends on usage
      return {
        isProductive: false,
        activityType: 'ai_browsing',
        category: 'other'
      };
    }

    // DEFAULT - use basic categorization
    return {
      isProductive: false,
      activityType: 'general_browsing',
      category: 'other'
    };
  }

  /**
   * Calculate productivity based on activity patterns
   * @param {Array} sessions - Time tracking sessions
   * @returns {object} Enhanced metrics with activity breakdown
   */
  static analyzeProductivity(sessions) {
    let emailWriting = 0;
    let emailBrowsing = 0;
    let linkedinNetworking = 0;
    let linkedinScrolling = 0;
    let aiWork = 0;
    let aiBrowsing = 0;
    let actualCoding = 0;

    sessions.forEach(session => {
      const detection = this.detectActivity(session.url, session.title);
      const time = session.totalTime || 0;

      switch(detection.activityType) {
        case 'email_writing':
          emailWriting += time;
          break;
        case 'email_browsing':
          emailBrowsing += time;
          break;
        case 'professional_networking':
          linkedinNetworking += time;
          break;
        case 'social_browsing':
          linkedinScrolling += time;
          break;
        case 'ai_assisted_work':
          aiWork += time;
          break;
        case 'ai_browsing':
          aiBrowsing += time;
          break;
        case 'coding':
          actualCoding += time;
          break;
      }
    });

    return {
      productive: {
        emailWriting,
        linkedinNetworking,
        aiWork,
        actualCoding,
        total: emailWriting + linkedinNetworking + aiWork + actualCoding
      },
      notProductive: {
        emailBrowsing,
        linkedinScrolling,
        aiBrowsing,
        total: emailBrowsing + linkedinScrolling + aiBrowsing
      },
      insights: this.generateInsights({
        emailWriting,
        emailBrowsing,
        linkedinNetworking,
        linkedinScrolling
      })
    };
  }

  static generateInsights(metrics) {
    const insights = [];
    const THIRTY_MIN = 30 * 60 * 1000;  // 30 minutes in ms
    const ONE_HOUR = 60 * 60 * 1000;
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const THREE_HOURS = 3 * 60 * 60 * 1000;

    // Email insight
    const emailTotal = metrics.emailWriting + metrics.emailBrowsing;
    if (emailTotal > 0) {
      const writingPercent = (metrics.emailWriting / emailTotal) * 100;
      if (writingPercent > 60) {
        insights.push('✅ Actually writing emails, not just checking inbox');
      } else if (emailTotal > ONE_HOUR) {
        insights.push('🚩 >1h email browsing - inbox addiction detected');
      } else {
        insights.push('🚩 Mostly checking inbox, minimal actual email work');
      }
    }

    // LinkedIn insight with TIME LIMIT
    const linkedinTotal = metrics.linkedinNetworking + metrics.linkedinScrolling;
    if (linkedinTotal > 0) {
      const networkingPercent = (metrics.linkedinNetworking / linkedinTotal) * 100;

      // >30min browsing = EXCESSIVE (unless job hunting)
      if (metrics.linkedinScrolling > THIRTY_MIN && networkingPercent < 50) {
        insights.push('🚩 LinkedIn >30min/day - scrolling not networking. Goal: Job search?');
      } else if (networkingPercent > 50) {
        insights.push('✅ Productive LinkedIn - messaging/job applications');
      } else {
        insights.push('⚠️ LinkedIn time - define your goal (job search vs browsing)');
      }
    }

    return insights;
  }
}
