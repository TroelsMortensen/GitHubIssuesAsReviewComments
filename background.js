// Background service worker (Manifest V3)
chrome.runtime.onInstalled.addListener(() => {
  console.log('GitHub Issues As Review Comments extension installed');
});
