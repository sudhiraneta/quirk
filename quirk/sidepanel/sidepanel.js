/**
 * Quirk Side Panel Script
 * Handles side panel interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  const openButton = document.getElementById('openQuirk');

  if (openButton) {
    openButton.addEventListener('click', () => {
      // In Manifest V3, we can't programmatically open the popup
      // Instead, direct user to click the extension icon
      alert('Click the Quirk extension icon in your toolbar to get started!');
    });
  }
});
