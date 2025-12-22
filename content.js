// Content script - runs on GitHub pages
(function() {
  'use strict';

  const SIDEBAR_ID = 'github-issues-sidebar';
  
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

  // Detect theme mode
  function isDarkMode() {
    return document.documentElement.getAttribute('data-color-mode') === 'dark' ||
           document.documentElement.classList.contains('dark') ||
           window.matchMedia('(prefers-color-scheme: dark)').matches;
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
    
    // Create header
    const header = document.createElement('h3');
    header.textContent = 'Issues';
    header.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      color: ${textColor};
      margin: 0 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid ${borderColor};
    `;
    sidebar.appendChild(header);
    
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
    
    // Create issues list
    const issuesList = document.createElement('ul');
    issuesList.style.cssText = `
      list-style: none;
      margin: 0;
      padding: 0;
    `;
    
    openIssues.forEach(issue => {
      const listItem = document.createElement('li');
      listItem.style.cssText = `
        margin-bottom: 8px;
      `;
      
      // Extract blob URL from issue body, fallback to issue URL
      const blobUrl = extractBlobUrl(issue.body);
      const linkUrl = blobUrl || issue.html_url;
      
      const issueLink = document.createElement('a');
      issueLink.href = linkUrl;
      issueLink.target = '_blank';
      issueLink.rel = 'noopener noreferrer';
      issueLink.textContent = `#${issue.number}: ${issue.title}`;
      issueLink.style.cssText = `
        display: block;
        padding: 8px 12px;
        color: ${textColor};
        text-decoration: none;
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.4;
        transition: background-color 0.2s;
      `;
      
      issueLink.addEventListener('mouseenter', () => {
        issueLink.style.backgroundColor = hoverBgColor;
      });
      
      issueLink.addEventListener('mouseleave', () => {
        issueLink.style.backgroundColor = 'transparent';
      });
      
      listItem.appendChild(issueLink);
      issuesList.appendChild(listItem);
    });
    
    sidebar.appendChild(issuesList);
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

  // Fetch issues from GitHub API
  async function fetchIssues(owner, repo) {
    try {
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
  }

  // Initial injection
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSidebar);
  } else {
    injectSidebar();
  }

  // Handle GitHub's SPA navigation (Turbo/PJAX)
  // GitHub uses Turbo for navigation, so we listen for turbo:load events
  document.addEventListener('turbo:load', injectSidebar);
  document.addEventListener('pjax:end', injectSidebar);
  
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
