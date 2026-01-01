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
    const topSites = data.top_sites || [];
    const categories = data.categories || {};
    const insights = data.insights || [];

    let html = '';

    // Productivity Score (Big Number)
    html += `
      <div class="metric-card">
        <div class="big-number">${overview.productivity_score || 0}%</div>
        <div class="big-label">PRODUCTIVITY SCORE</div>
      </div>
    `;

    // Insights
    if (insights.length > 0) {
      insights.forEach(insight => {
        html += `<div class="insight">${insight}</div>`;
      });
    }

    // Overview
    html += `
      <div class="metric-card">
        <div class="metric-title">Overview</div>
        <div class="metric-row">
          <span class="metric-label">Total Time</span>
          <span class="metric-value">${overview.total_time || '0m'}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Sites Visited</span>
          <span class="metric-value">${overview.total_sites || 0}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Total Visits</span>
          <span class="metric-value">${overview.total_visits || 0}</span>
        </div>
      </div>
    `;

    // Top Sites
    if (topSites.length > 0) {
      html += `
        <div class="metric-card">
          <div class="metric-title">Top Sites</div>
      `;

      topSites.forEach(site => {
        const catClass = `cat-${site.category}`;
        html += `
          <div class="top-site">
            <div>
              <div class="site-name">${site.site}</div>
              <div class="site-time">${site.time} • ${site.visits} visits</div>
            </div>
            <span class="category-badge ${catClass}">${site.category}</span>
          </div>
        `;
      });

      html += `</div>`;
    }

    // Category Breakdown
    if (Object.keys(categories).length > 0) {
      html += `
        <div class="metric-card">
          <div class="metric-title">Time by Category</div>
      `;

      Object.entries(categories).forEach(([cat, data]) => {
        html += `
          <div class="metric-row">
            <span class="metric-label">${cat}</span>
            <span class="metric-value">${data.time} (${data.percent}%)</span>
          </div>
          <div class="category-bar" style="width: ${data.percent}%"></div>
        `;
      });

      html += `</div>`;
    }

    metricsEl.innerHTML = html;
  }
});
