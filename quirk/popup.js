/**
 * Quirk Extension Popup
 * Main UI for triggering personality analysis with browsing analytics
 */

const API_BASE_URL = 'https://quirk-kvxe.onrender.com/api/v1';

document.addEventListener('DOMContentLoaded', async function() {
  const modeButtons = document.querySelectorAll('.mode-btn');
  const statusEl = document.getElementById('status');
  const resultsEl = document.getElementById('results');
  const analyticsBtn = document.getElementById('view-analytics');
  const analyticsDisplay = document.getElementById('analytics-display');

  // Auto-sync browsing data on popup open
  syncBrowsingData();

  // View analytics button
  analyticsBtn.addEventListener('click', async () => {
    if (analyticsDisplay.style.display === 'none') {
      await showBrowsingAnalytics();
    } else {
      analyticsDisplay.style.display = 'none';
      analyticsBtn.textContent = '📊 View Browsing Analytics';
    }
  });

  // Mode buttons
  modeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode;
      await runAnalysis(mode);
    });
  });

  // Sync browsing data to backend
  async function syncBrowsingData() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'collectAndSendBrowsingData'
      });
      console.log('✅ Browsing data synced:', response);
    } catch (error) {
      console.log('Browsing sync skipped:', error.message);
    }
  }

  // Show browsing analytics
  async function showBrowsingAnalytics() {
    statusEl.innerHTML = '<div class="loading">📊 Loading analytics...</div>';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getBrowsingAnalytics'
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      const analytics = response.analytics;

      let html = `
        <div class="analytics-section">
          <div class="analytics-title">Browsing Overview (30 days)</div>
          <div class="stat-row">
            <span class="stat-label">Total Sites</span>
            <span class="stat-value">${analytics.total_sites}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Total Visits</span>
            <span class="stat-value">${analytics.total_visits}</span>
          </div>
        </div>
      `;

      // Top platforms
      if (analytics.top_platforms.length > 0) {
        html += `
          <div class="analytics-section">
            <div class="analytics-title">Top Platforms</div>
        `;
        analytics.top_platforms.slice(0, 5).forEach(item => {
          html += `
            <div class="stat-row">
              <span class="stat-label">${item.platform}</span>
              <span class="stat-value">${item.visit_count} visits (${item.percentage}%)</span>
            </div>
          `;
        });
        html += `</div>`;
      }

      // Daily habits
      if (analytics.daily_habits.length > 0) {
        html += `
          <div class="analytics-section">
            <div class="analytics-title">Daily Habits</div>
        `;
        analytics.daily_habits.slice(0, 5).forEach(habit => {
          html += `
            <div class="stat-row">
              <span class="stat-label">${habit.site}</span>
              <span class="stat-value">${habit.visit_count} visits</span>
            </div>
          `;
        });
        html += `</div>`;
      }

      // Category breakdown
      if (analytics.top_categories.length > 0) {
        html += `
          <div class="analytics-section">
            <div class="analytics-title">Categories</div>
        `;
        analytics.top_categories.forEach(cat => {
          html += `
            <div class="stat-row">
              <span class="stat-label">${cat.category}</span>
              <span class="stat-value">${cat.percentage}%</span>
            </div>
          `;
        });
        html += `</div>`;
      }

      analyticsDisplay.innerHTML = html;
      analyticsDisplay.style.display = 'block';
      analyticsBtn.textContent = '❌ Hide Analytics';
      statusEl.innerHTML = '';

    } catch (error) {
      statusEl.innerHTML = `<div class="error">Analytics unavailable: ${error.message}</div>`;
    }
  }

  // Run personality analysis
  async function runAnalysis(mode) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on Pinterest
      if (!tab.url.includes('pinterest.com')) {
        statusEl.innerHTML = '<div class="error">⚠️ Open Pinterest first</div>';
        return;
      }

      modeButtons.forEach(btn => btn.disabled = true);
      statusEl.innerHTML = '<div class="loading">📍 Extracting Pinterest pins...</div>';
      resultsEl.style.display = 'none';

      // Step 1: Extract pins
      const pinsResponse = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'extractPins' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error('Refresh Pinterest and try again'));
            return;
          }
          resolve(response);
        });
      });

      if (!pinsResponse?.success) {
        throw new Error(pinsResponse?.error || 'Failed to extract pins');
      }

      const pins = pinsResponse.pins;
      statusEl.innerHTML = `<div class="loading">✅ Found ${pins.length} pins<br>📤 Sending to backend...</div>`;

      // Step 2: Send pins to backend
      const sendResponse = await chrome.runtime.sendMessage({
        action: 'sendPinsToBackend',
        pins: pins
      });

      if (!sendResponse?.success) {
        throw new Error('Failed to send pins to backend');
      }

      statusEl.innerHTML = `<div class="loading">🤖 Generating ${mode} analysis...</div>`;

      // Step 3: Get analysis
      const userIdResponse = await chrome.runtime.sendMessage({ action: 'getUserUUID' });
      if (!userIdResponse?.success) {
        throw new Error('Failed to get user ID');
      }

      const userUUID = userIdResponse.uuid;
      let analysisData;

      if (mode === 'roast') {
        const response = await fetch(`${API_BASE_URL}/analysis/roast/${userUUID}`, { method: 'POST' });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        analysisData = await response.json();
        displayRoastResults(analysisData, pins.length);
      } else if (mode === 'self-discovery') {
        const response = await fetch(`${API_BASE_URL}/analysis/self-discovery/${userUUID}`, { method: 'POST' });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        analysisData = await response.json();
        displaySelfDiscoveryResults(analysisData, pins.length);
      } else if (mode === 'friend') {
        // Friend mode requires chat interface
        statusEl.innerHTML = '<div class="loading">Friend mode coming soon!</div>';
        return;
      }

      statusEl.innerHTML = '';
      modeButtons.forEach(btn => btn.disabled = false);

    } catch (error) {
      statusEl.innerHTML = `<div class="error">${error.message}</div>`;
      modeButtons.forEach(btn => btn.disabled = false);
    }
  }

  // Display roast results
  function displayRoastResults(data, totalPins) {
    let html = `
      <div class="result-title">${data.personality_name}</div>

      <div class="result-section">
        <div class="result-label">ROAST</div>
        <div class="result-content">${data.roast}</div>
      </div>

      <div class="result-section">
        <div class="result-label">VIBE CHECK</div>
        <div class="result-content">${data.vibe_check}</div>
      </div>

      <div class="result-section">
        <div class="result-label">PERSONALITY BREAKDOWN</div>
    `;

    data.breakdown.forEach(item => {
      html += `
        <div class="breakdown-item">
          <span>${item.trait}</span>
          <span>${item.percentage}%</span>
        </div>
        <div class="breakdown-bar" style="width: ${item.percentage}%"></div>
      `;
    });

    html += `</div>`;
    html += `<div style="margin-top: 16px; font-size: 11px; color: #666; text-align: center;">Based on ${totalPins} Pinterest pins</div>`;

    resultsEl.innerHTML = html;
    resultsEl.style.display = 'block';
  }

  // Display self-discovery results
  function displaySelfDiscoveryResults(data, totalPins) {
    let html = `<div class="result-title">Self-Discovery Insights</div>`;

    // Insights
    if (data.insights?.length > 0) {
      html += `<div class="result-section">`;
      data.insights.forEach(insight => {
        html += `
          <div class="insight-item">
            <div class="insight-category">${insight.category}</div>
            <div class="insight-observation">${insight.observation}</div>
            <div class="insight-driver">${insight.psychological_drivers}</div>
          </div>
        `;
      });
      html += `</div>`;
    }

    // Action items
    if (data.action_items?.length > 0) {
      html += `
        <div class="result-section">
          <div class="result-label">ACTION ITEMS</div>
      `;
      data.action_items.forEach(item => {
        html += `<div class="action-item">• ${item.suggestion}</div>`;
      });
      html += `</div>`;
    }

    html += `<div style="margin-top: 16px; font-size: 11px; color: #666; text-align: center;">Based on ${totalPins} Pinterest pins</div>`;

    resultsEl.innerHTML = html;
    resultsEl.style.display = 'block';
  }
});
