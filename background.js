// Background service worker (Manifest V3)

// Initialize badge on startup
async function initializeBadge() {
  const result = await chrome.storage.local.get(['extensionEnabled']);
  const isEnabled = result.extensionEnabled !== false; // Default to true
  if (isEnabled) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#6c757d' });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('GitHub Issues As Review Comments extension installed');
  // Set default state to enabled
  chrome.storage.local.set({ extensionEnabled: true });
  initializeBadge();
});

// Initialize badge when service worker starts
initializeBadge();

// Handle extension icon click to toggle on/off
chrome.action.onClicked.addListener(async (tab) => {
  // Only work on GitHub pages
  if (!tab.url || !tab.url.includes('github.com')) {
    return;
  }
  
  // Get current state
  const result = await chrome.storage.local.get(['extensionEnabled']);
  const currentState = result.extensionEnabled !== false; // Default to true if not set
  
  // Toggle state
  const newState = !currentState;
  await chrome.storage.local.set({ extensionEnabled: newState });
  
  // Update badge
  if (newState) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#6c757d' });
  }
  
  // Send message to content script to update state
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleExtension', enabled: newState });
  } catch (error) {
    // Content script might not be loaded yet, that's okay
    // State will be checked on next page load
  }
  
  // Reload the page to apply changes immediately
  chrome.tabs.reload(tab.id);
});
