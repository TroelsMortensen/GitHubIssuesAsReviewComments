// Shared utility functions for GitHub Review Comments extension
(function() {
  'use strict';

  // Initialize shared namespace
  if (!window.GitHubReviewComments) {
    window.GitHubReviewComments = {};
  }

  // Extension enabled state (default to true)
  let extensionEnabled = true;

  // Check if extension is enabled
  async function checkExtensionEnabled() {
    try {
      const result = await chrome.storage.local.get(['extensionEnabled']);
      extensionEnabled = result.extensionEnabled !== false; // Default to true if not set
      return extensionEnabled;
    } catch (error) {
      console.error('Error checking extension state:', error);
      return true; // Default to enabled on error
    }
  }

  // Get current extension enabled state (synchronous, uses cached value)
  function getExtensionEnabled() {
    return extensionEnabled;
  }

  // Set extension enabled state (for internal use)
  function setExtensionEnabled(enabled) {
    extensionEnabled = enabled;
  }

  // Export functions via namespace
  window.GitHubReviewComments.utils = {
    checkExtensionEnabled: checkExtensionEnabled,
    getExtensionEnabled: getExtensionEnabled,
    setExtensionEnabled: setExtensionEnabled
  };
})();

