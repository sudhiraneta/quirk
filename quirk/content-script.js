/**
 * Quirk Content Script
 * Extracts Pinterest pin data from the page
 */

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractPins') {
    extractPinsFromPage()
      .then(pins => sendResponse({ success: true, pins }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

/**
 * Extract pin data from Pinterest page
 */
async function extractPinsFromPage() {
  console.log('Starting Pinterest pin extraction...');

  // Check if we're on Pinterest
  if (!window.location.hostname.includes('pinterest.com')) {
    throw new Error('Please navigate to Pinterest.com first!');
  }

  // Wait a bit for pins to load
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Extract pin data
  const pins = [];

  // Pinterest uses various selectors, try multiple approaches
  const pinElements = document.querySelectorAll('[data-test-id="pin"], [data-test-id="pinWrapper"], .pinWrapper, [data-grid-item="true"]');

  console.log(`Found ${pinElements.length} pin elements`);

  pinElements.forEach(pinEl => {
    const pin = {
      title: '',
      description: '',
      alt_text: '',
      board_name: '',
      category: 'uncategorized'
    };

    // Try to get image alt text
    const img = pinEl.querySelector('img');
    if (img) {
      pin.alt_text = img.alt || '';
    }

    // Try to get title
    const titleEl = pinEl.querySelector('[data-test-id="pinTitle"], h2, h3, .pinTitle');
    if (titleEl) {
      pin.title = titleEl.textContent || '';
    }

    // Try to get description
    const descEl = pinEl.querySelector('[data-test-id="pinDescription"], .pinDescription, [data-test-id="pin-description"]');
    if (descEl) {
      pin.description = descEl.textContent || '';
    }

    // Try to get board name (if on board page)
    const boardEl = document.querySelector('[data-test-id="board-name"], h1');
    if (boardEl && window.location.pathname.includes('/board/')) {
      pin.board_name = boardEl.textContent || '';
    }

    // Categorize based on keywords
    const fullText = `${pin.title} ${pin.description} ${pin.alt_text}`.toLowerCase();
    pin.category = categorizePin(fullText);

    // Only add pins that have some content
    if (pin.title || pin.description || pin.alt_text) {
      pins.push(pin);
    }
  });

  // If we didn't find pins with the above selectors, try images
  if (pins.length === 0) {
    console.log('Trying fallback method with images...');
    const allImages = document.querySelectorAll('img[alt]');
    allImages.forEach(img => {
      const altText = img.alt || '';
      if (altText && altText.length > 5 && !altText.includes('Pinterest')) {
        const fullText = altText.toLowerCase();
        pins.push({
          title: '',
          description: '',
          alt_text: altText,
          board_name: '',
          category: categorizePin(fullText)
        });
      }
    });
  }

  if (pins.length === 0) {
    throw new Error('No pins found. Try scrolling down to load more pins!');
  }

  console.log(`Extracted ${pins.length} pins`);
  return pins;
}

/**
 * Categorize pin based on keywords
 */
function categorizePin(text) {
  const categories = {
    'home_decor': ['home', 'decor', 'interior', 'furniture', 'room', 'house', 'design', 'aesthetic'],
    'food': ['food', 'recipe', 'cooking', 'baking', 'meal', 'dish', 'eat', 'breakfast', 'lunch', 'dinner'],
    'fashion': ['fashion', 'outfit', 'style', 'clothing', 'wear', 'dress', 'shoes', 'accessories'],
    'fitness': ['workout', 'fitness', 'exercise', 'gym', 'health', 'yoga', 'pilates', 'running'],
    'beauty': ['beauty', 'makeup', 'skincare', 'hair', 'nails', 'cosmetics'],
    'travel': ['travel', 'vacation', 'trip', 'destination', 'beach', 'mountain', 'adventure'],
    'art': ['art', 'painting', 'drawing', 'illustration', 'creative', 'artist'],
    'photography': ['photo', 'photography', 'camera', 'picture', 'aesthetic'],
    'diy': ['diy', 'craft', 'handmade', 'project', 'tutorial', 'how to']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category;
    }
  }

  return 'other';
}

console.log('Quirk content script loaded!');
