# Quirk Chrome Extension - Deployment Guide

Complete guide for testing locally and deploying to Chrome Web Store.

---

## 🧪 Testing Locally

### 1. Start the Backend Server

```bash
cd backend
source venv/bin/activate
python -m app.main
```

**Server should be running on:** `http://localhost:8000`

**Verify it's working:**
- Visit: http://localhost:8000 (should show welcome message)
- Visit: http://localhost:8000/docs (Swagger API docs)

### 2. Load Extension in Chrome

**Step-by-step:**

1. Open Chrome and go to: `chrome://extensions/`

2. Enable **"Developer mode"** (toggle in top right corner)

3. Click **"Load unpacked"**

4. Navigate to and select: `/Users/sudhirabadugu/PycharmProjects/quirk/quirk/`

5. Extension installed! You should see:
   - ✨ **Quirk - AI Personality Insights**
   - Version 2.0.0
   - Extension ID (save this for later)

### 3. Test the Extension

**Testing workflow:**

1. **Go to Pinterest:** https://pinterest.com
   - Log in to your Pinterest account
   - Browse some boards (scroll to load pins)

2. **Click the Quirk extension icon** (top right of Chrome)

3. **Click "Roast My Pinterest" button**

4. **Watch the magic happen:**
   - Step 1: Collecting Pinterest data...
   - Step 2: Sending data to backend...
   - Step 3: Generating your roast...
   - **Result:** Your personality roast appears!

### 4. Debugging

**Check Console Logs:**

1. Right-click extension icon → **"Inspect popup"**
2. Open **Console** tab
3. Look for:
   - "Extracted X pins"
   - "Pins sent successfully"
   - "Got roast: ..."

**Common Issues:**

| Issue | Solution |
|-------|----------|
| "Please refresh Pinterest" | Refresh the Pinterest page and try again |
| "No pins found" | Scroll down on Pinterest to load more pins |
| "Backend error" | Make sure backend server is running on port 8000 |
| "CORS error" | Backend should allow `chrome-extension://*` in CORS |

---

## 🚀 Production Deployment

### Part 1: Deploy Backend

**Recommended: Railway or Render**

#### Option A: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd backend
railway init

# Add environment variables
railway variables set OPENAI_API_KEY=sk-proj-your-key
railway variables set SUPABASE_URL=https://your-project.supabase.co
railway variables set SUPABASE_KEY=your-anon-key
railway variables set APP_ENV=production
railway variables set DEBUG=False

# Deploy
railway up
```

**Get your production URL:** e.g., `https://quirk-backend.up.railway.app`

#### Option B: Render

1. Go to https://render.com
2. Click **"New +" → "Web Service"**
3. Connect your GitHub repo
4. Configure:
   - **Name:** quirk-backend
   - **Root Directory:** backend
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables (same as above)
6. Click **"Create Web Service"**

**Get your production URL:** e.g., `https://quirk-backend.onrender.com`

### Part 2: Update Extension for Production

**Update API URLs:**

1. **Edit `quirk/popup.js`:**
   ```javascript
   // Line 6 - Change from:
   const API_BASE_URL = 'http://localhost:8000/api/v1';

   // To your production URL:
   const API_BASE_URL = 'https://your-backend.railway.app/api/v1';
   ```

2. **Edit `quirk/shared/constants.js`:**
   ```javascript
   // Line 6 - Change from:
   export const API_BASE_URL = 'http://localhost:8000/api/v1';

   // To:
   export const API_BASE_URL = 'https://your-backend.railway.app/api/v1';
   ```

3. **Edit `quirk/background/service-worker.js`:**
   ```javascript
   // Line 5 - Update the import path to use production URL
   // Or better yet, make it use the constant from shared/constants.js
   ```

**Important:** Make sure your backend CORS settings allow `chrome-extension://*`

### Part 3: Prepare for Chrome Web Store

**1. Create a Better Icon (Optional but Recommended)**

The current icon is a placeholder. Create a professional 128x128 PNG icon:
- Use Figma, Canva, or hire a designer on Fiverr ($5-20)
- Icon should be simple, recognizable, purple/gradient theme
- Replace: `quirk/icons/icon128.png`

**2. Take Screenshots**

For Chrome Web Store listing, you need:
- **1280x800** screenshots (at least 1, max 5)
- Show the extension in action

How to take screenshots:
1. Load extension in Chrome
2. Go to Pinterest, click extension
3. Use a screenshot tool to capture:
   - Initial popup
   - Loading states
   - Final results screen

**3. Create a Promotional Tile (Optional)**

- **440x280** image for Chrome Web Store
- Shows extension name and tagline

**4. Write Store Listing Copy**

Save this for the Chrome Web Store submission:

```
Name: Quirk - AI Personality Insights

Tagline: Get roasted by AI based on your Pinterest aesthetic

Description:
Quirk analyzes your Pinterest boards to reveal your true personality... and roast you for it. Powered by GPT-4o, Quirk sees through your carefully curated Pinterest boards to expose your actual vibe.

Features:
✨ AI-powered personality analysis from your Pinterest
🔥 Witty roasts based on your aesthetic
📊 Personality breakdown with percentages
🎯 Completely free to use

How it works:
1. Browse Pinterest normally
2. Click the Quirk icon
3. Get roasted by AI

Your data stays private - we only analyze publicly visible pins.

Made with ❤️ and GPT-4o
```

**Category:** Productivity
**Language:** English

### Part 4: Package Extension

**Create a ZIP file for Chrome Web Store:**

```bash
cd /Users/sudhirabadugu/PycharmProjects/quirk

# Create zip (exclude unnecessary files)
zip -r quirk-extension.zip quirk/ \
  -x "*.git*" \
  -x "*node_modules*" \
  -x "*test*" \
  -x "quirk/personality-templates.js"

# Zip file created: quirk-extension.zip
```

### Part 5: Submit to Chrome Web Store

**Prerequisites:**
- **Google Account**
- **$5 one-time developer registration fee**

**Steps:**

1. **Register as Chrome Web Store Developer**
   - Go to: https://chrome.google.com/webstore/devconsole
   - Pay $5 registration fee
   - Complete developer account setup

2. **Create New Item**
   - Click **"New Item"**
   - Upload `quirk-extension.zip`
   - Fill in store listing:
     - Product name
     - Description
     - Screenshots (1280x800)
     - Category: Productivity
     - Language: English

3. **Set Permissions Justification**

   You'll need to explain why you need these permissions:

   | Permission | Justification |
   |------------|---------------|
   | `storage` | Store user UUID and preferences locally |
   | `history` | (Remove if not using browsing history feature) |
   | `tabs` | Check if user is on Pinterest.com |
   | `activeTab` | Extract Pinterest pin data from current tab |
   | Pinterest host | Required to run content script on Pinterest |

4. **Privacy Policy (Required)**

   Create a simple privacy policy page. Example template:

   ```markdown
   # Quirk Privacy Policy

   ## Data Collection
   Quirk collects:
   - Pinterest pin titles, descriptions, and alt text visible on the current page
   - No personal information is collected
   - No browsing history outside Pinterest

   ## Data Usage
   - Data is sent to our backend API for AI analysis
   - Analysis results are temporarily cached for performance
   - We do not sell or share your data with third parties

   ## Data Storage
   - Pinterest data is processed by OpenAI's GPT-4o API
   - Results are cached for 1 hour, then deleted
   - You can delete your data by uninstalling the extension

   ## Contact
   For questions: your-email@example.com
   ```

   Host this on:
   - GitHub Pages (free)
   - Your own website
   - Or Google Sites

5. **Submit for Review**
   - Click **"Submit for Review"**
   - Review time: **1-3 business days** (usually faster)
   - Google will email you when approved/rejected

6. **Publish!**
   - Once approved, click **"Publish"**
   - Extension goes live on Chrome Web Store
   - Get your store URL: `https://chrome.google.com/webstore/detail/[extension-id]`

---

## 📋 Pre-Launch Checklist

Before submitting to Chrome Web Store:

- [ ] Backend deployed and working in production
- [ ] All API URLs updated to production endpoints
- [ ] Extension tested with production backend
- [ ] Icon replaced with professional version (optional but recommended)
- [ ] Screenshots taken (1280x800, at least 1)
- [ ] Privacy policy page created and hosted
- [ ] Store listing description written
- [ ] $5 developer fee paid
- [ ] Extension packaged as ZIP file
- [ ] Removed unused permissions from manifest
- [ ] Tested on clean Chrome profile (no dev tools)

---

## 🎯 Post-Launch

**Monitor Your Extension:**

1. **Chrome Web Store Developer Dashboard**
   - Check install count
   - Read user reviews
   - Monitor crash reports

2. **Backend Monitoring**
   - Watch API usage and costs (OpenAI, Supabase)
   - Monitor error rates
   - Check response times

3. **User Feedback**
   - Respond to reviews
   - Fix reported bugs
   - Add requested features

**Update Process:**

```bash
# Make changes to extension code
# Update version in manifest.json (2.0.0 → 2.0.1)
# Test changes locally
# Create new ZIP
# Upload to Chrome Web Store dashboard
# Submit for review
```

---

## 💡 Tips for Success

1. **Start with a limited release** - Publish to a small group first
2. **Monitor costs** - OpenAI API can get expensive with many users
3. **Add rate limiting** - Prevent abuse and control costs
4. **Collect feedback early** - Fix issues before wide release
5. **Market your extension** - Share on Reddit, ProductHunt, Twitter
6. **Consider monetization** - Premium features, subscription model

---

## 🆘 Troubleshooting

**Extension rejected from Chrome Web Store:**

Common reasons:
- **Excessive permissions** - Only request what you need
- **Missing privacy policy** - Required for data collection
- **Poor description** - Be clear about what extension does
- **Icon issues** - Must be clear, not pixelated

**Backend costs too high:**

Solutions:
- Add caching (already implemented)
- Implement rate limiting
- Use cheaper LLM model for roasts
- Add user authentication to prevent abuse

**Low adoption:**

Marketing strategies:
- Post on r/pinterest, r/SideProject, r/InternetIsBeautiful
- Submit to Product Hunt
- Create TikTok/Instagram showing results
- Reach out to tech influencers

---

**Good luck launching Quirk! 🚀✨**

Questions? Open an issue on GitHub.
