// Content script for Quirk extension

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzePinterest') {
    analyzePinterestBoard()
      .then(results => sendResponse({ success: true, data: results }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

// Extract Pinterest data
async function analyzePinterestBoard() {
  console.log('Starting Pinterest analysis...');

  // Check if we're on Pinterest
  if (!window.location.hostname.includes('pinterest.com')) {
    throw new Error('Please navigate to Pinterest.com first!');
  }

  // Wait a bit for pins to load
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Extract pin data
  const pins = extractPinData();

  if (pins.length === 0) {
    throw new Error('No pins found. Try scrolling down to load more pins!');
  }

  console.log(`Found ${pins.length} pins`);

  // Analyze aesthetic
  const analysis = analyzeAesthetic(pins);

  // Generate roast
  const roast = generateRoast(analysis);

  return {
    totalPins: pins.length,
    analysis: analysis,
    roast: roast
  };
}

// Extract pin titles, descriptions, and alt text
function extractPinData() {
  const pins = [];

  // Pinterest uses various selectors, try multiple approaches
  const pinElements = document.querySelectorAll('[data-test-id="pin"], [data-test-id="pinWrapper"], .pinWrapper');

  pinElements.forEach(pinEl => {
    const pin = {
      title: '',
      description: '',
      altText: '',
      boardName: ''
    };

    // Try to get image alt text
    const img = pinEl.querySelector('img');
    if (img) {
      pin.altText = (img.alt || '').toLowerCase();
    }

    // Try to get title
    const titleEl = pinEl.querySelector('[data-test-id="pinTitle"], h2, h3');
    if (titleEl) {
      pin.title = (titleEl.textContent || '').toLowerCase();
    }

    // Try to get description
    const descEl = pinEl.querySelector('[data-test-id="pinDescription"], .pinDescription');
    if (descEl) {
      pin.description = (descEl.textContent || '').toLowerCase();
    }

    // Combine all text for analysis
    pin.fullText = `${pin.title} ${pin.description} ${pin.altText}`.toLowerCase();

    if (pin.fullText.trim()) {
      pins.push(pin);
    }
  });

  // If we didn't find pins with the above selectors, try a more general approach
  if (pins.length === 0) {
    const allImages = document.querySelectorAll('img[alt]');
    allImages.forEach(img => {
      const altText = (img.alt || '').toLowerCase();
      if (altText && altText.length > 5) {
        pins.push({
          altText: altText,
          fullText: altText
        });
      }
    });
  }

  return pins;
}

// Analyze pins against personality types
function analyzeAesthetic(pins) {
  const scores = {
    techMinimalist: 0,
    gymBaddie: 0,
    pilatesPrincess: 0,
    chaoticFood: 0,
    professionalVibe: 0
  };

  const keywords = aestheticKeywords;

  pins.forEach(pin => {
    const text = pin.fullText;

    // Score each personality type
    Object.keys(keywords).forEach(personality => {
      const personalityKeywords = keywords[personality];
      personalityKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          scores[personality]++;
        }
      });
    });
  });

  // Calculate percentages
  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  const percentages = {};
  Object.keys(scores).forEach(personality => {
    percentages[personality] = total > 0 ? Math.round((scores[personality] / total) * 100) : 0;
  });

  // Determine dominant personality
  const sortedPersonalities = Object.entries(percentages)
    .sort(([, a], [, b]) => b - a);

  const dominantPersonality = sortedPersonalities[0][1] > 25
    ? sortedPersonalities[0][0]
    : 'balancedBaddie';

  return {
    scores: scores,
    percentages: percentages,
    dominantPersonality: dominantPersonality,
    sortedPersonalities: sortedPersonalities
  };
}

// Generate personalized roast
function generateRoast(analysis) {
  const personality = analysis.dominantPersonality;
  const template = personalityTemplates[personality];

  // Pick random roast from the personality
  const randomRoast = template.roasts[Math.floor(Math.random() * template.roasts.length)];

  return {
    personalityName: template.name,
    personalityDescription: template.description,
    mainRoast: randomRoast,
    vibeCheck: template.vibeCheck,
    percentages: analysis.percentages,
    breakdown: analysis.sortedPersonalities
  };
}

// Initialize
console.log('Quirk content script loaded');
