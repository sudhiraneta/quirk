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
      statusEl.innerHTML = '<div class="loading">🔮 Analyzing your Pinterest vibe...<br>This might take a few seconds...</div>';

      // Send message to content script
      chrome.tabs.sendMessage(tab.id, { action: 'analyzePinterest' }, (response) => {
        if (chrome.runtime.lastError) {
          statusEl.innerHTML = '<div class="error">⚠️ Error: Please refresh Pinterest and try again.<br>(Make sure you\'re logged in!)</div>';
          activateBtn.disabled = false;
          return;
        }

        if (!response || !response.success) {
          statusEl.innerHTML = `<div class="error">⚠️ ${response?.error || 'Something went wrong. Try scrolling on Pinterest first!'}</div>`;
          activateBtn.disabled = false;
          return;
        }

        // Display results
        displayResults(response.data);
        activateBtn.disabled = false;
      });

    } catch (error) {
      statusEl.innerHTML = `<div class="error">⚠️ Error: ${error.message}</div>`;
      activateBtn.disabled = false;
    }
  });

  function displayResults(data) {
    const { roast, totalPins } = data;

    statusEl.innerHTML = '🎯 Analysis Complete!';

    // Build personality breakdown HTML
    let breakdownHTML = '';
    roast.breakdown.forEach(([personality, percentage]) => {
      if (percentage > 0) {
        const personalityNames = {
          techMinimalist: 'Tech Minimalist Queen',
          gymBaddie: 'Gym Baddie',
          pilatesPrincess: 'Pilates Princess',
          chaoticFood: 'Chaotic Food Curator',
          professionalVibe: 'Professional Vibe Curator',
          balancedBaddie: 'Balanced Baddie'
        };

        breakdownHTML += `
          <div class="percentage-bar">
            <div class="percentage-label">
              <span>${personalityNames[personality] || personality}</span>
              <span>${percentage}%</span>
            </div>
            <div class="bar">
              <div class="bar-fill" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
      }
    });

    resultsEl.innerHTML = `
      <div class="results">
        <div class="personality-name">${roast.personalityName}</div>
        <div class="personality-desc">${roast.personalityDescription}</div>

        <div class="roast-text">"${roast.mainRoast}"</div>

        <div class="vibe-check">✨ ${roast.vibeCheck}</div>

        <div class="breakdown">
          <div class="breakdown-title">Your Vibe Breakdown:</div>
          ${breakdownHTML}
        </div>

        <div class="pin-count">Analyzed ${totalPins} pins</div>
      </div>
    `;

    resultsEl.style.display = 'block';

    // Scroll to results
    resultsEl.scrollIntoView({ behavior: 'smooth' });
  }
});
