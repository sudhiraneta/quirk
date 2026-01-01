/**
 * Metrics Dashboard - Main feature
 */

const API_BASE_URL = 'https://quirk-kvxe.onrender.com/api/v1';

document.addEventListener('DOMContentLoaded', async () => {
  const backBtn = document.getElementById('back-btn');
  const loadingEl = document.getElementById('loading');
  const metricsEl = document.getElementById('metrics');

  // Back button
  backBtn.addEventListener('click', () => {
    window.location.href = 'popup.html';
  });

  // Load metrics
  await loadMetrics();

  async function loadMetrics() {
    try {
      // Get user UUID
      const userResponse = await chrome.runtime.sendMessage({ action: 'getUserUUID' });
      if (!userResponse?.success) {
        throw new Error('Failed to get user ID');
      }

      const userUUID = userResponse.uuid;

      // Fetch metrics from API
      const response = await fetch(`${API_BASE_URL}/metrics/${userUUID}`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();

      displayMetrics(data);

      loadingEl.style.display = 'none';
      metricsEl.style.display = 'block';

    } catch (error) {
      loadingEl.innerHTML = `<div style="color: #d00;">Error: ${error.message}</div>`;
    }
  }

  function displayMetrics(data) {
    const overview = data.overview || {};
    const aggregate = data.aggregate || {};
    const topSites = data.top_sites || [];
    const insights = data.insights || [];

    let html = '';

    // Total Active Hours
    html += `
      <div class="section">
        <div class="big-stat">
          <div class="big-number">${overview.total_time || '0m'}</div>
          <div class="big-label">TOTAL ACTIVE TIME</div>
        </div>
      </div>
    `;

    // Aggregate: Productive vs Doomscrolling (MAIN CHART)
    if (aggregate.productive || aggregate.doomscrolling) {
      const prod = aggregate.productive || {};
      const doom = aggregate.doomscrolling || {};
      const neutral = aggregate.neutral || {};

      html += `
        <div class="section">
          <div class="section-title">Time Breakdown</div>

          <div style="margin: 20px 0;">
            <div class="aggregate-bar">
              <div class="bar-segment bar-productive" style="width: ${prod.percent || 0}%"></div>
              <div class="bar-segment bar-doomscrolling" style="width: ${doom.percent || 0}%"></div>
              <div class="bar-segment bar-neutral" style="width: ${neutral.percent || 0}%"></div>
            </div>
          </div>

          <div class="metric-row">
            <span class="metric-label">💻 Productive</span>
            <span class="metric-value">${prod.time || '0m'} (${prod.percent || 0}%)</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">📱 Doomscrolling</span>
            <span class="metric-value">${doom.time || '0m'} (${doom.percent || 0}%)</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">⚪ Neutral</span>
            <span class="metric-value">${neutral.time || '0m'} (${neutral.percent || 0}%)</span>
          </div>
        </div>
      `;
    }

    // Insights
    if (insights.length > 0) {
      html += `<div class="section">`;
      insights.forEach(insight => {
        html += `<div class="insight">${insight}</div>`;
      });
      html += `</div>`;
    }

    // Top Sites - Emphasize VISIT COUNTS
    if (topSites.length > 0) {
      html += `
        <div class="section">
          <div class="section-title">Top Sites (by time)</div>
      `;

      topSites.forEach((site, idx) => {
        const catEmoji = {
          'productive': '💻',
          'entertainment': '📱',
          'shopping': '🛒',
          'other': '🌐',
          'neutral': '⚪'
        };
        const emoji = catEmoji[site.category] || '🌐';

        html += `
          <div class="site-item">
            <div class="site-name">${emoji} ${site.site}</div>
            <div class="site-meta">
              <strong>${site.visits} opens</strong> • ${site.time} (${site.time_percent}% of total)
            </div>
          </div>
        `;
      });

      html += `</div>`;
    }

    metricsEl.innerHTML = html;
  }
});
