/**
 * Quirk Extension Background Service Worker
 * Handles user initialization and background sync
 */

import { API_BASE_URL, STORAGE_KEYS } from '../shared/constants.js';
import { collectBrowsingHistory, getBrowsingAnalytics } from '../shared/browsing-tracker.js';

// Initialize user on extension install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Quirk extension installed!', details.reason);

  if (details.reason === 'install') {
    await initializeUser();
  }
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Initialize user with backend
async function initializeUser() {
  console.log('🔵 initializeUser() called');

  try {
    // Check if user already exists
    console.log('📦 Checking chrome.storage.local for existing UUID...');
    const { userUUID } = await chrome.storage.local.get(STORAGE_KEYS.USER_UUID);

    if (userUUID) {
      console.log('✅ User already initialized:', userUUID);
      return userUUID;
    }

    console.log('⚠️ No existing UUID found, creating new user...');

    // Log the API endpoint we're calling
    const apiUrl = `${API_BASE_URL}/users/initialize`;
    console.log('🌐 Calling API:', apiUrl);
    console.log('📤 Request method: POST');
    console.log('📤 Request body:', {
      extension_version: chrome.runtime.getManifest().version
    });

    // Create new user
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        extension_version: chrome.runtime.getManifest().version
      })
    });

    console.log('📥 Response status:', response.status, response.statusText);
    console.log('📥 Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API returned error status:', response.status);
      console.error('❌ Error response body:', errorText);
      throw new Error(`Failed to initialize user: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📥 Response data:', data);

    const uuid = data.user_uuid;
    console.log('🆔 New UUID generated:', uuid);

    // Save to storage
    console.log('💾 Saving UUID to chrome.storage.local...');
    await chrome.storage.local.set({ [STORAGE_KEYS.USER_UUID]: uuid });
    console.log('✅ User initialized successfully:', uuid);

    return uuid;
  } catch (error) {
    console.error('❌ ERROR in initializeUser():');
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);

    // Check for specific error types
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      console.error('🚨 NETWORK ERROR: Cannot reach backend server');
      console.error('🚨 Possible causes:');
      console.error('   1. Backend server is not reachable (check if API is down)');
      console.error('   2. CORS is blocking the request');
      console.error('   3. Firewall or network issue');
      console.error('🔧 Solution: Start backend with: cd backend && source venv/bin/activate && python -m app.main');
    }

    throw error;
  }
}

// Get or create user UUID
async function getUserUUID() {
  const { userUUID } = await chrome.storage.local.get(STORAGE_KEYS.USER_UUID);

  if (userUUID) {
    return userUUID;
  }

  return await initializeUser();
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getUserUUID') {
    getUserUUID()
      .then(uuid => sendResponse({ success: true, uuid }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async
  }

  if (request.action === 'sendPinsToBackend') {
    sendPinsToBackend(request.pins)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'collectAndSendBrowsingData') {
    collectAndSendBrowsingData()
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getBrowsingAnalytics') {
    collectBrowsingHistory(30)
      .then(data => {
        const analytics = getBrowsingAnalytics(data);
        sendResponse({ success: true, analytics });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Send pins to backend
async function sendPinsToBackend(pins) {
  try {
    const uuid = await getUserUUID();

    const response = await fetch(`${API_BASE_URL}/pinterest/pins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_uuid: uuid,
        pins: pins
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send pins: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending pins to backend:', error);
    throw error;
  }
}

// Collect and send browsing data to backend
async function collectAndSendBrowsingData() {
  try {
    console.log('📊 Collecting browsing history...');
    const uuid = await getUserUUID();

    // Collect last 30 days of browsing
    const browsingData = await collectBrowsingHistory(30);
    console.log(`📊 Collected ${browsingData.length} browsing items`);

    if (browsingData.length === 0) {
      return { message: 'No browsing data to send' };
    }

    // Send to backend
    const response = await fetch(`${API_BASE_URL}/browsing/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_uuid: uuid,
        browsing_data: browsingData
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send browsing data: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Browsing data sent successfully');
    return result;
  } catch (error) {
    console.error('Error sending browsing data:', error);
    throw error;
  }
}

// Export for use in other scripts
globalThis.getUserUUID = getUserUUID;
