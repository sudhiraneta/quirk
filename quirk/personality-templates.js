// Personality templates for Quirk extension

const personalityTemplates = {
  techMinimalist: {
    name: 'Tech Minimalist Queen',
    description: 'Alexandr Wang + Sofia Richie energy',
    keywords: ['minimalist', 'tech', 'startup', 'monochrome', 'clean', 'modern', 'silicon valley', 'workspace', 'productivity', 'gadgets', 'architecture', 'brutalist', 'neutral'],
    roasts: [
      "Your Pinterest is basically a grayscale Instagram ad for a startup that doesn't exist yet",
      "POV: You think owning a $400 mechanical keyboard is a personality trait",
      "Your aesthetic screams 'I have a Notion dashboard for my Notion dashboards'",
      "Tell me you work in tech without telling me you work in tech... oh wait, your pins already did",
      "Your vibe is 'minimalist' but your AWS bill definitely isn't"
    ],
    vibeCheck: "You're giving off major 'I code in a $2000 Herman Miller chair' energy"
  },

  gymBaddie: {
    name: 'Gym Baddie',
    description: 'Obsessed with fitness and that gym aesthetic',
    keywords: ['gym', 'workout', 'fitness', 'abs', 'training', 'gains', 'protein', 'athletic', 'sports', 'exercise', 'bodybuilding', 'transformation'],
    roasts: [
      "Your entire personality is gym selfies and protein shakes, and we're not mad about it",
      "POV: You've posted 'no days off' while taking a rest day",
      "Your Pinterest is 90% gym fits and 10% meal prep you'll never actually make",
      "We get it, you go to the gym. Your 47 workout outfit pins already told us",
      "Your aesthetic is 'I'm here for gains' but make it fashion"
    ],
    vibeCheck: "You're giving off major 'gym is my therapy' energy and honestly, valid"
  },

  pilatesPrincess: {
    name: 'Pilates Princess Energy',
    description: 'Hailey Bieber + Lola Tung vibes',
    keywords: ['pilates', 'wellness', 'beach', 'summer', 'romantic', 'soft', 'dreamy', 'golden hour', 'coastal', 'matcha', 'yoga', 'skincare', 'linen', 'sundress'],
    roasts: [
      "Your Pinterest board is literally just 'that girl' aesthetics and matcha lattes",
      "Let me guess: you own 17 different SPFs and they're all 'holy grail status'",
      "Your morning routine has more steps than a pilates class",
      "We get it, you're obsessed with 'coastal grandmother' energy and it shows",
      "Your vibe is 90% Erewhon smoothies and 10% pretending you don't care"
    ],
    vibeCheck: "You're one green juice away from starting a wellness blog nobody asked for"
  },

  chaoticFood: {
    name: 'Chaotic Food Curator',
    description: 'Molly Baz + Alison Roman style',
    keywords: ['food', 'recipe', 'cooking', 'baking', 'pasta', 'cheese', 'wine', 'dinner party', 'farmers market', 'sourdough', 'homemade', 'foodie', 'restaurant', 'brunch'],
    roasts: [
      "Your Pinterest is 80% recipes you'll never make and 20% more recipes you'll never make",
      "POV: You think making sourdough once makes you a 'bread person'",
      "Your saved recipes to actual cooking ratio is giving unemployment",
      "We see you pinning 'weeknight dinners' that take 3 hours and 47 ingredients",
      "Your aesthetic is 'I watch Bon Appétit videos at 2am for fun'"
    ],
    vibeCheck: "You have 847 saved pasta recipes but still order Postmates every night"
  },

  professionalVibe: {
    name: 'Professional Vibe Curator',
    description: 'Matilda Djerf + European summer',
    keywords: ['european', 'paris', 'italy', 'france', 'aesthetic', 'vintage', 'film', 'coffee', 'fashion', 'latte', 'croissant', 'street style', 'chic', 'effortless'],
    roasts: [
      "Your entire personality is 'European summer' but you've been to Paris once",
      "POV: You think drinking coffee in a cafe makes you a character in a French film",
      "Your vibe is 'main character energy' but the movie is just you taking 400 photos of a croissant",
      "We get it, you want to be Matilda Djerf. So does everyone else with this exact Pinterest board",
      "Your aesthetic screams 'I romanticize literally everything including my commute'"
    ],
    vibeCheck: "You're giving off 'I own a film camera but don't know how to use it' energy"
  },


  balancedBaddie: {
    name: 'The Balanced Baddie',
    description: 'Mix of all worlds',
    keywords: [],
    roasts: [
      "Can't pick a lane? Your Pinterest is having an identity crisis and honestly, same",
      "Your vibe is 'I contain multitudes' but make it chaotic and confusing",
      "POV: Your personality is as scattered as your Pinterest boards",
      "You're either incredibly well-rounded or just indecisive. We're leaning towards indecisive",
      "Your aesthetic is 'everything everywhere all at once' and we're exhausted just looking at it"
    ],
    vibeCheck: "You're a jack of all vibes, master of none, and that's iconic honestly"
  }
};

// Analysis keywords for categorizing pins
const aestheticKeywords = {
  techMinimalist: ['minimalist', 'tech', 'startup', 'monochrome', 'clean', 'modern', 'silicon valley', 'workspace', 'productivity', 'gadgets', 'architecture', 'brutalist', 'neutral', 'desk setup', 'macbook'],

  gymBaddie: ['gym', 'workout', 'fitness', 'abs', 'training', 'gains', 'protein', 'athletic', 'sports', 'exercise', 'bodybuilding', 'transformation', 'muscle', 'lifting', 'weights', 'squat', 'cardio', 'running', 'athlete', 'fit', 'health', 'body', 'routine'],

  pilatesPrincess: ['pilates', 'wellness', 'beach', 'summer', 'romantic', 'soft', 'dreamy', 'golden hour', 'coastal', 'matcha', 'yoga', 'skincare', 'linen', 'sundress', 'erewhon', 'smoothie bowl'],

  chaoticFood: ['food', 'recipe', 'cooking', 'baking', 'pasta', 'cheese', 'wine', 'dinner party', 'farmers market', 'sourdough', 'homemade', 'foodie', 'restaurant', 'brunch', 'coffee', 'bread'],

  professionalVibe: ['european', 'paris', 'italy', 'france', 'aesthetic', 'vintage', 'film', 'coffee', 'fashion', 'latte', 'croissant', 'street style', 'chic', 'effortless', 'magazine', 'vogue']
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { personalityTemplates, aestheticKeywords };
}
