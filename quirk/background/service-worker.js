/**
 * Quirk Extension Background Service Worker
 * Handles user initialization and background sync
 */

import { API_BASE_URL, STORAGE_KEYS } from '../shared/constants.js';
import { collectTodayBrowsingHistory } from '../shared/browsing-tracker.js';

// Initialize user on extension install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Quirk extension installed!', details.reason);

  if (details.reason === 'install') {
    // Set side panel to show onboarding first
    chrome.sidePanel.setOptions({
      path: 'onboarding.html',
      enabled: true
    });
    console.log('👋 Onboarding page set in side panel');
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

    // Create user from backend
    const apiUrl = `${API_BASE_URL}/users/initialize`;
    console.log('🌐 Calling API:', apiUrl);

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API returned error status:', response.status);
      console.error('❌ Error response body:', errorText);
      throw new Error(`Failed to initialize user: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📥 Response data:', data);

    const uuid = data.user_uuid;
    console.log('🆔 New UUID:', uuid);

    // Save to storage
    console.log('💾 Saving UUID to chrome.storage.local...');
    await chrome.storage.local.set({
      [STORAGE_KEYS.USER_UUID]: uuid
    });
    console.log('✅ User initialized successfully:', uuid);

    return uuid;
  } catch (error) {
    console.error('❌ ERROR in initializeUser():');
    console.error('❌ Error message:', error.message);
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

  if (request.action === 'collectAndSendBrowsingData') {
    collectAndSendTodayBrowsingData()
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getTodayAnalysis') {
    getTodayAnalysisFromLLM()
      .then(analysis => sendResponse({ success: true, analysis }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'initializeUser') {
    initializeUser()
      .then(result => {
        // After successful init, switch side panel to main popup
        chrome.sidePanel.setOptions({ path: 'popup.html' });
        sendResponse({ success: true, result });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Collect and send TODAY's browsing data (raw, no organization)
async function collectAndSendTodayBrowsingData() {
  try {
    console.log('📊 Collecting TODAY\'s browsing history...');
    const uuid = await getUserUUID();

    // Collect TODAY's raw browsing data
    const todayData = await collectTodayBrowsingHistory();
    console.log(`📊 Collected ${todayData.length} sites from today`);

    if (todayData.length === 0) {
      return { message: 'No browsing data from today' };
    }

    // Send RAW data to backend - LLM will do ALL the analysis
    const response = await fetch(`${API_BASE_URL}/browsing/today`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_uuid: uuid,
        raw_data: todayData,  // Just raw URLs, titles, visit counts
        date: new Date().toISOString().split('T')[0]  // Today's date
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send browsing data: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Today\'s browsing data sent successfully');
    return result;
  } catch (error) {
    console.error('Error sending browsing data:', error);
    throw error;
  }
}

// Get today's analysis from LLM (productivity score, motivation, etc.)
async function getTodayAnalysisFromLLM() {
  try {
    const uuid = await getUserUUID();

    const response = await fetch(`${API_BASE_URL}/analysis/today/${uuid}`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Failed to get today's analysis: ${response.statusText}`);
    }

    const analysis = await response.json();
    console.log('✅ Got today\'s analysis from LLM');
    return analysis;
  } catch (error) {
    console.error('Error getting today\'s analysis:', error);
    throw error;
  }
}

// Export for use in other scripts
globalThis.getUserUUID = getUserUUID;
