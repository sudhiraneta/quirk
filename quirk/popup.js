/**
 * Quirk Extension Popup
 * Main UI for triggering personality analysis
 */

const API_BASE_URL = 'http://localhost:8000/api/v1';  // Change for production

document.addEventListener('DOMContentLoaded', function() {
  const activateBtn = document.getElementById('activate');
  const statusEl = document.getElementById('status');
  const resultsEl = document.getElementById('results');

  activateBtn.addEventListener('click', async () => {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on Pinterest
      if (!tab.url.includes('pinterest.com')) {
        statusEl.innerHTML = '<div class="error">⚠️ Please open Pinterest first!<br>Go to pinterest.com and try again.</div>';
        return;
      }

      // Disable button and show loading
      activateBtn.disabled = true;
      statusEl.innerHTML = '<div class="loading">🔮 Step 1/3: Collecting Pinterest data...</div>';

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

      // Step 4: Get roast analysis
      statusEl.innerHTML = '<div class="loading">🔮 Step 3/3: Generating your roast...<br>This may take a moment...</div>';

      const roastResponse = await fetch(`${API_BASE_URL}/analysis/roast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_uuid: userUUID
        })
      });

      if (!roastResponse.ok) {
        throw new Error(`Analysis failed: ${roastResponse.statusText}`);
      }

      const roastData = await roastResponse.json();
      console.log('Got roast:', roastData);

      // Display results
      displayResults(roastData, pins.length);
      activateBtn.disabled = false;

    } catch (error) {
      console.error('Error:', error);
      statusEl.innerHTML = `<div class="error">⚠️ Error: ${error.message}<br>Make sure the backend is running!</div>`;
      activateBtn.disabled = false;
    }
  });

  function displayResults(roastData, totalPins) {
    statusEl.innerHTML = '🎯 Analysis Complete!';

    // Build personality breakdown HTML
    let breakdownHTML = '';
    roastData.breakdown.forEach(item => {
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
        <div class="personality-name">${roastData.personality_name}</div>

        <div class="roast-text">"${roastData.roast}"</div>

        <div class="vibe-check">✨ ${roastData.vibe_check}</div>

        <div class="breakdown">
          <div class="breakdown-title">Your Vibe Breakdown:</div>
          ${breakdownHTML}
        </div>

        <div class="pin-count">📌 Analyzed ${roastData.data_summary.pinterest_pins_analyzed} pins</div>
      </div>
    `;

    resultsEl.style.display = 'block';

    // Scroll to results
    resultsEl.scrollIntoView({ behavior: 'smooth' });
  }
});
