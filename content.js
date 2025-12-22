// Content script - runs on GitHub pages
(function() {
  'use strict';

  const SIDEBAR_ID = 'github-issues-sidebar';
  
  // Check if we're on a blob page
  function isBlobPage() {
    return window.location.pathname.includes('/blob/');
  }

  // Find the target container (the div with class Box-sc-62in7e-0 hGzGyY)
  function findTargetContainer() {
    // Find the div with both classes Box-sc-62in7e-0 and hGzGyY
    const containers = document.querySelectorAll('.Box-sc-62in7e-0.hGzGyY');
    // Return the first one found (should be the code viewer container)
    return containers.length > 0 ? containers[0] : null;
  }

  // Create the red sidebar
  function createSidebar() {
    // Remove existing sidebar if present
    const existing = document.getElementById(SIDEBAR_ID);
    if (existing) {
      existing.remove();
    }

    // Create sidebar element as part of the flow
    const sidebar = document.createElement('div');
    sidebar.id = SIDEBAR_ID;
    
    // Detect if dark mode is active for border color
    const isDarkMode = document.documentElement.getAttribute('data-color-mode') === 'dark' ||
                       document.documentElement.classList.contains('dark') ||
                       window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Use GitHub-like border color that adapts to theme
    const borderColor = isDarkMode ? '#30363d' : '#d0d7de';
    
    sidebar.style.cssText = `
      width: 100px;
      min-height: 100vh;
      background-color: #ff0000;
      border: 1px solid ${borderColor};
      flex-shrink: 0;
      padding: 16px;
      border-radius: 6px;
      margin-left: 16px;
      box-sizing: border-box;
    `;

    return sidebar;
  }

  // Store original container display style
  let originalContainerDisplay = null;

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
      }
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

    // Create and append sidebar as the last child (will appear on the right)
    const sidebar = createSidebar();
    targetContainer.appendChild(sidebar);
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
