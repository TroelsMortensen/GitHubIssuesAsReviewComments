// Repository icon functionality for GitHub Review Comments extension
(function() {
  'use strict';

  // Initialize shared namespace
  if (!window.GitHubReviewComments) {
    window.GitHubReviewComments = {};
  }

  const REPO_ICON_ID = 'github-issues-repo-icon';

  // Check if we're on a repository main page (owner/repo only, no sub-paths)
  function isRepositoryMainPage() {
    const pathname = window.location.pathname;
    // Pattern: /owner/repo (exactly two segments, no trailing slash, no additional paths)
    const repoMainPagePattern = /^\/[^\/]+\/[^\/]+$/;
    return repoMainPagePattern.test(pathname);
  }

  // Inject repository icon next to repository title
  async function injectRepositoryIcon() {
    // Check if extension is enabled (use shared utility)
    const utils = window.GitHubReviewComments?.utils;
    if (!utils) {
      return; // Utils not loaded yet
    }

    const isEnabled = await utils.checkExtensionEnabled();
    if (!isEnabled) {
      removeRepositoryIcon();
      return;
    }

    // Only on repository main page
    if (!isRepositoryMainPage()) {
      removeRepositoryIcon();
      return;
    }

    // Check if icon already exists
    const existingIcon = document.getElementById(REPO_ICON_ID);
    if (existingIcon) {
      return; // Icon already present
    }

    // Find repository title component
    const repoTitleComponent = document.getElementById('repo-title-component');
    if (!repoTitleComponent) {
      return; // Repository title not found yet
    }

    // Create icon element
    const icon = document.createElement('img');
    icon.id = REPO_ICON_ID;
    icon.src = chrome.runtime.getURL('icons/CommentIcon.png');
    icon.alt = 'Review Comments';
    icon.title = 'GitHub Review Comments Extension';
    icon.style.cssText = `
      height: 30px;
      width: auto;
      margin-left: 8px;
      vertical-align: middle;
      cursor: pointer;
    `;

    // Insert icon into the repo-title-component div
    repoTitleComponent.appendChild(icon);
  }

  // Remove repository icon
  function removeRepositoryIcon() {
    const icon = document.getElementById(REPO_ICON_ID);
    if (icon) {
      icon.remove();
    }
  }

  // Retry repository icon injection if element not found immediately
  // The repo-title-component might load after initial page load
  function retryRepositoryIconInjection(maxRetries = 5, delay = 500) {
    let retries = 0;
    const interval = setInterval(async () => {
      const utils = window.GitHubReviewComments?.utils;
      if (!utils) {
        if (retries >= maxRetries) {
          clearInterval(interval);
        }
        retries++;
        return;
      }

      const isEnabled = await utils.checkExtensionEnabled();
      if (!isEnabled || !isRepositoryMainPage()) {
        clearInterval(interval);
        return;
      }

      const existingIcon = document.getElementById(REPO_ICON_ID);
      const repoTitleComponent = document.getElementById('repo-title-component');
      
      if (existingIcon || (repoTitleComponent && retries > 0)) {
        if (!existingIcon && repoTitleComponent) {
          await injectRepositoryIcon();
        }
        clearInterval(interval);
      } else if (retries >= maxRetries) {
        clearInterval(interval);
      }
      retries++;
    }, delay);
  }

  // Initialize repository icon on page load
  function initRepositoryIcon() {
    injectRepositoryIcon();
    retryRepositoryIconInjection();
  }

  // Export functions via namespace
  window.GitHubReviewComments.repositoryIcon = {
    inject: injectRepositoryIcon,
    remove: removeRepositoryIcon,
    init: initRepositoryIcon,
    isRepositoryMainPage: isRepositoryMainPage
  };

  // Auto-initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRepositoryIcon);
  } else {
    initRepositoryIcon();
  }
})();

