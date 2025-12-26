// Content script - runs on GitHub pages
(function() {
  'use strict';

  const SIDEBAR_ID = 'github-issues-sidebar';
  const REOPEN_BUTTON_ID = 'github-issues-reopen-button';
  
  // Store current issues for line icon injection
  let currentIssues = null;
  
  // Extension enabled state (default to true)
  let extensionEnabled = true;
  
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

  // Check if blob URL points to the current file
  function isLinkInCurrentFile(blobUrl) {
    if (!blobUrl) {
      return false;
    }
    
    const currentFilePath = getCurrentFilePath();
    if (!currentFilePath) {
      return false;
    }
    
    const linkFilePath = extractFilePathFromBlobUrl(blobUrl);
    if (!linkFilePath) {
      return false;
    }
    
    // Compare file paths (they should match exactly)
    return linkFilePath === currentFilePath;
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

  // Extract line number from blob URL
  function extractLineNumber(blobUrl) {
    if (!blobUrl) {
      return null;
    }
    
    // Extract line number from patterns: #L33 or #L39-L43 (use first line number)
    const lineMatch = blobUrl.match(/#L(\d+)(?:-L\d+)?/);
    
    if (lineMatch && lineMatch[1]) {
      return parseInt(lineMatch[1], 10);
    }
    
    return null;
  }

  // Extract line range information from blob URL
  // Returns { start: number, end: number, allLines: [number, ...] } or null
  function extractLineRange(blobUrl) {
    if (!blobUrl) {
      return null;
    }
    
    // Extract line numbers from patterns: #L33 or #L39-L43
    const lineMatch = blobUrl.match(/#L(\d+)(?:-L(\d+))?/);
    
    if (lineMatch && lineMatch[1]) {
      const start = parseInt(lineMatch[1], 10);
      const end = lineMatch[2] ? parseInt(lineMatch[2], 10) : start;
      
      // Generate array of all line numbers in range
      const allLines = [];
      for (let i = start; i <= end; i++) {
        allLines.push(i);
      }
      
      return { start, end, allLines };
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

  // Build map of line numbers to issues for the current file
  function buildLineToIssuesMap(issues, currentFilePath) {
    const lineMap = {};
    
    if (!currentFilePath || !issues || issues.length === 0) {
      return lineMap;
    }
    
    issues.forEach(issue => {
      // Only include open issues
      if (issue.state !== 'open') {
        return;
      }
      
      const blobUrl = extractBlobUrl(issue.body);
      if (!blobUrl) {
        return;
      }
      
      // Check if this issue references the current file
      const filePath = extractFilePathFromBlobUrl(blobUrl);
      if (filePath !== currentFilePath) {
        return;
      }
      
      // Extract line range
      const lineRange = extractLineRange(blobUrl);
      if (lineRange === null) {
        return;
      }
      
      // Add issue to all lines in the range
      lineRange.allLines.forEach(lineNumber => {
        if (!lineMap[lineNumber]) {
          lineMap[lineNumber] = [];
        }
        lineMap[lineNumber].push(issue);
      });
    });
    
    return lineMap;
  }

  // Highlight all lines with comments for the current file
  function highlightAllCommentedLines(issues, currentFilePath) {
    // Clear existing highlights first
    clearPermanentHighlights();
    
    if (!currentFilePath || !issues || issues.length === 0) {
      return;
    }
    
    const allLinesToHighlight = new Set();
    
    issues.forEach(issue => {
      // Only include open issues
      if (issue.state !== 'open') {
        return;
      }
      
      const blobUrl = extractBlobUrl(issue.body);
      if (!blobUrl) {
        return;
      }
      
      // Check if this issue references the current file
      const filePath = extractFilePathFromBlobUrl(blobUrl);
      if (filePath !== currentFilePath) {
        return;
      }
      
      // Extract line range
      const lineRange = extractLineRange(blobUrl);
      if (lineRange === null) {
        return;
      }
      
      // Add all lines in range to the set
      lineRange.allLines.forEach(lineNumber => {
        allLinesToHighlight.add(lineNumber);
      });
    });
    
    // Highlight all lines
    highlightLinesPermanently(Array.from(allLinesToHighlight));
  }

  // Find code line elements in GitHub code viewer
  function findCodeLineElements() {
    // GitHub uses table rows with data-line-number attribute
    // Try multiple selectors to handle different GitHub layouts
    const selectors = [
      'tr[data-line-number]',
      'td[data-line-number]',
      '.react-file-line[data-line-number]',
      '[data-line-number]'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    }
    
    return [];
  }

  // Store reference to currently highlighted line for cleanup
  let highlightedLineElement = null;
  let highlightTimeout = null;
  
  // Store set of permanently highlighted line numbers
  const permanentlyHighlightedLines = new Set();
  
  // Store reference to last clicked comment box
  let lastClickedCommentBox = null;

  // Scroll to a specific line number
  function scrollToLine(lineNumber) {
    if (!lineNumber) {
      return false;
    }
    
    // Find the line element by data-line-number attribute
    const lineElement = document.querySelector(`[data-line-number="${lineNumber}"]`);
    if (!lineElement) {
      return false;
    }
    
    // Scroll to the element smoothly
    lineElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
    
    return true;
  }

  // Highlight a line with temporary yellow highlight (for click feedback)
  function highlightLine(lineNumber) {
    if (!lineNumber) {
      return;
    }
    
    // Clear any existing temporary highlight
    if (highlightedLineElement) {
      highlightedLineElement.classList.remove('github-issues-line-highlight-temp');
      highlightedLineElement = null;
    }
    
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
      highlightTimeout = null;
    }
    
    // Find the line element
    const lineElement = document.querySelector(`[data-line-number="${lineNumber}"]`);
    if (!lineElement) {
      return;
    }
    
    // Add temporary highlight class
    lineElement.classList.add('github-issues-line-highlight-temp');
    highlightedLineElement = lineElement;
    
    // Create style for highlights and last-clicked indicator if it doesn't exist
    if (!document.getElementById('github-issues-highlight-style')) {
      const style = document.createElement('style');
      style.id = 'github-issues-highlight-style';
      const isDark = isDarkMode();
      style.textContent = `
        .github-issues-line-highlight {
          background-color: rgba(46, 160, 67, 0.2) !important;
        }
        .github-issues-line-highlight td {
          background-color: rgba(46, 160, 67, 0.2) !important;
        }
        .github-issues-line-highlight-temp {
          background-color: rgba(255, 223, 93, 0.3) !important;
          transition: background-color 0.5s ease-out;
        }
        .github-issues-line-highlight-temp td {
          background-color: rgba(255, 223, 93, 0.3) !important;
        }
        .github-issues-last-clicked {
          border-left: 3px solid ${isDark ? '#58a6ff' : '#0969da'} !important;
          background-color: ${isDark ? 'rgba(88, 166, 255, 0.1)' : 'rgba(9, 105, 218, 0.08)'} !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Remove temporary highlight after 1 second (just a brief flash)
    highlightTimeout = setTimeout(() => {
      if (highlightedLineElement) {
        highlightedLineElement.classList.remove('github-issues-line-highlight-temp');
        highlightedLineElement = null;
      }
      highlightTimeout = null;
    }, 1000);
  }

  // Permanently highlight a single line (green)
  function highlightLinePermanently(lineNumber) {
    if (!lineNumber) {
      return;
    }
    
    if (permanentlyHighlightedLines.has(lineNumber)) {
      return; // Already highlighted
    }
    
    // Find the line element
    const lineElement = document.querySelector(`[data-line-number="${lineNumber}"]`);
    if (!lineElement) {
      return;
    }
    
    // Add permanent highlight class
    lineElement.classList.add('github-issues-line-highlight');
    permanentlyHighlightedLines.add(lineNumber);
  }

  // Permanently highlight multiple lines (green)
  function highlightLinesPermanently(lineNumbers) {
    if (!lineNumbers || lineNumbers.length === 0) {
      return;
    }
    
    lineNumbers.forEach(lineNumber => {
      highlightLinePermanently(lineNumber);
    });
  }

  // Clear all permanent highlights
  function clearPermanentHighlights() {
    permanentlyHighlightedLines.forEach(lineNumber => {
      const lineElement = document.querySelector(`[data-line-number="${lineNumber}"]`);
      if (lineElement) {
        lineElement.classList.remove('github-issues-line-highlight');
      }
    });
    permanentlyHighlightedLines.clear();
  }

  // Create line icon with tooltip showing issue bodies
  function createLineIcon(lineNumber, issues, isDark) {
    if (!issues || issues.length === 0) {
      return null;
    }
    
    const iconContainer = document.createElement('span');
    iconContainer.className = 'github-issues-line-icon';
    iconContainer.setAttribute('data-line-number', lineNumber);
    iconContainer.style.cssText = `
      position: absolute;
      right: -10px;
      top: 5px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      cursor: pointer;
      z-index: 10;
    `;
    
    // Create icon image
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icons/CommentIcon.png');
    icon.alt = 'Issues';
    icon.style.cssText = `
      width: 16px;
      opacity: 0.7;
      transition: opacity 0.2s;
    `;
    iconContainer.appendChild(icon);
    
    // Extract and format issue bodies for tooltip
    const issueTexts = issues.map(issue => extractBodyText(issue.body)).filter(text => text);
    const tooltipText = issueTexts.join('\n\n---\n\n');
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'github-issues-line-tooltip';
    tooltip.textContent = tooltipText;
    
    tooltip.style.cssText = `
      position: fixed;
      background-color: ${isDark ? '#30363d' : '#24292f'};
      color: ${isDark ? '#c9d1d9' : '#ffffff'};
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      white-space: pre-wrap;
      width: 250px;
      max-width: 250px;
      max-height: 400px;
      overflow-y: auto;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      word-wrap: break-word;
      line-height: 1.5;
    `;
    
    // Append tooltip to body to avoid clipping issues
    document.body.appendChild(tooltip);
    
    // Show tooltip on hover
    iconContainer.addEventListener('mouseenter', (e) => {
      icon.style.opacity = '1';
      
      // Calculate tooltip position based on icon location
      const iconRect = iconContainer.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      // Position above the icon
      let top = iconRect.top - tooltipRect.height - 8;
      let left = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);
      
      // If tooltip would go off top of screen, position below instead
      if (top < 0) {
        top = iconRect.bottom + 8;
      }
      
      // Ensure tooltip doesn't go off left edge
      if (left < 8) {
        left = 8;
      }
      
      // Ensure tooltip doesn't go off right edge
      const rightEdge = window.innerWidth - tooltipRect.width - 8;
      if (left > rightEdge) {
        left = rightEdge;
      }
      
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.style.opacity = '1';
    });
    
    iconContainer.addEventListener('mouseleave', () => {
      icon.style.opacity = '0.7';
      tooltip.style.opacity = '0';
    });
    
    // Also handle tooltip hover to keep it visible when moving to it
    tooltip.addEventListener('mouseenter', () => {
      tooltip.style.opacity = '1';
    });
    
    tooltip.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
    
    return iconContainer;
  }

  // Remove all line icons
  function removeLineIcons() {
    const icons = document.querySelectorAll('.github-issues-line-icon');
    icons.forEach(icon => icon.remove());
  }


  // Inject icons into code lines
  function injectLineIcons(issues) {
    // Remove existing icons first
    removeLineIcons();
    
    if (!isBlobPage()) {
      return;
    }
    
    const currentFilePath = getCurrentFilePath();
    if (!currentFilePath) {
      return;
    }
    
    // Build line-to-issues map
    const lineMap = buildLineToIssuesMap(issues, currentFilePath);
    if (Object.keys(lineMap).length === 0) {
      return;
    }
    
    // Find code line elements
    const lineElements = findCodeLineElements();
    if (lineElements.length === 0) {
      return;
    }
    
    const dark = isDarkMode();
    
    // Process each line element
    lineElements.forEach(lineElement => {
      const lineNumberAttr = lineElement.getAttribute('data-line-number');
      if (!lineNumberAttr) {
        return;
      }
      
      const lineNumber = parseInt(lineNumberAttr, 10);
      if (isNaN(lineNumber)) {
        return;
      }
      
      // Check if this line has issues
      const lineIssues = lineMap[lineNumber];
      if (!lineIssues || lineIssues.length === 0) {
        return;
      }
      
      // Filter issues to only include those where this line is the start of the range
      // This ensures icons only appear on the first line of multi-line ranges
      const issuesForIcon = lineIssues.filter(issue => {
        const blobUrl = extractBlobUrl(issue.body);
        if (!blobUrl) {
          return false;
        }
        
        const lineRange = extractLineRange(blobUrl);
        if (!lineRange) {
          return false;
        }
        
        // Only include this issue if the current line is the start of its range
        return lineRange.start === lineNumber;
      });
      
      // If no issues should show an icon on this line, skip it
      if (issuesForIcon.length === 0) {
        return;
      }
      
      // Check if icon already exists
      const existingIcon = lineElement.querySelector('.github-issues-line-icon');
      if (existingIcon) {
        return;
      }
      
      // Create icon (but show all issues for this line in the tooltip, not just the filtered ones)
      // This way if line 12 has both a 12-15 range issue and a single-line issue on 12, both show
      const icon = createLineIcon(lineNumber, lineIssues, dark);
      if (!icon) {
        return;
      }
      
      // Find the right place to insert the icon
      // GitHub code lines typically have a structure like: <tr><td class="blob-num">...</td><td class="blob-code">...</td></tr>
      // We want to insert the icon in the code cell, positioned absolutely on the right
      const codeCell = lineElement.querySelector('td.blob-code, .blob-code, [class*="blob-code"]');
      if (codeCell) {
        // Make sure the code cell has relative positioning for absolute child
        const computedPosition = window.getComputedStyle(codeCell).position;
        if (computedPosition === 'static') {
          codeCell.style.position = 'relative';
        }
        
        // Append directly to code cell so it's positioned at the right edge
        codeCell.appendChild(icon);
      } else {
        // Fallback: append to the line element itself
        const elementPosition = window.getComputedStyle(lineElement).position;
        if (elementPosition === 'static') {
          lineElement.style.position = 'relative';
        }
        lineElement.appendChild(icon);
      }
    });
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
    
    // Reset last clicked comment reference when re-rendering
    lastClickedCommentBox = null;
    
    // Clear existing highlights when re-rendering
    clearPermanentHighlights();
    
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
    
    // Create button container for clear cache and close buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
    `;
    
    // Create clear cache button
    const clearCacheButton = document.createElement('button');
    clearCacheButton.innerHTML = '🗑️';
    clearCacheButton.setAttribute('aria-label', 'Clear cache');
    clearCacheButton.title = 'Clear cache';
    clearCacheButton.style.cssText = `
      background: none;
      border: none;
      color: ${dark ? '#8b949e' : '#656d76'};
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      padding: 4px 8px;
      margin: 0;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      transition: background-color 0.2s, color 0.2s;
    `;
    
    // Hover effect for clear cache button
    clearCacheButton.addEventListener('mouseenter', () => {
      clearCacheButton.style.backgroundColor = hoverBgColor;
      clearCacheButton.style.color = textColor;
    });
    
    clearCacheButton.addEventListener('mouseleave', () => {
      clearCacheButton.style.backgroundColor = 'transparent';
      clearCacheButton.style.color = dark ? '#8b949e' : '#656d76';
    });
    
    // Clear cache functionality
    clearCacheButton.addEventListener('click', () => {
      const repoInfo = getRepoInfo();
      if (repoInfo) {
        clearCache(repoInfo.owner, repoInfo.repo);
        // Re-fetch issues after clearing cache
        renderIssues(sidebar, null); // Show loading state
        fetchIssues(repoInfo.owner, repoInfo.repo)
          .then(issues => {
            currentIssues = issues;
            renderIssues(sidebar, issues);
          })
          .catch(error => {
            currentIssues = null;
            renderIssues(sidebar, null, error.message);
          });
      }
    });
    
    buttonContainer.appendChild(clearCacheButton);
    
    // Create refresh button
    const refreshButton = document.createElement('button');
    refreshButton.innerHTML = '↻';
    refreshButton.setAttribute('aria-label', 'Refresh issues');
    refreshButton.title = 'Refresh issues';
    refreshButton.style.cssText = `
      background: none;
      border: none;
      color: ${dark ? '#8b949e' : '#656d76'};
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 4px 8px;
      margin: 0;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      transition: background-color 0.2s, color 0.2s, transform 0.2s;
    `;
    
    // Hover effect for refresh button
    refreshButton.addEventListener('mouseenter', () => {
      refreshButton.style.backgroundColor = hoverBgColor;
      refreshButton.style.color = textColor;
    });
    
    refreshButton.addEventListener('mouseleave', () => {
      refreshButton.style.backgroundColor = 'transparent';
      refreshButton.style.color = dark ? '#8b949e' : '#656d76';
      refreshButton.style.transform = 'rotate(0deg)';
    });
    
    // Refresh functionality
    refreshButton.addEventListener('click', () => {
      const repoInfo = getRepoInfo();
      if (repoInfo) {
        // Show loading state
        renderIssues(sidebar, null);
        // Add rotation animation on click
        refreshButton.style.transform = 'rotate(360deg)';
        setTimeout(() => {
          refreshButton.style.transform = 'rotate(0deg)';
        }, 500);
        // Fetch issues (will use cache if available, but force refresh from API)
        fetchIssues(repoInfo.owner, repoInfo.repo, true) // Pass true to bypass cache
          .then(issues => {
            currentIssues = issues;
            renderIssues(sidebar, issues);
          })
          .catch(error => {
            currentIssues = null;
            renderIssues(sidebar, null, error.message);
          });
      }
    });
    
    buttonContainer.appendChild(refreshButton);
    
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
    
    buttonContainer.appendChild(closeButton);
    headerContainer.appendChild(buttonContainer);
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
    
    // Get last clicked comment from storage first (before rendering)
    chrome.storage.local.get(['lastClickedComment'], (result) => {
      const lastClickedUrl = result.lastClickedComment;
      
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
        
        // Sort issues by line number
        const sortedFileIssues = fileIssues.slice().sort((a, b) => {
          const blobUrlA = extractBlobUrl(a.body);
          const blobUrlB = extractBlobUrl(b.body);
          const lineNumberA = blobUrlA ? extractLineNumber(blobUrlA) : null;
          const lineNumberB = blobUrlB ? extractLineNumber(blobUrlB) : null;
          
          // Issues without line numbers go to the end
          if (lineNumberA === null && lineNumberB === null) return 0;
          if (lineNumberA === null) return 1;
          if (lineNumberB === null) return -1;
          
          // Sort by line number
          return lineNumberA - lineNumberB;
        });
        
        // Render issues for this file
        sortedFileIssues.forEach(issue => {
          // Extract blob URL from issue body, fallback to issue URL
          const blobUrl = extractBlobUrl(issue.body);
          const linkUrl = blobUrl || issue.html_url;
          
          // Extract and clean body text
          let bodyText = extractBodyText(issue.body);
          
          // Skip if body is empty after cleaning
          if (!bodyText) {
            return;
          }
          
          // Extract line range and prefix body text
          const lineRange = blobUrl ? extractLineRange(blobUrl) : null;
          if (lineRange !== null) {
            if (lineRange.start === lineRange.end) {
              // Single line
              bodyText = `${lineRange.start}: ${bodyText}`;
            } else {
              // Line range
              bodyText = `${lineRange.start}-${lineRange.end}: ${bodyText}`;
            }
          }
          
          // Create box/link element
          const issueBox = document.createElement('a');
          issueBox.href = linkUrl;
          issueBox.rel = 'noopener noreferrer';
          issueBox.textContent = bodyText;
          
          // Check if this is the last clicked comment and restore indicator
          if (lastClickedUrl && issue.html_url === lastClickedUrl) {
            issueBox.classList.add('github-issues-last-clicked');
            lastClickedCommentBox = issueBox;
          }
          
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
          position: relative;
        `;
          
          // Create icon button for opening issue in new tab
          const issueIconButton = document.createElement('button');
          issueIconButton.innerHTML = '↗';
          issueIconButton.setAttribute('aria-label', 'Open issue in new tab');
          issueIconButton.title = 'Open issue in new tab';
          issueIconButton.style.cssText = `
            position: absolute;
            top: 4px;
            right: 4px;
            width: 20px;
            height: 20px;
            background-color: ${dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'};
            border: none;
            border-radius: 4px;
            color: ${dark ? '#8b949e' : '#656d76'};
            font-size: 12px;
            line-height: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            z-index: 10;
            opacity: 0;
            transition: opacity 0.2s, background-color 0.2s;
          `;
          
          // Hover effects for icon
          issueIconButton.addEventListener('mouseenter', () => {
            issueIconButton.style.opacity = '1';
            issueIconButton.style.backgroundColor = dark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
          });
          
          issueIconButton.addEventListener('mouseleave', () => {
            // Only hide if not hovering over the comment box
            if (!issueBox.matches(':hover')) {
              issueIconButton.style.opacity = '0';
            }
            issueIconButton.style.backgroundColor = dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
          });
          
          // Click handler to open issue in new window
          issueIconButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(issue.html_url, '_blank', 'noopener,noreferrer,width=1200,height=800');
          });
          
          // Append icon to issue box
          issueBox.appendChild(issueIconButton);
        
        // Add click handler to intercept navigation if link points to current file
        issueBox.addEventListener('click', (e) => {
          // Store which comment was clicked (using issue URL as identifier)
          const clickedIssueUrl = issue.html_url;
          
          // Store immediately (synchronously for navigation case)
          chrome.storage.local.set({ 'lastClickedComment': clickedIssueUrl });
          
          // Remove indicator from previously clicked comment
          if (lastClickedCommentBox) {
            lastClickedCommentBox.classList.remove('github-issues-last-clicked');
          }
          
          // Add indicator to current clicked comment
          issueBox.classList.add('github-issues-last-clicked');
          lastClickedCommentBox = issueBox;
          
          // Check if this link points to the current file
          if (blobUrl && isLinkInCurrentFile(blobUrl)) {
            // Prevent default navigation
            e.preventDefault();
            e.stopPropagation();
            
            // Extract line range and scroll/highlight
            const lineRange = extractLineRange(blobUrl);
            if (lineRange) {
              // Update URL hash to reflect the line number (use start of range)
              window.history.replaceState(null, '', `#L${lineRange.start}`);
              
              // Small delay to ensure DOM is ready
              setTimeout(() => {
                scrollToLine(lineRange.start);
                // Brief flash highlight on the first line
                highlightLine(lineRange.start);
              }, 50);
            }
          }
          // If not current file, allow default behavior (navigation happens, indicator will be restored on new page)
        });
        
        issueBox.addEventListener('mouseenter', () => {
          issueBox.style.borderColor = dark ? '#30363d' : '#d0d7de';
          issueBox.style.boxShadow = dark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)';
          issueBox.style.maxHeight = 'none';
          issueBox.style.zIndex = '1000';
          issueBox.style.position = 'relative';
          // Show icon when hovering over comment box
          const iconButton = issueBox.querySelector('button[aria-label="Open issue in new tab"]');
          if (iconButton) {
            iconButton.style.opacity = '0.7';
          }
        });
        
        issueBox.addEventListener('mouseleave', () => {
          issueBox.style.borderColor = borderColor;
          issueBox.style.boxShadow = 'none';
          issueBox.style.maxHeight = '45.5px';
          issueBox.style.zIndex = 'auto';
          issueBox.style.position = '';
          // Hide icon when leaving comment box (unless hovering over icon)
          const iconButton = issueBox.querySelector('button[aria-label="Open issue in new tab"]');
          if (iconButton && !iconButton.matches(':hover')) {
            iconButton.style.opacity = '0';
          }
        });
        
          issuesContainer.appendChild(issueBox);
        });
      });
      
      sidebar.appendChild(issuesContainer);
    });
    
    // Store issues for line icon injection and highlight lines
    if (issues && issues.length > 0) {
      currentIssues = issues;
      const currentFilePath = getCurrentFilePath();
      // Inject line icons and highlight lines after rendering issues
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        injectLineIcons(issues);
        if (currentFilePath) {
          highlightAllCommentedLines(issues, currentFilePath);
        }
      }, 200);
    } else {
      currentIssues = null;
      // Remove icons and highlights if no issues
      removeLineIcons();
      clearPermanentHighlights();
    }
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
          currentIssues = issues;
          renderIssues(sidebar, issues);
        })
        .catch(error => {
          currentIssues = null;
          renderIssues(sidebar, null, error.message);
        });
    } else {
      currentIssues = null;
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
        checkExtensionEnabled().then(isEnabled => {
          if (isEnabled) {
            injectSidebar();
          }
        });
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

  // Clear cache for a specific repository
  function clearCache(owner, repo) {
    const cacheKey = getCacheKey(owner, repo);
    chrome.storage.local.remove([cacheKey], () => {
      if (chrome.runtime.lastError) {
        console.error('Error clearing cache:', chrome.runtime.lastError);
      }
    });
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
  async function fetchIssues(owner, repo, bypassCache = false) {
    try {
      // First, check cache (unless bypassing)
      if (!bypassCache) {
        const cachedIssues = await getIssuesFromCache(owner, repo);
        if (cachedIssues) {
          return cachedIssues;
        }
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

  // Check if extension is enabled (uses shared utility)
  async function checkExtensionEnabled() {
    const utils = window.GitHubReviewComments?.utils;
    if (!utils) {
      // Fallback if utils not loaded yet
      try {
        const result = await chrome.storage.local.get(['extensionEnabled']);
        extensionEnabled = result.extensionEnabled !== false;
        return extensionEnabled;
      } catch (error) {
        return true;
      }
    }
    const isEnabled = await utils.checkExtensionEnabled();
    extensionEnabled = utils.getExtensionEnabled();
    return isEnabled;
  }

  // Clean up all extension elements when disabled
  function cleanupExtension() {
    // Remove sidebar
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (sidebar) {
      sidebar.remove();
    }
    
    // Remove reopen button
    const reopenButton = document.getElementById(REOPEN_BUTTON_ID);
    if (reopenButton) {
      reopenButton.remove();
    }
    
    // Remove line icons
    removeLineIcons();
    
    // Remove repository icon (via namespace)
    const repoIcon = window.GitHubReviewComments?.repositoryIcon;
    if (repoIcon) {
      repoIcon.remove();
    }
    
    // Clear permanent highlights
    clearPermanentHighlights();
    
    // Restore original container styles
    const targetContainer = findTargetContainer();
    if (targetContainer && originalContainerDisplay !== null) {
      targetContainer.style.display = originalContainerDisplay;
      originalContainerDisplay = null;
    }
    
    // Clear current issues
    currentIssues = null;
  }

  // Inject sidebar if on blob page
  async function injectSidebar() {
    // Check if extension is enabled
    const isEnabled = await checkExtensionEnabled();
    if (!isEnabled) {
      cleanupExtension();
      return;
    }
    
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
  async function initializeExtension() {
    // Check if extension is enabled
    const isEnabled = await checkExtensionEnabled();
    if (!isEnabled) {
      cleanupExtension();
      return;
    }
    
    await injectSidebar();
    // Try to add reopen button (toolbar might load later, so we'll retry)
    if (!addReopenButtonToToolbar()) {
      // Retry after a short delay if toolbar not found
      setTimeout(() => addReopenButtonToToolbar(), 500);
    }
    
    // Inject repository icon if on repository main page (via namespace)
    const repoIcon = window.GitHubReviewComments?.repositoryIcon;
    if (repoIcon) {
      repoIcon.inject();
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
  const observer = new MutationObserver(async () => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        checkExtensionEnabled().then(isEnabled => {
          if (isEnabled) {
            injectSidebar();
            const repoIcon = window.GitHubReviewComments?.repositoryIcon;
            if (repoIcon) {
              repoIcon.inject();
            }
          } else {
            cleanupExtension();
          }
        });
      }, 100);
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also check on popstate (browser back/forward)
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      checkExtensionEnabled().then(isEnabled => {
        if (isEnabled) {
          injectSidebar();
          const repoIcon = window.GitHubReviewComments?.repositoryIcon;
          if (repoIcon) {
            repoIcon.inject();
          }
        } else {
          cleanupExtension();
        }
      });
    }, 100);
  });

  // Function to inject line icons and highlight lines if we have issues
  function tryInjectLineIcons() {
    if (currentIssues && currentIssues.length > 0) {
      const currentFilePath = getCurrentFilePath();
      setTimeout(() => {
        injectLineIcons(currentIssues);
        if (currentFilePath) {
          highlightAllCommentedLines(currentIssues, currentFilePath);
        }
      }, 200);
    } else {
      clearPermanentHighlights();
    }
  }

  // Handle hash changes (line navigation)
  window.addEventListener('hashchange', () => {
    tryInjectLineIcons();
    
    // Extract line number from hash and highlight
    const hash = window.location.hash;
    if (hash) {
      const lineMatch = hash.match(/#L(\d+)(?:-L\d+)?/);
      if (lineMatch && lineMatch[1]) {
        const lineNumber = parseInt(lineMatch[1], 10);
        setTimeout(() => {
          scrollToLine(lineNumber);
          highlightLine(lineNumber);
        }, 100);
      }
    }
  });

  // Handle initial page load with hash
  function handleInitialHash() {
    const hash = window.location.hash;
    if (hash) {
      const lineMatch = hash.match(/#L(\d+)(?:-L\d+)?/);
      if (lineMatch && lineMatch[1]) {
        const lineNumber = parseInt(lineMatch[1], 10);
        // Wait a bit for DOM to be ready
        setTimeout(() => {
          scrollToLine(lineNumber);
          highlightLine(lineNumber);
        }, 500);
      }
    }
  }

  // Call on initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleInitialHash);
  } else {
    handleInitialHash();
  }

})();
