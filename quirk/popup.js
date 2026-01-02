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

  // View analytics button
  analyticsBtn.addEventListener('click', async () => {
    if (analyticsDisplay.style.display === 'none') {
      await showBrowsingAnalytics();
    } else {
      analyticsDisplay.style.display = 'none';
    }
  });

  // Mode buttons
  modeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode;
      await runAnalysis(mode);
    });
  });

  // Show TODAY's collected data (Backend LLM integration coming soon)
  async function showBrowsingAnalytics() {
    statusEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      // Collect today's data and send to backend
      await syncBrowsingData();

      // For now, show a simple message
      // TODO: Replace with actual LLM analysis from backend
      const tempAnalysis = {
        productivity_score: "...",
        date: new Date().toISOString().split('T')[0],
        summary: "Data collected. Backend LLM analysis coming soon!"
      };

      const analysis = tempAnalysis;

      // Display productivity score prominently
      let html = `
        <div class="analytics-section" style="text-align: center; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 12px; color: black; margin-bottom: 16px;">
          <div style="font-size: 48px; font-weight: bold; margin-bottom: 8px;">${analysis.productivity_score}</div>
          <div style="font-size: 14px; opacity: 0.9;">Productivity Score</div>
          <div style="font-size: 11px; opacity: 0.7; margin-top: 4px;">${analysis.date}</div>
        </div>
      `;

      // Productivity Tools Used
      if (analysis.organized_data?.productivity_tools?.length > 0) {
        html += `
          <div class="analytics-section">
            <div class="analytics-title">✅ Productive Tools</div>
        `;
        analysis.organized_data.productivity_tools.forEach(tool => {
          html += `
            <div class="stat-row">
              <span class="stat-label">${tool.service}</span>
              <span class="stat-value">${tool.visit_count} visits</span>
            </div>
          `;
        });
        html += `</div>`;
      }

      // Social Media / Distractions
      if (analysis.organized_data?.social_media?.length > 0) {
        html += `
          <div class="analytics-section">
            <div class="analytics-title">📱 Social Media</div>
        `;
        analysis.organized_data.social_media.forEach(social => {
          const isWarning = social.productivity_value === 'negative';
          html += `
            <div class="stat-row">
              <span class="stat-label">${social.service}</span>
              <span class="stat-value">${social.visit_count} visits ${isWarning ? '⚠️' : ''}</span>
            </div>
          `;
        });
        html += `</div>`;
      }

      // Doom Scrolling Alert
      if (analysis.doom_scrolling_alert?.detected) {
        html += `
          <div class="analytics-section" style="border-left: 4px solid #000; padding: 12px;">
            <div class="analytics-title">🚨 Doom Scrolling Detected</div>
            <div style="font-size: 13px; color: #666; margin-top: 6px;">
              ${analysis.doom_scrolling_alert.message}
            </div>
          </div>
        `;
      }

      // Insights
      if (analysis.insights?.length > 0) {
        html += `
          <div class="analytics-section">
            <div class="analytics-title">💡 Insights</div>
        `;
        analysis.insights.forEach(insight => {
          html += `<div style="font-size: 13px; line-height: 1.6; padding: 6px 0; color: #333;">• ${insight}</div>`;
        });
        html += `</div>`;
      }

      analyticsDisplay.innerHTML = html;
      analyticsDisplay.style.display = 'block';
      statusEl.innerHTML = '';

    } catch (error) {
      statusEl.innerHTML = `<div class="error">Analysis unavailable: ${error.message}</div>`;
    }
  }

  // Run personality analysis
  async function runAnalysis(mode) {
    try {
      modeButtons.forEach(btn => btn.disabled = true);
      statusEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
      resultsEl.style.display = 'none';

      // Get browsing analytics
      const analyticsResponse = await chrome.runtime.sendMessage({
        action: 'getBrowsingAnalytics'
      });

      if (!analyticsResponse?.success) {
        throw new Error('Failed to get browsing analytics');
      }

      const analytics = analyticsResponse.analytics;
      statusEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

      // Get user UUID
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
        displayRoastResults(analysisData, analytics);
      } else if (mode === 'self-discovery') {
        const response = await fetch(`${API_BASE_URL}/analysis/self-discovery/${userUUID}`, { method: 'POST' });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        analysisData = await response.json();
        displaySelfDiscoveryResults(analysisData, analytics);
      }

      statusEl.innerHTML = '';
      modeButtons.forEach(btn => btn.disabled = false);

    } catch (error) {
      statusEl.innerHTML = `<div class="error">${error.message}</div>`;
      modeButtons.forEach(btn => btn.disabled = false);
    }
  }

  // Display roast results
  function displayRoastResults(data, analytics) {
    let html = `
      <div class="result-title">${data.personality_name || 'Your Digital Personality'}</div>

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

    if (data.breakdown?.length > 0) {
      data.breakdown.forEach(item => {
        html += `
          <div class="breakdown-item">
            <span>${item.trait}</span>
            <span>${item.percentage}%</span>
          </div>
          <div class="breakdown-bar" style="width: ${item.percentage}%"></div>
        `;
      });
    }

    html += `</div>`;
    html += `<div style="margin-top: 16px; font-size: 11px; color: #666; text-align: center;">Based on ${analytics.total_sites} sites, ${analytics.total_visits} visits</div>`;

    resultsEl.innerHTML = html;
    resultsEl.style.display = 'block';
  }

  // Display self-discovery results
  function displaySelfDiscoveryResults(data, analytics) {
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

    html += `<div style="margin-top: 16px; font-size: 11px; color: #666; text-align: center;">Based on ${analytics.total_sites} sites, ${analytics.total_visits} visits</div>`;

    resultsEl.innerHTML = html;
    resultsEl.style.display = 'block';
  }
});
