/**
 * Quirk Extension Popup
 * Main UI for triggering personality analysis with browsing analytics
 */

// API Configuration
const API_BASE_URL = 'https://quirk-kvxe.onrender.com/api/v1';
// For local dev, change to: const API_BASE_URL = 'http://localhost:8000/api/v1';

document.addEventListener('DOMContentLoaded', async function() {
  const modeButtons = document.querySelectorAll('.mode-btn');
  const statusEl = document.getElementById('status');
  const resultsEl = document.getElementById('results');
  const analyticsBtn = document.getElementById('view-analytics');
  const analyticsDisplay = document.getElementById('analytics-display');

  // Smart sync: Only sync if last sync was > 10 minutes ago
  smartSyncBrowsingData();

  // Smart sync: Only sync if data is stale (> 10 minutes)
  async function smartSyncBrowsingData() {
    try {
      const { lastSync } = await chrome.storage.local.get('lastSync');
      const now = Date.now();
      const TEN_MINUTES = 10 * 60 * 1000;

      // Only sync if last sync was > 10 minutes ago OR no previous sync
      if (!lastSync || (now - lastSync) > TEN_MINUTES) {
        console.log('🔄 Syncing browsing data (last sync was stale)...');
        const response = await chrome.runtime.sendMessage({
          action: 'collectAndSendBrowsingData'
        });
        await chrome.storage.local.set({ lastSync: now });
        console.log('✅ Browsing data synced:', response);
      } else {
        console.log('⏭️ Skipping sync (data is fresh)');
      }
    } catch (error) {
      console.log('Browsing sync skipped:', error.message);
    }
  }

  // Sync browsing data to backend (force sync)
  async function syncBrowsingData() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'collectAndSendBrowsingData'
      });

      if (!response.success) {
        console.error('❌ Browsing sync failed:', response.error);
        throw new Error(response.error || 'Failed to sync browsing data');
      }

      await chrome.storage.local.set({ lastSync: Date.now() });
      console.log('✅ Browsing data synced:', response);
      return response;
    } catch (error) {
      console.error('❌ Browsing sync error:', error.message);
      throw error; // Re-throw so caller knows it failed
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
      // Get user UUID first
      const userResponse = await chrome.runtime.sendMessage({ action: 'getUserUUID' });
      if (!userResponse?.success) {
        throw new Error('Failed to get user ID');
      }

      // Fetch analysis IMMEDIATELY (may get yesterday's data if early day)
      const response = await fetch(`${API_BASE_URL}/analysis/today/${userResponse.uuid}`);

      if (response.status === 404) {
        // No analysis found - trigger sync and wait for LLM processing
        statusEl.innerHTML = `<div style="color: #666;">📊 Collecting your browsing data...</div>`;

        try {
          await syncBrowsingData();
        } catch (syncError) {
          statusEl.innerHTML = `<div class="error">Failed to sync data: ${syncError.message}<br><br>Please check:<br>1. Backend is running<br>2. Database permissions are set<br>3. Check console for details</div>`;
          return;
        }

        // Poll for analysis with exponential backoff (LLM takes 5-10s)
        let attempts = 0;
        const maxAttempts = 4;
        const checkAnalysis = async () => {
          attempts++;
          try {
            statusEl.innerHTML = `<div style="color: #666;">🤖 AI is analyzing your data... (${attempts}/${maxAttempts})</div>`;

            const retryResponse = await fetch(`${API_BASE_URL}/analysis/today/${userResponse.uuid}`);
            if (retryResponse.ok) {
              const analysis = await retryResponse.json();
              displayAnalysisResults(analysis);
            } else if (attempts < maxAttempts) {
              // Retry with increasing delays: 2s, 4s, 6s
              setTimeout(checkAnalysis, attempts * 2000);
            } else {
              statusEl.innerHTML = `<div style="color: #d00;">No browsing data collected yet today. Start browsing to see your analytics!</div>`;
            }
          } catch (e) {
            if (attempts < maxAttempts) {
              setTimeout(checkAnalysis, attempts * 2000);
            } else {
              statusEl.innerHTML = `<div style="color: #d00;">Analysis not ready. Please try again in a few moments.</div>`;
            }
          }
        };

        // Start first check after 3 seconds
        setTimeout(checkAnalysis, 3000);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to get analysis: ${response.status}`);
      }

      const analysis = await response.json();
      displayAnalysisResults(analysis);

      // Trigger background sync for next time (non-blocking)
      syncBrowsingData().catch(() => {});

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

      // Show early day message if using yesterday's data
      let earlyDayMessage = '';
      if (analysis.early_day_fallback) {
        earlyDayMessage = `
          <div style="padding: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin-bottom: 16px; text-align: center; color: #856404;">
            ☀️ ${analysis.message || "You just started your day! Here's yesterday's data:"}
          </div>
        `;
      }

      // Display productivity score prominently
      let html = earlyDayMessage + `
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

      // Get user UUID
      const userIdResponse = await chrome.runtime.sendMessage({ action: 'getUserUUID' });
      if (!userIdResponse?.success) {
        throw new Error('Failed to get user ID');
      }

      const userUUID = userIdResponse.uuid;
      let analysisData;

      // Only roast mode is supported
      const response = await fetch(`${API_BASE_URL}/analysis/roast/${userUUID}`, { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `API error: ${response.status}`);
      }
      analysisData = await response.json();
      displayRoastResults(analysisData);

      statusEl.innerHTML = '';
      modeButtons.forEach(btn => btn.disabled = false);

    } catch (error) {
      statusEl.innerHTML = `<div class="error">${error.message}</div>`;
      modeButtons.forEach(btn => btn.disabled = false);
    }
  }

  // Display roast results (simplified)
  function displayRoastResults(data) {
    let html = `
      <div class="result-title">🔥 Your Roast</div>

      <div class="result-section">
        <div class="result-content" style="font-size: 15px; line-height: 1.8; white-space: pre-line;">
          ${data.roast}
        </div>
      </div>

      <div class="result-section">
        <div class="result-label">VIBE CHECK</div>
        <div class="result-content">${data.vibe}</div>
      </div>
    `;

    html += `<div style="margin-top: 20px; font-size: 11px; color: #666; text-align: center;">Based on your browsing patterns</div>`;

    resultsEl.innerHTML = html;
    resultsEl.style.display = 'block';
  }
});
