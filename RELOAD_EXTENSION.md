# 🔄 How to Reload Extension Properly

## 🚨 CRITICAL FIXES

**Fixed files:**
- ✅ popup.html (main side panel) - BLACK & WHITE ONLY
- ✅ popup.js (analytics display) - BLACK & WHITE ONLY
- ✅ sidepanel/sidepanel.html - BLACK & WHITE ONLY
- ✅ manifest.json - Fixed permission: "identity.email" → "identity"
- ✅ Button renamed: "View Analytics" → "Today's Metrics"

**MUST RELOAD for permission fix to work!**

---

## 🚨 IMPORTANT: Hard Reload Required

Chrome caches extension files aggressively. You MUST do this:

### Step 1: Remove Extension Completely
```
1. Go to chrome://extensions/
2. Find "Quirk"
3. Click "Remove" button
4. Confirm removal
```

### Step 2: Reload Extension Fresh
```
1. Still on chrome://extensions/
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select: /Users/sudhirabadugu/PycharmProjects/quirk/quirk
5. Click "Select"
```

### Step 3: Test Side Panel
```
1. Click the Quirk icon in Chrome toolbar
2. Side panel should open automatically on the RIGHT side
3. Should see:
   - White background
   - Black text
   - 3 buttons (black and gray)
   - NO blue anywhere
```

---

## Side Panel Opens Automatically

**You don't need a button!**

The extension is configured to **automatically open side panel** when you click the icon:

**manifest.json:**
```json
"side_panel": {
  "default_path": "popup.html"  ← Uses popup.html
}
```

**service-worker.js:**
```javascript
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });  ← Opens automatically
});
```

---

## What You Should See

### Side Panel (Right Side of Browser)
```
┌─────────────────────┐
│ Quirk               │
│ Your digital        │
│ behavior, analyzed  │
│                     │
│ ┌─────────────────┐ │
│ │ View Analytics  │ │ ← Black button
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ Get Roasted     │ │ ← Gray button
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ Self-Discovery  │ │ ← Gray button
│ └─────────────────┘ │
└─────────────────────┘
```

**Colors:**
- Background: WHITE (#fff)
- Text: BLACK (#000)
- Gray text: #6b6b6b
- Borders: #e5e5e5
- Black button: #000 background, white text
- Gray button: #f9f9f9 background, black text

---

## If You Still See Blue

### Check Which File Is Loading
1. Open side panel
2. Right-click anywhere → Inspect
3. Go to "Sources" tab
4. Look at loaded HTML file
5. Should be: `popup.html` (NOT `sidepanel/sidepanel.html`)

### Force Clear Cache
```
1. Close all Chrome windows
2. Delete extension
3. Clear Chrome cache:
   - chrome://settings/clearBrowserData
   - Check "Cached images and files"
   - Time range: "All time"
   - Click "Clear data"
4. Restart Chrome
5. Reload extension from /quirk directory
```

---

## Current Configuration

| Setting | Value |
|---------|-------|
| Side panel file | `popup.html` |
| Opens on click | ✅ Automatic |
| Popup mode | ❌ Disabled |
| Colors | Black/White only |
| Buttons | 3 total |

---

## Troubleshooting

### "I see a popup, not side panel"
- Manifest has NO `default_popup` → Should be side panel
- Make sure you removed and re-loaded extension
- Try restarting Chrome

### "Still seeing blue"
- Hard reload: Remove extension → Clear cache → Reload
- Check if `sidepanel/sidepanel.html` is loading (it shouldn't)
- All blue styles removed from both files

### "Nothing happens when I click icon"
- Check service-worker.js is loaded
- Open console: chrome://extensions/ → Quirk → "service worker" link
- Look for errors

---

**After reload: White background, black text, 3 buttons, side panel opens automatically.**
