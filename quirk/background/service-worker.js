/**
 * Quirk Extension Background Service Worker
 * Handles user initialization and background sync
 */

import { API_BASE_URL, STORAGE_KEYS } from '../shared/constants.js';

// Initialize user on extension install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Quirk extension installed!', details.reason);

  if (details.reason === 'install') {
    await initializeUser();
  }
});

// Initialize user with backend
async function initializeUser() {
  try {
    // Check if user already exists
    const { userUUID } = await chrome.storage.local.get(STORAGE_KEYS.USER_UUID);

    if (userUUID) {
      console.log('User already initialized:', userUUID);
      return userUUID;
    }

    // Create new user
    const response = await fetch(`${API_BASE_URL}/users/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        extension_version: chrome.runtime.getManifest().version
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize user: ${response.statusText}`);
    }

    const data = await response.json();
    const uuid = data.user_uuid;

    // Save to storage
    await chrome.storage.local.set({ [STORAGE_KEYS.USER_UUID]: uuid });
    console.log('User initialized successfully:', uuid);

    return uuid;
  } catch (error) {
    console.error('Error initializing user:', error);
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

// Export for use in other scripts
globalThis.getUserUUID = getUserUUID;
