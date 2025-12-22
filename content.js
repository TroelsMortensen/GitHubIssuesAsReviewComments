// Content script - runs on GitHub pages
(function() {
  'use strict';

  const SIDEBAR_ID = 'github-issues-sidebar';
  const REOPEN_BUTTON_ID = 'github-issues-reopen-button';
  
  // Check if we're on a blob page
  function isBlobPage() {
    return window.location.pathname.includes('/blob/');
  }

  // Extract repository owner and name from GitHub URL
  function getRepoInfo() {
    const pathParts = window.location.pathname.split('/').filter(part => part);
    // URL pattern: /{owner}/{repo}/blob/...
    if (pathParts.length >= 2) {
      return {
        owner: pathParts[0],
        repo: pathParts[1]
      };
    }
    return null;
  }

  // Find the target container (the div with class Box-sc-62in7e-0 hGzGyY)
  function findTargetContainer() {
    // Find the div with both classes Box-sc-62in7e-0 and hGzGyY
    const containers = document.querySelectorAll('.Box-sc-62in7e-0.hGzGyY');
    // Return the first one found (should be the code viewer container)
    return containers.length > 0 ? containers[0] : null;
  }

  // Find the toolbar container
  function findToolbarContainer() {
    // Find the div with class BlobViewHeader-module__Box_3--Kvpex
    const toolbar = document.querySelector('.BlobViewHeader-module__Box_3--Kvpex');
    return toolbar;
  }

  // Detect theme mode
  function isDarkMode() {
    return document.documentElement.getAttribute('data-color-mode') === 'dark' ||
           document.documentElement.classList.contains('dark') ||
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // Extract current file path from blob page URL
  function getCurrentFilePath() {
    if (!isBlobPage()) {
      return null;
    }
    
    const pathname = window.location.pathname;
    // Pattern: /{owner}/{repo}/blob/{ref}/{filepath}
    const blobMatch = pathname.match(/\/blob\/[^\/]+\/(.+)$/);
    
    if (blobMatch && blobMatch[1]) {
      return blobMatch[1];
    }
    
    return null;
  }

  // Extract file path from blob URL
  function extractFilePathFromBlobUrl(blobUrl) {
    if (!blobUrl) {
      return null;
    }
    
    // Pattern: https://github.com/{owner}/{repo}/blob/{ref}/{filepath}#L{number}
    const match = blobUrl.match(/\/blob\/[^\/]+\/([^#]+)/);
    
    if (match && match[1]) {
      return match[1];
    }
    
    return null;
  }

  // Extract filename with extension from file path
  function extractFilename(filePath) {
    if (!filePath) {
      return null;
    }
    
    // Get filename (text after last slash)
    const lastSlashIndex = filePath.lastIndexOf('/');
    const filename = lastSlashIndex >= 0 ? filePath.substring(lastSlashIndex + 1) : filePath;
    
    return filename;
  }

  // Extract GitHub blob URL with line number from issue body
  function extractBlobUrl(issueBody) {
    if (!issueBody) {
      return null;
    }

    // Regex pattern to match GitHub blob URLs with line numbers
    // Pattern: https://github.com/{owner}/{repo}/blob/{ref}/{filepath}#L{number}
    const blobUrlPattern = /https:\/\/github\.com\/[^\/]+\/[^\/]+\/blob\/[^#]+#L\d+/;
    const match = issueBody.match(blobUrlPattern);
    
    if (match && match[0]) {
      return match[0];
    }
    
    return null;
  }

  // Group issues by file path
  function groupIssuesByFile(issues, currentFilePath) {
    const groups = {};
    
    issues.forEach(issue => {
      const blobUrl = extractBlobUrl(issue.body);
      let filePath = null;
      
      if (blobUrl) {
        filePath = extractFilePathFromBlobUrl(blobUrl);
      }
      
      // Use file path as key, or "other" for issues without file references
      const key = filePath || 'other';
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(issue);
    });
    
    // Sort group keys: current file first, then others alphabetically
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === currentFilePath) return -1;
      if (b === currentFilePath) return 1;
      if (a === 'other') return 1;
      if (b === 'other') return -1;
      return a.localeCompare(b);
    });
    
    // Return sorted groups object
    const sortedGroups = {};
    sortedKeys.forEach(key => {
      sortedGroups[key] = groups[key];
    });
    
    return sortedGroups;
  }

  // Extract and clean issue body text, removing blob URLs
  function extractBodyText(issueBody) {
    if (!issueBody) {
      return '';
    }

    let bodyText = issueBody;
    
    // Remove blob URL if present
    const blobUrl = extractBlobUrl(bodyText);
    if (blobUrl) {
      bodyText = bodyText.replace(blobUrl, '').trim();
    }
    
    // Remove leading/trailing whitespace and newlines
    bodyText = bodyText.trim();
    
    // Remove multiple consecutive newlines
    bodyText = bodyText.replace(/\n\s*\n/g, '\n');
    
    // Trim again after cleaning
    bodyText = bodyText.trim();
    
    return bodyText;
  }

  // Render issues list in sidebar
  function renderIssues(sidebar, issues, error = null) {
    // Clear existing content
    sidebar.innerHTML = '';
    
    // Detect theme
    const dark = isDarkMode();
    const textColor = dark ? '#c9d1d9' : '#24292f';
    const borderColor = dark ? '#30363d' : '#d0d7de';
    const bgColor = dark ? '#0d1117' : '#ffffff';
    const hoverBgColor = dark ? '#161b22' : '#f6f8fa';
    
    // Set sidebar styles
    sidebar.style.cssText = `
      width: 300px;
      background-color: ${bgColor};
      border: 1px solid ${borderColor};
      flex-shrink: 0;
      padding: 16px;
      border-radius: 6px;
      margin-left: 16px;
      box-sizing: border-box;
      align-self: flex-start;
      overflow-y: auto;
      max-height: 100%;
    `;
    
    // Create header container
    const headerContainer = document.createElement('div');
    headerContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 0 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid ${borderColor};
    `;
    
    // Create header title
    const header = document.createElement('h3');
    header.textContent = 'Issues';
    header.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      color: ${textColor};
      margin: 0;
    `;
    headerContainer.appendChild(header);
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.setAttribute('aria-label', 'Close sidebar');
    closeButton.style.cssText = `
      background: none;
      border: none;
      color: ${dark ? '#8b949e' : '#656d76'};
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      padding: 4px 8px;
      margin: -4px -8px -4px 0;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      transition: background-color 0.2s, color 0.2s;
    `;
    
    // Hover effect
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.backgroundColor = hoverBgColor;
      closeButton.style.color = textColor;
    });
    
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.backgroundColor = 'transparent';
      closeButton.style.color = dark ? '#8b949e' : '#656d76';
    });
    
    // Close functionality
    closeButton.addEventListener('click', () => {
      sidebar.style.display = 'none';
    });
    
    headerContainer.appendChild(closeButton);
    sidebar.appendChild(headerContainer);
    
    // Show error state
    if (error) {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        padding: 12px;
        background-color: ${dark ? '#3d1300' : '#fff4e6'};
        border: 1px solid ${dark ? '#792e00' : '#ff9800'};
        border-radius: 6px;
        color: ${dark ? '#f85149' : '#d1242f'};
        font-size: 14px;
      `;
      errorDiv.textContent = error;
      sidebar.appendChild(errorDiv);
      return;
    }
    
    // Show loading state if no issues yet
    if (!issues) {
      const loadingDiv = document.createElement('div');
      loadingDiv.style.cssText = `
        padding: 12px;
        color: ${textColor};
        font-size: 14px;
        text-align: center;
      `;
      loadingDiv.textContent = 'Loading issues...';
      sidebar.appendChild(loadingDiv);
      return;
    }
    
    // Show empty state
    if (issues.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = `
        padding: 12px;
        color: ${dark ? '#8b949e' : '#656d76'};
        font-size: 14px;
        text-align: center;
      `;
      emptyDiv.textContent = 'No issues found';
      sidebar.appendChild(emptyDiv);
      return;
    }
    
    // Filter out closed issues
    const openIssues = issues.filter(issue => issue.state === 'open');
    
    // Show empty state if no open issues
    if (openIssues.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = `
        padding: 12px;
        color: ${dark ? '#8b949e' : '#656d76'};
        font-size: 14px;
        text-align: center;
      `;
      emptyDiv.textContent = 'No open issues found';
      sidebar.appendChild(emptyDiv);
      return;
    }
    
    // Get current file path and group issues by file
    const currentFilePath = getCurrentFilePath();
    const groupedIssues = groupIssuesByFile(openIssues, currentFilePath);
    
    // Create issues container
    const issuesContainer = document.createElement('div');
    issuesContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;
    
    // Iterate over grouped issues
    const fileGroups = Object.keys(groupedIssues);
    fileGroups.forEach((filePath, index) => {
      const fileIssues = groupedIssues[filePath];
      
      // Skip empty groups
      if (fileIssues.length === 0) {
        return;
      }
      
      // Create header for file group
      const headerDiv = document.createElement('div');
      let headerText;
      
      if (filePath === 'other') {
        headerText = 'Other issues';
      } else {
        headerText = extractFilename(filePath) || filePath;
      }
      
      headerDiv.textContent = headerText;
      headerDiv.style.cssText = `
        font-size: 14px;
        font-weight: 600;
        color: ${textColor};
        ${index > 0 ? 'margin-top: 16px;' : ''}
        margin-bottom: 8px;
        padding: 0 4px;
        text-align: center;
      `;
      
      // Add divider line below header
      const dividerDiv = document.createElement('div');
      dividerDiv.style.cssText = `
        height: 1px;
        background-color: ${borderColor};
        margin-bottom: 8px;
      `;
      
      issuesContainer.appendChild(headerDiv);
      issuesContainer.appendChild(dividerDiv);
      
      // Render issues for this file
      fileIssues.forEach(issue => {
        // Extract blob URL from issue body, fallback to issue URL
        const blobUrl = extractBlobUrl(issue.body);
        const linkUrl = blobUrl || issue.html_url;
        
        // Extract and clean body text
        const bodyText = extractBodyText(issue.body);
        
        // Skip if body is empty after cleaning
        if (!bodyText) {
          return;
        }
        
        // Create box/link element
        const issueBox = document.createElement('a');
        issueBox.href = linkUrl;
        issueBox.target = '_blank';
        issueBox.rel = 'noopener noreferrer';
        issueBox.textContent = bodyText;
        issueBox.style.cssText = `
          display: block;
          background-color: ${dark ? '#21262d' : '#ffffff'};
          border: 1px solid ${borderColor};
          border-radius: 6px;
          padding: 12px;
          color: ${textColor};
          text-decoration: none;
          font-size: 13px;
          line-height: 1.5;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
          overflow: hidden;
          max-height: 45.5px;
          word-wrap: break-word;
        `;
        
        issueBox.addEventListener('mouseenter', () => {
          issueBox.style.borderColor = dark ? '#30363d' : '#d0d7de';
          issueBox.style.boxShadow = dark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)';
          issueBox.style.maxHeight = 'none';
          issueBox.style.zIndex = '1000';
          issueBox.style.position = 'relative';
        });
        
        issueBox.addEventListener('mouseleave', () => {
          issueBox.style.borderColor = borderColor;
          issueBox.style.boxShadow = 'none';
          issueBox.style.maxHeight = '45.5px';
          issueBox.style.zIndex = 'auto';
          issueBox.style.position = '';
        });
        
        issuesContainer.appendChild(issueBox);
      });
    });
    
    sidebar.appendChild(issuesContainer);
  }

  // Create the sidebar
  function createSidebar() {
    // Remove existing sidebar if present
    const existing = document.getElementById(SIDEBAR_ID);
    if (existing) {
      existing.remove();
    }

    // Create sidebar element as part of the flow
    const sidebar = document.createElement('div');
    sidebar.id = SIDEBAR_ID;
    
    // Show loading state initially
    renderIssues(sidebar, null);
    
    // Fetch and display issues
    const repoInfo = getRepoInfo();
    if (repoInfo) {
      fetchIssues(repoInfo.owner, repoInfo.repo)
        .then(issues => {
          renderIssues(sidebar, issues);
        })
        .catch(error => {
          renderIssues(sidebar, null, error.message);
        });
    } else {
      renderIssues(sidebar, null, 'Could not determine repository');
    }

    return sidebar;
  }

  // Store original container display style
  let originalContainerDisplay = null;

  // Create reopen button for toolbar
  function createReopenButton() {
    const dark = isDarkMode();
    const iconColor = dark ? '#8b949e' : '#656d76';
    const hoverIconColor = dark ? '#c9d1d9' : '#24292f';
    
    const button = document.createElement('button');
    button.id = REOPEN_BUTTON_ID;
    button.setAttribute('aria-label', 'Show comments');
    button.type = 'button';
    button.style.cssText = `
      background: transparent;
      border: none;
      color: ${iconColor};
      cursor: pointer;
      padding: 8px;
      margin-left: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: background-color 0.2s, color 0.2s;
      position: relative;
    `;
    
    // Create icon using icon48.png
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icons/icon48.png');
    icon.alt = 'Issues';
    icon.style.cssText = `
      width: 16px;
      height: 16px;
      vertical-align: text-bottom;
    `;
    button.appendChild(icon);
    
    // Create custom tooltip
    const tooltip = document.createElement('div');
    tooltip.textContent = 'Show issues sidebar';
    tooltip.style.cssText = `
      position: absolute;
      bottom: calc(100% + 2px);
      left: -50%;
      transform: translateX(-50%);
      background-color: #30363d;
      color: #ffffff;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    `;
    button.appendChild(tooltip);
    
    // Show tooltip on hover
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = dark ? '#21262d' : '#f6f8fa';
      button.style.color = hoverIconColor;
      tooltip.style.opacity = '1';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'transparent';
      button.style.color = iconColor;
      tooltip.style.opacity = '0';
    });
    
    // Click handler to toggle sidebar
    button.addEventListener('click', () => {
      const sidebar = document.getElementById(SIDEBAR_ID);
      if (sidebar) {
        // Toggle visibility
        const isVisible = sidebar.style.display !== 'none' && 
                        getComputedStyle(sidebar).display !== 'none';
        if (isVisible) {
          sidebar.style.display = 'none';
        } else {
          sidebar.style.display = '';
          matchSidebarHeight();
        }
      } else {
        // Sidebar doesn't exist, create it
        injectSidebar();
      }
    });
    
    return button;
  }

  // Update reopen button visibility based on sidebar state (no longer needed - button always visible)
  function updateReopenButtonVisibility() {
    // Button is now always visible, no need to update
    return;
  }

  // Add reopen button to toolbar
  function addReopenButtonToToolbar() {
    const toolbar = findToolbarContainer();
    if (!toolbar) {
      // Toolbar not found, try again later
      return false;
    }
    
    // Check if button already exists
    const existing = document.getElementById(REOPEN_BUTTON_ID);
    if (existing) {
      return true;
    }
    
    // Create and add button
    const button = createReopenButton();
    toolbar.appendChild(button);
    
    return true;
  }

  // Cache expiration time (5 minutes in milliseconds)
  const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

  // Generate cache key from owner and repo
  function getCacheKey(owner, repo) {
    return `issues:${owner}:${repo}`;
  }

  // Save issues to cache
  function saveIssuesToCache(owner, repo, issues) {
    const cacheKey = getCacheKey(owner, repo);
    const cacheData = {
      issues: issues,
      timestamp: Date.now()
    };
    
    chrome.storage.local.set({ [cacheKey]: cacheData }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving issues to cache:', chrome.runtime.lastError);
      }
    });
  }

  // Get issues from cache (returns null if expired or missing)
  function getIssuesFromCache(owner, repo) {
    const cacheKey = getCacheKey(owner, repo);
    
    return new Promise((resolve) => {
      chrome.storage.local.get([cacheKey], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error retrieving issues from cache:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        
        const cachedData = result[cacheKey];
        if (!cachedData || !cachedData.issues || !cachedData.timestamp) {
          resolve(null);
          return;
        }
        
        // Check if cache is expired
        const now = Date.now();
        const cacheAge = now - cachedData.timestamp;
        if (cacheAge > CACHE_EXPIRY_MS) {
          // Cache expired
          resolve(null);
          return;
        }
        
        // Cache is valid, return issues
        resolve(cachedData.issues);
      });
    });
  }

  // Fetch issues from GitHub API
  async function fetchIssues(owner, repo) {
    try {
      // First, check cache
      const cachedIssues = await getIssuesFromCache(owner, repo);
      if (cachedIssues) {
        return cachedIssues;
      }
      
      // Cache miss or expired, fetch from API
      const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100&sort=created&direction=desc`;
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (response.status === 404) {
          throw new Error('Repository not found or is private.');
        }
        throw new Error(`Failed to fetch issues: ${response.status} ${response.statusText}`);
      }
      
      const issues = await response.json();
      // Filter out pull requests (issues have pull_request property when they're PRs)
      const actualIssues = issues.filter(issue => !issue.pull_request);
      
      // Save to cache
      saveIssuesToCache(owner, repo, actualIssues);
      
      return actualIssues;
    } catch (error) {
      console.error('Error fetching issues:', error);
      throw error;
    }
  }

  // Function to match sidebar height to its sibling
  function matchSidebarHeight() {
    const sidebarEl = document.getElementById(SIDEBAR_ID);
    if (!sidebarEl || !sidebarEl.parentNode) return;
    
    // Get all children except the sidebar
    const siblings = Array.from(sidebarEl.parentNode.children).filter(
      child => child.id !== SIDEBAR_ID
    );
    
    if (siblings.length > 0) {
      // Find the tallest sibling (usually the code display container)
      let maxHeight = 0;
      siblings.forEach(sibling => {
        const height = sibling.offsetHeight;
        if (height > maxHeight) {
          maxHeight = height;
        }
      });
      
      if (maxHeight > 0) {
        sidebarEl.style.height = maxHeight + 'px';
      }
    }
  }

  // Inject sidebar if on blob page
  function injectSidebar() {
    if (!isBlobPage()) {
      // Remove sidebar if not on blob page
      const existing = document.getElementById(SIDEBAR_ID);
      if (existing) {
        existing.remove();
        // Restore original container styles
        const targetContainer = findTargetContainer();
        if (targetContainer && originalContainerDisplay !== null) {
          targetContainer.style.display = originalContainerDisplay;
          originalContainerDisplay = null;
        }
      }
      // Hide reopen button when not on blob page
      const reopenButton = document.getElementById(REOPEN_BUTTON_ID);
      if (reopenButton) {
        reopenButton.style.display = 'none';
      }
      return;
    }

    const targetContainer = findTargetContainer();
    if (!targetContainer) {
      // Container not found yet, try again later
      return;
    }

    // Check if sidebar already exists
    const existing = document.getElementById(SIDEBAR_ID);
    if (existing && existing.parentNode === targetContainer) {
      // Sidebar exists and is in the right place, ensure container is flex
      if (targetContainer.style.display !== 'flex') {
        if (originalContainerDisplay === null) {
          originalContainerDisplay = getComputedStyle(targetContainer).display || '';
        }
        targetContainer.style.display = 'flex';
        targetContainer.style.alignItems = 'flex-start';
      }
      // Update height to match siblings
      matchSidebarHeight();
      return;
    }

    // If sidebar exists elsewhere, remove it
    if (existing) {
      existing.remove();
    }

    // Store original display style if not already stored
    if (originalContainerDisplay === null) {
      originalContainerDisplay = getComputedStyle(targetContainer).display || '';
    }

    // Make container a flex container to position items horizontally
    targetContainer.style.display = 'flex';
    targetContainer.style.alignItems = 'flex-start';

    // Create and append sidebar as the last child (will appear on the right)
    const sidebar = createSidebar();
    targetContainer.appendChild(sidebar);
    
    // Set height initially and observe for changes
    matchSidebarHeight();
    
    // Use ResizeObserver to update height when sibling changes
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        matchSidebarHeight();
      });
      
      // Observe all siblings
      const siblings = Array.from(targetContainer.children).filter(
        child => child.id !== SIDEBAR_ID
      );
      siblings.forEach(sibling => {
        resizeObserver.observe(sibling);
      });
    }
    
    // Try to add reopen button to toolbar
    addReopenButtonToToolbar();
  }

  // Initial injection
  function initializeExtension() {
    injectSidebar();
    // Try to add reopen button (toolbar might load later, so we'll retry)
    if (!addReopenButtonToToolbar()) {
      // Retry after a short delay if toolbar not found
      setTimeout(() => addReopenButtonToToolbar(), 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
  } else {
    initializeExtension();
  }

  // Handle GitHub's SPA navigation (Turbo/PJAX)
  // GitHub uses Turbo for navigation, so we listen for turbo:load events
  document.addEventListener('turbo:load', initializeExtension);
  document.addEventListener('pjax:end', initializeExtension);
  
  // Fallback: Observe URL changes using MutationObserver on the body
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // Small delay to ensure DOM is ready
      setTimeout(injectSidebar, 100);
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also check on popstate (browser back/forward)
  window.addEventListener('popstate', () => {
    setTimeout(injectSidebar, 100);
  });
})();
