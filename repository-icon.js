// Repository icon functionality for GitHub Review Comments extension
(function() {
  'use strict';

  // Initialize shared namespace
  if (!window.GitHubReviewComments) {
    window.GitHubReviewComments = {};
  }

  const REPO_ICON_ID = 'github-issues-repo-icon';
  const BADGE_ID = 'github-issues-repo-icon-badge';
  const ICON_CONTAINER_ID = 'github-issues-repo-icon-container';

  // Check if we're on a repository main page (owner/repo only, no sub-paths)
  function isRepositoryMainPage() {
    const pathname = window.location.pathname;
    // Pattern: /owner/repo (exactly two segments, no trailing slash, no additional paths)
    const repoMainPagePattern = /^\/[^\/]+\/[^\/]+$/;
    return repoMainPagePattern.test(pathname);
  }

  // Extract repository owner and name from URL
  function getRepoInfo() {
    const pathname = window.location.pathname;
    // Pattern: /owner/repo
    const match = pathname.match(/^\/([^\/]+)\/([^\/]+)/);
    if (match && match[1] && match[2]) {
      return {
        owner: match[1],
        repo: match[2]
      };
    }
    return null;
  }

  // Extract GitHub blob URL with line number from issue body
  function extractBlobUrl(issueBody) {
    if (!issueBody) {
      return null;
    }

    // Regex pattern to match GitHub blob URLs with line numbers
    // Pattern: https://github.com/{owner}/{repo}/blob/{ref}/{filepath}#L{number} or #L{number}-L{number}
    const blobUrlPattern = /https:\/\/github\.com\/[^\/]+\/[^\/]+\/blob\/[^#]+#L\d+(?:-L\d+)?/;
    const match = issueBody.match(blobUrlPattern);
    
    if (match && match[0]) {
      return match[0];
    }
    
    return null;
  }

  // Fetch issues from GitHub API and count open issues with code references
  async function fetchOpenIssuesCount(owner, repo) {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`);
      
      if (!response.ok) {
        console.error('Failed to fetch issues:', response.status, response.statusText);
        return 0;
      }

      const issues = await response.json();
      
      // Filter out pull requests (issues have 'pull_request' field null)
      // Count only issues that have blob URLs in their body
      const count = issues.filter(issue => {
        // Exclude pull requests
        if (issue.pull_request) {
          return false;
        }
        
        // Must be open
        if (issue.state !== 'open') {
          return false;
        }
        
        // Must have a blob URL in the body
        return extractBlobUrl(issue.body) !== null;
      }).length;

      return count;
    } catch (error) {
      console.error('Error fetching issues count:', error);
      return 0;
    }
  }

  // Fetch open issues with code references and sort by issue number (lowest first)
  async function fetchIssuesWithCodeRefs(owner, repo) {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`);
      
      if (!response.ok) {
        console.error('Failed to fetch issues:', response.status, response.statusText);
        return [];
      }

      const issues = await response.json();
      
      // Filter to open issues (exclude pull requests) with blob URLs in body
      const filteredIssues = issues.filter(issue => {
        // Exclude pull requests
        if (issue.pull_request) {
          return false;
        }
        
        // Must be open
        if (issue.state !== 'open') {
          return false;
        }
        
        // Must have a blob URL in the body
        return extractBlobUrl(issue.body) !== null;
      });

      // Sort by issue number (lowest/oldest first)
      filteredIssues.sort((a, b) => a.number - b.number);

      return filteredIssues;
    } catch (error) {
      console.error('Error fetching issues with code refs:', error);
      return [];
    }
  }

  // Create badge element
  function createBadge(iconContainer) {
    // Check if badge already exists
    const existingBadge = document.getElementById(BADGE_ID);
    if (existingBadge) {
      return existingBadge;
    }

    const badge = document.createElement('div');
    badge.id = BADGE_ID;
    badge.textContent = '0';
    badge.style.cssText = `
      position: absolute;
      top: -5px;
      right: -5px;
      background-color: #dc2626;
      color: white;
      border-radius: 50%;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
      line-height: 1;
      box-sizing: border-box;
      z-index: 1000;
      pointer-events: none;
    `;

    iconContainer.appendChild(badge);
    return badge;
  }

  // Ensure wiggle animation styles are injected
  function ensureWiggleStyles() {
    if (document.getElementById('github-issues-wiggle-styles')) {
      return; // Styles already injected
    }

    const style = document.createElement('style');
    style.id = 'github-issues-wiggle-styles';
    style.textContent = `
      @keyframes github-issues-wiggle {
        0%, 100% { transform: rotate(0deg); }
        10% { transform: rotate(-5deg); }
        20% { transform: rotate(5deg); }
        30% { transform: rotate(-5deg); }
        40% { transform: rotate(5deg); }
        50% { transform: rotate(-3deg); }
        60% { transform: rotate(3deg); }
        70% { transform: rotate(-2deg); }
        80% { transform: rotate(2deg); }
        90% { transform: rotate(-1deg); }
      }
      .github-issues-icon-wiggle {
        animation: github-issues-wiggle 0.8s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }

  // Navigate to the first code link from open issues
  async function navigateToFirstCodeLink(owner, repo) {
    try {
      const issues = await fetchIssuesWithCodeRefs(owner, repo);
      
      if (issues.length === 0) {
        console.log('No open issues with code references found');
        return;
      }

      // Get the first issue (already sorted by issue number, lowest first)
      const firstIssue = issues[0];
      const blobUrl = extractBlobUrl(firstIssue.body);
      
      if (blobUrl) {
        // Store the issue URL so the sidebar highlights the correct comment
        await chrome.storage.local.set({ 'lastClickedComment': firstIssue.html_url });
        
        // Navigate to the blob URL
        window.location.href = blobUrl;
      } else {
        console.error('First issue does not have a valid blob URL');
      }
    } catch (error) {
      console.error('Error navigating to first code link:', error);
    }
  }

  // Update badge with count and wiggle icon if needed
  function updateBadge(count) {
    const badge = document.getElementById(BADGE_ID);
    const icon = document.getElementById(REPO_ICON_ID);
    const iconContainer = document.getElementById(ICON_CONTAINER_ID);
    
    if (badge) {
      badge.textContent = count.toString();
      // Adjust badge shape for larger numbers (make it more pill-shaped)
      if (count > 9) {
        badge.style.borderRadius = '9px';
        badge.style.padding = '0 5px';
      } else {
        badge.style.borderRadius = '50%';
        badge.style.padding = '0 4px';
      }
    }

    // Show or hide entire icon container based on count
    if (iconContainer) {
      if (count > 0) {
        iconContainer.style.display = 'inline-block';
        // Add wiggle animation when visible
        if (icon) {
          ensureWiggleStyles();
          icon.classList.add('github-issues-icon-wiggle');
        }
      } else {
        iconContainer.style.display = 'none';
        // Remove wiggle when hidden
        if (icon) {
          icon.classList.remove('github-issues-icon-wiggle');
        }
      }
    }
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

    // Create container for icon and badge (position relative for badge positioning)
    // Initially hidden until we know the count
    const iconContainer = document.createElement('div');
    iconContainer.id = ICON_CONTAINER_ID;
    iconContainer.style.cssText = `
      position: relative;
      display: none;
      margin-left: 8px;
      vertical-align: middle;
    `;

    // Create icon element
    const icon = document.createElement('img');
    icon.id = REPO_ICON_ID;
    icon.src = chrome.runtime.getURL('icons/CommentIcon48.png');
    icon.alt = 'Review Comments';
    icon.title = 'GitHub Review Comments Extension';
    icon.style.cssText = `
      height: 30px;
      width: auto;
      cursor: pointer;
    `;

    // Add click handler to navigate to first code link
    icon.addEventListener('click', async (e) => {
      const repoInfo = getRepoInfo();
      if (repoInfo) {
        await navigateToFirstCodeLink(repoInfo.owner, repoInfo.repo);
      }
    });

    // Append icon to container
    iconContainer.appendChild(icon);

    // Create badge
    createBadge(iconContainer);

    // Insert container into the repo-title-component div
    repoTitleComponent.appendChild(iconContainer);

    // Fetch and update badge count
    const repoInfo = getRepoInfo();
    if (repoInfo) {
      fetchOpenIssuesCount(repoInfo.owner, repoInfo.repo).then(count => {
        updateBadge(count);
      }).catch(error => {
        console.error('Error updating badge count:', error);
        updateBadge(0);
      });
    }
  }

  // Remove repository icon and badge
  function removeRepositoryIcon() {
    const icon = document.getElementById(REPO_ICON_ID);
    if (icon && icon.parentElement) {
      // Remove the container (which includes both icon and badge)
      icon.parentElement.remove();
    } else {
      // Fallback: remove badge separately if icon wasn't found
      const badge = document.getElementById(BADGE_ID);
      if (badge) {
        badge.remove();
      }
      if (icon) {
        icon.remove();
      }
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
        } else if (existingIcon && repoTitleComponent) {
          // Icon exists, update badge count if needed
          const repoInfo = getRepoInfo();
          if (repoInfo) {
            fetchOpenIssuesCount(repoInfo.owner, repoInfo.repo).then(count => {
              updateBadge(count);
            }).catch(error => {
              console.error('Error updating badge count:', error);
            });
          }
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

