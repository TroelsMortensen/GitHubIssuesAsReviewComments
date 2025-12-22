# Browser Extension for Chrome and Edge

A browser extension template that works with both Chrome and Edge browsers using Manifest V3.

## Project Structure

```
├── manifest.json       # Extension configuration
├── popup.html         # Popup UI
├── popup.css          # Popup styles
├── popup.js           # Popup logic
├── background.js      # Background service worker
├── content.js         # Content script (runs on web pages)
└── icons/             # Extension icons
```

## Installation

### Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this folder
5. The extension should now appear in your extensions list

### Edge

1. Open Edge and navigate to `edge://extensions/`
2. Enable "Developer mode" (toggle in bottom left)
3. Click "Load unpacked"
4. Select this folder
5. The extension should now appear in your extensions list

## Development

### Making Changes

- Edit the files as needed
- After making changes, go to the extensions page and click the reload icon (🔄) on your extension card
- For popup changes: Close and reopen the popup to see changes
- For content script changes: Reload the web page

### Testing

1. Test in Chrome first to ensure compatibility
2. Test in Edge (should work without modifications)
3. Check the browser console for errors:
   - Popup: Right-click popup → Inspect
   - Background: Go to `chrome://extensions/` → Details → Service Worker → Inspect
   - Content: Open DevTools on any webpage → Console tab

## Features Included

- ✅ Manifest V3 compliant
- ✅ Popup interface
- ✅ Background service worker
- ✅ Content script
- ✅ Storage API usage
- ✅ Message passing between components

## Customization

### Adding Icons

1. Create icons in sizes: 16x16, 48x48, and 128x128 pixels
2. Place them in the `icons/` folder
3. Update the paths in `manifest.json` if needed

### Adding Permissions

Edit `manifest.json` and add permissions as needed:
```json
"permissions": [
  "storage",
  "activeTab",
  "tabs",
  "bookmarks"
]
```

### Modifying the Popup

Edit `popup.html`, `popup.css`, and `popup.js` to customize the popup interface.

## Building for Distribution

1. Go to `chrome://extensions/` or `edge://extensions/`
2. Click "Pack extension"
3. Select this folder
4. This will create a `.crx` file (Chrome) or you can zip the folder for Edge

## Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Edge Extension Documentation](https://docs.microsoft.com/microsoft-edge/extensions-chromium/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)

