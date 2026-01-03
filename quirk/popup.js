/**
 * Quirk Extension Popup
 * Main UI for triggering personality analysis with browsing analytics
 */

import { API_BASE_URL } from './config.js';

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

  // Show TODAY's collected data with LLM analysis
  async function showBrowsingAnalytics() {
    statusEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      // Collect today's data and send to backend
      await syncBrowsingData();

      // Get user UUID
      const userResponse = await chrome.runtime.sendMessage({ action: 'getUserUUID' });
      if (!userResponse?.success) {
        throw new Error('Failed to get user ID');
      }

      // Fetch LLM analysis from backend
      const response = await fetch(`${API_BASE_URL}/analysis/today/${userResponse.uuid}`);

      if (response.status === 404) {
        // No analysis found - might need to wait or trigger it
        statusEl.innerHTML = `<div style="color: #666;">📊 No analysis available yet. Browsing data is being processed...</div>`;

        // Wait 2 seconds and retry once
        setTimeout(async () => {
          try {
            const retryResponse = await fetch(`${API_BASE_URL}/analysis/today/${userResponse.uuid}`);
            if (retryResponse.ok) {
              const analysis = await retryResponse.json();
              displayAnalysisResults(analysis);
            } else {
              statusEl.innerHTML = `<div style="color: #d00;">No browsing data collected yet today. Start browsing to see your analytics!</div>`;
            }
          } catch (e) {
            statusEl.innerHTML = `<div style="color: #d00;">Analysis not ready. Try again in a few moments.</div>`;
          }
        }, 2000);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to get analysis: ${response.status}`);
      }

      const analysis = await response.json();
      displayAnalysisResults(analysis);

    } catch (error) {
      statusEl.innerHTML = `<div class="error">Analysis unavailable: ${error.message}</div>`;
    }
  }

  // Helper function to display analysis results
  function displayAnalysisResults(analysis) {
    try {
      // Check if analysis is ready
      if (analysis.status === 'pending' || analysis.status === 'processing') {
        statusEl.innerHTML = `<div style="color: #666;">🤖 AI is analyzing your data... Check back in a few seconds!</div>`;
        return;
      }

      if (analysis.status !== 'completed') {
        statusEl.innerHTML = `<div style="color: #d00;">Analysis failed. Please try again.</div>`;
        return;
      }

      // Display productivity score prominently
      let html = `
        <div class="analytics-section" style="text-align: center; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 12px; color: black; margin-bottom: 16px;">
          <div style="font-size: 48px; font-weight: bold; margin-bottom: 8px;">${analysis.productivity_score || 0}</div>
          <div style="font-size: 14px; opacity: 0.9;">Productivity Score</div>
          <div style="font-size: 11px; opacity: 0.7; margin-top: 4px;">${analysis.date}</div>
        </div>
      `;

      // Summary
      if (analysis.summary) {
        html += `
          <div class="analytics-section">
            <div class="analytics-title">📊 Summary</div>
            <div style="font-size: 13px; line-height: 1.6; color: #333;">${analysis.summary}</div>
          </div>
        `;
      }

      // Top Productive Sites
      if (analysis.top_productive?.length > 0) {
        html += `
          <div class="analytics-section">
            <div class="analytics-title">✅ Top Productive</div>
        `;
        analysis.top_productive.forEach(item => {
          html += `
            <div class="stat-row">
              <span class="stat-label">${item.service}</span>
              <span class="stat-value">${item.visits} visits</span>
            </div>
          `;
        });
        html += `</div>`;
      }

      // Top Distractions
      if (analysis.top_distractions?.length > 0) {
        html += `
          <div class="analytics-section">
            <div class="analytics-title">📱 Top Distractions</div>
        `;
        analysis.top_distractions.forEach(item => {
          const warningFlag = item.warning ? '⚠️' : '';
          html += `
            <div class="stat-row">
              <span class="stat-label">${item.service} ${warningFlag}</span>
              <span class="stat-value">${item.visits} visits</span>
            </div>
          `;
        });
        html += `</div>`;
      }

      // Motivation
      if (analysis.motivation) {
        html += `
          <div class="analytics-section" style="border-left: 4px solid #000; padding: 12px;">
            <div class="analytics-title">💪 Motivation</div>
            <div style="font-size: 13px; color: #333; margin-top: 6px;">
              ${analysis.motivation}
            </div>
          </div>
        `;
      }

      analyticsDisplay.innerHTML = html;
      analyticsDisplay.style.display = 'block';
      statusEl.innerHTML = '';
    } catch (error) {
      statusEl.innerHTML = `<div class="error">Error displaying analysis: ${error.message}</div>`;
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
