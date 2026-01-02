# 🚀 Quick Start: Gmail OAuth Setup (5 minutes)

## What You're Setting Up
Gmail login so each user gets their own account tied to their email address.

---

## ⚡ Fast Track Instructions

### 1️⃣ Get Extension ID (30 seconds)

```bash
# Open Chrome
chrome://extensions/

# Enable Developer Mode (toggle top-right)
# Click "Load unpacked" → Select: /Users/sudhirabadugu/PycharmProjects/quirk/quirk

# Copy the Extension ID that appears (looks like: abcd1234efgh5678...)
```

### 2️⃣ Google Cloud Console (3 minutes)

**Go to:** https://console.cloud.google.com/

**Step A - Create Project:**
1. Click "Select a project" → "NEW PROJECT"
2. Name: `Quirk` → CREATE

**Step B - Enable API:**
1. Search bar: "People API" → ENABLE

**Step C - OAuth Consent:**
1. Left menu: APIs & Services → OAuth consent screen
2. Select "External" → CREATE
3. Fill in:
   - App name: `Quirk`
   - User support email: `your@email.com`
   - Developer contact: `your@email.com`
4. Click SAVE AND CONTINUE
5. Scopes → ADD OR REMOVE SCOPES
   - Search: `userinfo.email`
   - Check the box → UPDATE
6. SAVE AND CONTINUE
7. Test users → ADD USERS → Add your Gmail → ADD
8. SAVE AND CONTINUE

**Step D - Create Credentials:**
1. Left menu: APIs & Services → Credentials
2. + CREATE CREDENTIALS → OAuth client ID
3. Application type: **Chrome Extension**
4. Name: `Quirk`
5. Item ID: **[Paste your Extension ID from Step 1]**
6. CREATE
7. **COPY the Client ID** (looks like: `123456-abc.apps.googleusercontent.com`)

### 3️⃣ Update manifest.json (10 seconds)

```bash
# Open file
code /Users/sudhirabadugu/PycharmProjects/quirk/quirk/manifest.json

# Find line 16 and replace:
"client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"

# With your actual Client ID:
"client_id": "123456-abc.apps.googleusercontent.com"
```

### 4️⃣ Test It! (1 minute)

```bash
# Reload extension in chrome://extensions/
# Click the Quirk icon
# Click "Sign in with Google"
# Should show OAuth popup → Authorize
# You're logged in! ✅
```

---

## 🎯 Expected Result

**Before OAuth:**
- Extension generates random UUID each time
- No user accounts
- Data not persistent

**After OAuth:**
- User logs in with Gmail
- Same email = Same UUID forever
- Data tied to their account
- Can reinstall and keep their data

---

## ⚠️ Current Issues to Fix

### ✅ Frontend: DONE
- Gmail OAuth login ✅
- User profile display ✅
- Logout functionality ✅

### ❌ Backend: NEEDS UPDATE

Your backend creates a **NEW user every time**, even for existing emails.

**Test:**
```bash
# First call
curl -X POST https://quirk-kvxe.onrender.com/api/v1/users/initialize \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "extension_version": "2.1.0"}'

# Returns: "user_uuid": "abc-123"

# Second call (SAME email)
curl -X POST https://quirk-kvxe.onrender.com/api/v1/users/initialize \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "extension_version": "2.1.0"}'

# Returns: "user_uuid": "def-456" ❌ SHOULD BE "abc-123"
```

**Backend Fix Needed:**
```python
# Before creating new user, check if email exists:
existing = db.query(User).filter(User.email == email).first()
if existing:
    return existing.uuid  # Return same UUID
else:
    create_new_user()  # Create new UUID
```

---

## 📞 Support

If stuck, check:
- `OAUTH_SETUP.md` for detailed troubleshooting
- Browser console (F12) for error messages
- Background service worker console for OAuth errors

---

## 🎉 You're Ready!

Once you:
1. ✅ Set up Google Cloud OAuth
2. ✅ Update manifest.json with Client ID
3. ❌ Fix backend to return existing UUID for existing emails

Your extension will have proper user accounts! 🚀
