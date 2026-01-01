/**
 * Quirk Extension Popup
 * Main UI for triggering personality analysis with multiple modes
 */

const API_BASE_URL = 'https://quirk-kvxe.onrender.com/api/v1';  // Production API

document.addEventListener('DOMContentLoaded', function() {
  const modeButtons = document.querySelectorAll('.mode-btn');
  const statusEl = document.getElementById('status');
  const resultsEl = document.getElementById('results');
  const modeSelectionEl = document.getElementById('mode-selection');

  // Add click handlers to all mode buttons
  modeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode;
      await runAnalysis(mode);
    });
  });

  async function runAnalysis(mode) {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on Pinterest
      if (!tab.url.includes('pinterest.com')) {
        statusEl.innerHTML = '<div class="error">⚠️ Please open Pinterest first!<br>Go to pinterest.com and try again.</div>';
        return;
      }

      // Disable all buttons and show loading
      modeButtons.forEach(btn => btn.disabled = true);
      statusEl.innerHTML = '<div class="loading">🔮 Step 1/3: Collecting Pinterest data...</div>';
      resultsEl.style.display = 'none';

      // Step 1: Extract pins from Pinterest
      const pinsResponse = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'extractPins' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error('Please refresh Pinterest and try again'));
            return;
          }
          resolve(response);
        });
      });

      if (!pinsResponse || !pinsResponse.success) {
        throw new Error(pinsResponse?.error || 'Failed to extract pins');
      }

      const pins = pinsResponse.pins;
      console.log(`Extracted ${pins.length} pins`);

      // Step 2: Get user UUID
      statusEl.innerHTML = '<div class="loading">🔮 Step 2/3: Sending data to backend...</div>';

      const uuidResponse = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getUserUUID' }, (response) => {
          if (chrome.runtime.lastError || !response.success) {
            reject(new Error('Failed to get user ID'));
            return;
          }
          resolve(response);
        });
      });

      const userUUID = uuidResponse.uuid;

      // Step 3: Send pins to backend
      const sendResponse = await fetch(`${API_BASE_URL}/pinterest/pins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_uuid: userUUID,
          pins: pins
        })
      });

      if (!sendResponse.ok) {
        throw new Error(`Backend error: ${sendResponse.statusText}`);
      }

      console.log('Pins sent successfully');

      // Step 4: Run the selected analysis mode
      await runModeAnalysis(mode, userUUID, pins.length);

      // Re-enable buttons
      modeButtons.forEach(btn => btn.disabled = false);

    } catch (error) {
      console.error('Error:', error);
      statusEl.innerHTML = `<div class="error">⚠️ Error: ${error.message}<br>Make sure the backend is running!</div>`;
      modeButtons.forEach(btn => btn.disabled = false);
    }
  }

  async function runModeAnalysis(mode, userUUID, totalPins) {
    if (mode === 'roast') {
      statusEl.innerHTML = '<div class="loading">🔥 Step 3/3: Generating your roast...<br>This may take a moment...</div>';

      const response = await fetch(`${API_BASE_URL}/analysis/roast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_uuid: userUUID })
      });

      if (!response.ok) throw new Error(`Analysis failed: ${response.statusText}`);

      const data = await response.json();
      displayRoastResults(data, totalPins);

    } else if (mode === 'self-discovery') {
      statusEl.innerHTML = '<div class="loading">🧘 Step 3/3: Generating deep insights...<br>This may take 10-15 seconds...</div>';

      const response = await fetch(`${API_BASE_URL}/analysis/self-discovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_uuid: userUUID,
          focus_areas: ['wellness', 'productivity', 'creativity']
        })
      });

      if (!response.ok) throw new Error(`Analysis failed: ${response.statusText}`);

      const data = await response.json();
      displaySelfDiscoveryResults(data, totalPins);

    } else if (mode === 'friend') {
      statusEl.innerHTML = '<div class="loading">💬 Step 3/3: Starting conversation...<br>This may take a moment...</div>';

      const response = await fetch(`${API_BASE_URL}/conversation/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_uuid: userUUID,
          message: "Hey! Based on my Pinterest boards, what kind of person do you think I am?"
        })
      });

      if (!response.ok) throw new Error(`Conversation failed: ${response.statusText}`);

      const data = await response.json();
      displayFriendResults(data, totalPins);
    }
  }

  function displayRoastResults(data, totalPins) {
    statusEl.innerHTML = '🔥 Roast Complete!';

    let breakdownHTML = '';
    data.breakdown.forEach(item => {
      breakdownHTML += `
        <div class="percentage-bar">
          <div class="percentage-label">
            <span>${item.trait}</span>
            <span>${item.percentage}%</span>
          </div>
          <div class="bar">
            <div class="bar-fill" style="width: ${item.percentage}%"></div>
          </div>
        </div>
      `;
    });

    resultsEl.innerHTML = `
      <div class="results">
        <div class="personality-name">${data.personality_name}</div>
        <div class="roast-text">"${data.roast}"</div>
        <div class="vibe-check">✨ ${data.vibe_check}</div>
        <div class="breakdown">
          <div class="breakdown-title">Your Vibe Breakdown:</div>
          ${breakdownHTML}
        </div>
        <div class="pin-count">📌 Analyzed ${data.data_summary.pinterest_pins_analyzed} pins</div>
      </div>
    `;

    resultsEl.style.display = 'block';
    resultsEl.scrollIntoView({ behavior: 'smooth' });
  }

  function displaySelfDiscoveryResults(data, totalPins) {
    statusEl.innerHTML = '🧘 Self-Discovery Complete!';

    let insightsHTML = '';
    if (data.insights && data.insights.length > 0) {
      data.insights.forEach(insight => {
        insightsHTML += `
          <div style="margin-bottom: 15px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px;">
            <div style="font-weight: 600; margin-bottom: 5px;">${insight.category}</div>
            <div style="font-size: 13px; line-height: 1.5; margin-bottom: 8px;">${insight.observation}</div>
            <div style="font-size: 11px; opacity: 0.8; font-style: italic;">💭 ${insight.psychological_drivers}</div>
          </div>
        `;
      });
    }

    let actionItemsHTML = '';
    if (data.action_items && data.action_items.length > 0) {
      actionItemsHTML = '<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.3);">';
      actionItemsHTML += '<div style="font-weight: 600; margin-bottom: 10px;">🎯 Action Items:</div>';
      data.action_items.forEach((item, index) => {
        actionItemsHTML += `<div style="font-size: 12px; margin-bottom: 5px;">• ${item}</div>`;
      });
      actionItemsHTML += '</div>';
    }

    resultsEl.innerHTML = `
      <div class="results">
        <div class="personality-name">Your Self-Discovery Journey</div>
        <div style="margin-top: 15px;">
          ${insightsHTML || '<p>Insights are being generated...</p>'}
          ${actionItemsHTML}
        </div>
        <div class="pin-count">📌 Analyzed ${totalPins} pins</div>
      </div>
    `;

    resultsEl.style.display = 'block';
    resultsEl.scrollIntoView({ behavior: 'smooth' });
  }

  function displayFriendResults(data, totalPins) {
    statusEl.innerHTML = '💬 Friend Mode Active!';

    resultsEl.innerHTML = `
      <div class="results">
        <div class="personality-name">Your AI Friend Says:</div>
        <div class="roast-text">${data.message}</div>
        <div class="pin-count">📌 Based on ${totalPins} pins from your Pinterest</div>
      </div>
    `;

    resultsEl.style.display = 'block';
    resultsEl.scrollIntoView({ behavior: 'smooth' });
  }
});
