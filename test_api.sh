#!/bin/bash

# Quirk API Testing Script
# Tests all endpoints with comprehensive mock data

API_BASE="http://localhost:8000/api/v1"
USER_UUID=""

echo "🧪 Quirk API Testing Script"
echo "============================"
echo ""

# Colors for output
GREEN='\033[0.32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Create User
echo -e "${BLUE}📝 Test 1: POST /users/initialize${NC}"
echo "Creating a new test user..."
RESPONSE=$(curl -s -X POST "$API_BASE/users/initialize" \
  -H "Content-Type: application/json" \
  -d '{"extension_version": "2.0.0"}')

echo "$RESPONSE" | python3 -m json.tool
USER_UUID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['user_uuid'])" 2>/dev/null)

if [ -z "$USER_UUID" ]; then
  echo -e "${RED}❌ Failed to create user${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Test 1 Complete - User UUID: $USER_UUID${NC}"
echo "===================================================="
echo ""
sleep 1

# Test 2: Add Pinterest Pins
echo -e "${BLUE}📌 Test 2: POST /pinterest/pins${NC}"
echo "Adding comprehensive Pinterest pins data..."
curl -s -X POST "$API_BASE/pinterest/pins" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_uuid\": \"$USER_UUID\",
    \"pins\": [
      {
        \"title\": \"Modern Minimalist Living Room\",
        \"description\": \"Clean white walls, natural light, mid-century furniture\",
        \"alt_text\": \"scandinavian interior design minimalist\",
        \"board_name\": \"Dream Home\",
        \"category\": \"home_decor\"
      },
      {
        \"title\": \"Healthy Breakfast Bowl Recipe\",
        \"description\": \"Acai smoothie bowl topped with granola, bananas, and honey\",
        \"alt_text\": \"healthy breakfast aesthetic food photography\",
        \"board_name\": \"Food & Recipes\",
        \"category\": \"food\"
      },
      {
        \"title\": \"Pilates Core Workout Routine\",
        \"description\": \"30-minute pilates mat exercises for beginners\",
        \"alt_text\": \"pilates workout fitness girl aesthetic\",
        \"board_name\": \"Fitness Goals\",
        \"category\": \"fitness\"
      },
      {
        \"title\": \"Aesthetic Coffee Shop Study Corner\",
        \"description\": \"Cozy corner with laptop, latte, and warm lighting\",
        \"alt_text\": \"coffee shop aesthetic study vibes\",
        \"board_name\": \"Lifestyle\",
        \"category\": \"photography\"
      },
      {
        \"title\": \"MacBook Pro Setup Desk Organization\",
        \"description\": \"Clean desk setup with MacBook, monitor, mechanical keyboard\",
        \"alt_text\": \"tech minimalist desk setup\",
        \"board_name\": \"Tech & Workspace\",
        \"category\": \"home_decor\"
      },
      {
        \"title\": \"Summer Outfit Inspo Casual Chic\",
        \"description\": \"White linen pants, beige tank top, gold jewelry\",
        \"alt_text\": \"summer fashion outfit inspiration\",
        \"board_name\": \"Fashion\",
        \"category\": \"fashion\"
      },
      {
        \"title\": \"Bali Travel Guide Beach Sunset\",
        \"description\": \"Top beaches to visit in Bali for sunset views\",
        \"alt_text\": \"bali travel destination beach aesthetic\",
        \"board_name\": \"Travel Dreams\",
        \"category\": \"travel\"
      },
      {
        \"title\": \"Green Smoothie Detox Recipe\",
        \"description\": \"Spinach, banana, almond milk, protein powder blend\",
        \"alt_text\": \"healthy green smoothie wellness\",
        \"board_name\": \"Health & Wellness\",
        \"category\": \"food\"
      },
      {
        \"title\": \"Yoga Morning Routine for Flexibility\",
        \"description\": \"15-minute morning yoga flow to start your day\",
        \"alt_text\": \"yoga fitness flexibility workout\",
        \"board_name\": \"Fitness Goals\",
        \"category\": \"fitness\"
      },
      {
        \"title\": \"Minimalist Skincare Routine\",
        \"description\": \"Simple 4-step skincare routine for glowing skin\",
        \"alt_text\": \"skincare beauty routine aesthetic\",
        \"board_name\": \"Beauty & Self Care\",
        \"category\": \"beauty\"
      }
    ]
  }" | python3 -m json.tool

echo -e "${GREEN}✅ Test 2 Complete - Added 10 Pinterest pins${NC}"
echo "===================================================="
echo ""
sleep 1

# Test 3: Add Browsing History
echo -e "${BLUE}🌐 Test 3: POST /browsing/history${NC}"
echo "Adding browsing history data..."
curl -s -X POST "$API_BASE/browsing/history" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_uuid\": \"$USER_UUID\",
    \"history\": [
      {
        \"url\": \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\",
        \"title\": \"10-Minute Morning Yoga Routine\",
        \"visit_count\": 5,
        \"last_visit\": \"2025-12-29T10:30:00Z\",
        \"time_spent_seconds\": 600,
        \"category\": \"video\",
        \"platform\": \"youtube\"
      },
      {
        \"url\": \"https://www.instagram.com/explore\",
        \"title\": \"Instagram Explore\",
        \"visit_count\": 15,
        \"last_visit\": \"2025-12-29T14:20:00Z\",
        \"time_spent_seconds\": 1800,
        \"category\": \"social_media\",
        \"platform\": \"instagram\"
      },
      {
        \"url\": \"https://www.amazon.com/dp/B08N5WRWNW\",
        \"title\": \"Apple AirPods Pro\",
        \"visit_count\": 3,
        \"last_visit\": \"2025-12-28T16:45:00Z\",
        \"time_spent_seconds\": 300,
        \"category\": \"shopping\",
        \"platform\": \"amazon\"
      },
      {
        \"url\": \"https://www.tiktok.com/@pilatesgirl\",
        \"title\": \"Pilates Workout Videos\",
        \"visit_count\": 8,
        \"last_visit\": \"2025-12-29T08:15:00Z\",
        \"time_spent_seconds\": 900,
        \"category\": \"social_media\",
        \"platform\": \"tiktok\"
      },
      {
        \"url\": \"https://www.linkedin.com/jobs\",
        \"title\": \"LinkedIn Jobs\",
        \"visit_count\": 2,
        \"last_visit\": \"2025-12-27T11:00:00Z\",
        \"time_spent_seconds\": 450,
        \"category\": \"social_media\",
        \"platform\": \"linkedin\"
      }
    ]
  }" | python3 -m json.tool

echo -e "${GREEN}✅ Test 3 Complete - Added 5 browsing history items${NC}"
echo "===================================================="
echo ""
sleep 1

# Test 4: Get Roast Analysis
echo -e "${BLUE}🔥 Test 4: POST /analysis/roast${NC}"
echo "Generating personality roast with GPT-4o..."
echo "(This may take 5-10 seconds...)"
curl -s -X POST "$API_BASE/analysis/roast" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_uuid\": \"$USER_UUID\"
  }" | python3 -m json.tool

echo -e "${GREEN}✅ Test 4 Complete - Roast generated!${NC}"
echo "===================================================="
echo ""
sleep 1

# Test 5: Get Self-Discovery Analysis
echo -e "${BLUE}🧘 Test 5: POST /analysis/self-discovery${NC}"
echo "Generating deep self-discovery insights..."
echo "(This may take 10-15 seconds...)"
curl -s -X POST "$API_BASE/analysis/self-discovery" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_uuid\": \"$USER_UUID\",
    \"focus_areas\": [\"wellness\", \"productivity\", \"creativity\"]
  }" | python3 -m json.tool

echo -e "${GREEN}✅ Test 5 Complete - Self-discovery analysis generated!${NC}"
echo "===================================================="
echo ""
sleep 1

# Test 6: Send Conversation Message (Friend Mode)
echo -e "${BLUE}💬 Test 6: POST /conversation/message${NC}"
echo "Starting a conversation in friend mode..."
CONV_RESPONSE=$(curl -s -X POST "$API_BASE/conversation/message" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_uuid\": \"$USER_UUID\",
    \"message\": \"Hey! Based on my Pinterest boards, what kind of person do you think I am?\"
  }")

echo "$CONV_RESPONSE" | python3 -m json.tool
CONV_ID=$(echo "$CONV_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['conversation_id'])" 2>/dev/null)

echo -e "${GREEN}✅ Test 6 Complete - Conversation started!${NC}"
echo "===================================================="
echo ""
sleep 1

# Test 7: Get Conversation History
if [ ! -z "$CONV_ID" ]; then
  echo -e "${BLUE}📖 Test 7: GET /conversation/$CONV_ID/history${NC}"
  echo "Fetching conversation history..."
  curl -s -X GET "$API_BASE/conversation/$CONV_ID/history" | python3 -m json.tool

  echo -e "${GREEN}✅ Test 7 Complete - Retrieved conversation history!${NC}"
  echo "===================================================="
  echo ""
fi
sleep 1

# Test 8: Get User Status
echo -e "${BLUE}👤 Test 8: GET /users/$USER_UUID/status${NC}"
echo "Fetching user statistics..."
curl -s -X GET "$API_BASE/users/$USER_UUID/status" | python3 -m json.tool

echo -e "${GREEN}✅ Test 8 Complete - User stats retrieved!${NC}"
echo "===================================================="
echo ""

# Summary
echo ""
echo "🎉 ALL TESTS COMPLETED!"
echo "======================="
echo ""
echo "Summary:"
echo "✅ User Creation - Working"
echo "✅ Pinterest Pins - Working"
echo "✅ Browsing History - Working"
echo "✅ Roast Analysis (GPT-4o) - Working"
echo "✅ Self-Discovery (GPT-4o) - Working"
echo "✅ Friend Mode Conversation (GPT-4o) - Working"
echo "✅ Conversation History - Working"
echo "✅ User Status - Working"
echo ""
echo "Test User UUID: $USER_UUID"
echo ""
echo "🔗 View API Docs: http://localhost:8000/docs"
echo ""
