# GitHub Review Comments

A browser extension for Chrome and Edge that transforms GitHub issues into in-line review comments on code files, making it easy for teachers to provide feedback and students to navigate and address code review comments.

## Overview

This extension displays GitHub issues as review comments directly alongside your code on GitHub blob pages. Instead of jumping between the Issues tab and code files, students can see all feedback related to their code in a sidebar, grouped by file and line number. It's perfect for code review workflows where instructors provide feedback through GitHub issues.

## Features

### For Students

- **📝 Sidebar Comments Panel**: View all open issues as review comments in a sidebar next to your code
- **📍 Line-Specific Comments**: See which lines have feedback with visual icons next to line numbers
- **🔍 Smart Grouping**: Comments are automatically grouped by file, with the current file's comments shown first
- **⚡ Quick Navigation**: Click any comment to jump directly to the referenced code line with smooth scrolling
- **💡 Hover Tooltips**: Hover over line icons to see issue comments without leaving your current position
- **🔗 Open Issues**: Click the icon in the top-right corner of each comment to open the GitHub issue in a new window (great for closing issues without losing your place)
- **🎨 Theme Support**: Automatically adapts to GitHub's light and dark themes
- **💾 Smart Caching**: Issues are cached for 5 minutes to reduce API calls when navigating between files

### For Teachers

- **📋 Create Issues as Usual**: Simply create GitHub issues normally - no special format required
- **🔗 Include Code References**: Add blob URLs with line numbers in your issue body (e.g., `https://github.com/user/repo/blob/main/file.java#L42`)
- **✅ Support for Ranges**: Reference single lines (`#L42`) or line ranges (`#L42-L45`)
- **👁️ Visual Feedback**: Students can easily see all your feedback organized by file and line number

## Installation

### Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select this extension folder
5. The extension will appear in your extensions list

### Edge

1. Open Edge and navigate to `edge://extensions/`
2. Enable "Developer mode" (toggle in the bottom left)
3. Click "Load unpacked"
4. Select this extension folder
5. The extension will appear in your extensions list

## Usage

### Teacher Workflow: Providing Feedback

1. **Navigate to the code** you want to review on GitHub (any blob page)
2. **Create a new issue** in the repository as you normally would
3. **Include a code reference** in the issue body:
   - Copy the URL of the specific line(s) you're commenting on
   - Paste it in the issue body (e.g., `https://github.com/user/repo/blob/main/MyClass.java#L33`)
   - For line ranges, use: `https://github.com/user/repo/blob/main/MyClass.java#L33-L37`
4. **Write your feedback** in the issue body after the link
5. **Create the issue** - students will see it automatically appear as a comment in the sidebar

**Example Issue Body:**
```
https://github.com/TroelsMortensen/JavaFxExamples/blob/master/src/MyExampleController.java#L33

Consider using a more descriptive variable name here. "x" doesn't clearly indicate what this value represents.
```

### Student Workflow: Receiving and Navigating Feedback

1. **Open any code file** in your GitHub repository (blob page)
2. **Look for the sidebar** on the right side of the code viewer - it automatically appears when you're on a code file
3. **See your comments**:
   - Comments for the current file appear at the top
   - Comments for other files are grouped below with file headers
   - Each comment shows the line number and feedback text
4. **Navigate to feedback**:
   - **Click a comment** in the sidebar to jump directly to that line in the code
   - The line will be highlighted in yellow and smoothly scroll into view
   - If the comment references a different file, clicking it navigates to that file
5. **View line icons**:
   - Look for comment icons (💬) next to line numbers that have associated issues
   - **Hover over the icon** to see a tooltip with all issue comments for that line
6. **Work with issues**:
   - Hover over any comment box to see the full text (it expands vertically)
   - Click the **↗ icon** in the top-right corner of a comment to open the issue in a new window
   - In the new window, you can close the issue or add replies without losing your place in the code
7. **Navigate between files**: When you click a comment linking to a different file, the extension maintains your context and highlights the relevant line

### Sidebar Controls

- **Toggle Button**: Click the icon in the GitHub toolbar (top right) to show/hide the sidebar
- **Close Button**: Click the × button in the sidebar header to close it
- **Clear Cache**: Click the 🗑️ button next to the close button to refresh the issues list (useful if you just created a new issue)

## Technical Details

### How It Works

1. **Issue Detection**: The extension fetches all open issues from the current repository using the GitHub REST API
2. **URL Parsing**: It extracts blob URLs and line numbers from issue bodies using regex patterns
3. **Smart Filtering**: Only open issues are displayed (closed issues are automatically filtered out)
4. **File Grouping**: Issues are grouped by file path, with the currently viewed file's issues at the top
5. **Line Mapping**: Icons are injected next to code lines that have associated open issues
6. **Caching**: Issues are cached for 5 minutes to improve performance when navigating between files

### File Structure

```
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js      # Background service worker
├── content.js         # Content script (injected into GitHub pages)
└── icons/             # Extension icons
    ├── icon16.png     # Toolbar icon (16x16)
    ├── icon48.png     # Extension management icon (48x48)
    ├── icon128.png    # Store icon (128x128)
    └── CommentIcon.png # Line comment icon
```

### Permissions

- **`storage`**: Used for caching issue data and remembering the last clicked comment
- **`activeTab`**: Allows interaction with GitHub pages
- **`https://api.github.com/*`**: Fetches issue data from GitHub's REST API

## Development

### Making Changes

1. Edit the files as needed
2. Go to `chrome://extensions/` or `edge://extensions/`
3. Click the reload icon (🔄) on the extension card
4. Reload any GitHub pages to see content script changes

### Testing

1. Test in Chrome first to ensure compatibility
2. Test in Edge (should work without modifications)
3. Check browser console for errors:
   - **Background**: Go to `chrome://extensions/` → Details → Service Worker → Inspect
   - **Content**: Open DevTools on GitHub → Console tab

## Requirements

- Chrome 88+ or Edge 88+ (Manifest V3 support)
- GitHub account with access to the repository
- Issues must contain blob URLs with line references (format: `#L{number}` or `#L{start}-L{end}`)

## Limitations

- Only works on GitHub blob pages (file view pages)
- Requires issues to have blob URLs with line references in the body
- Only displays open issues (closed issues are filtered out)
- Issues are cached for 5 minutes (use Clear Cache button to refresh)

## Troubleshooting

**Sidebar not appearing?**
- Make sure you're on a blob page (code file view)
- Check if the extension is enabled in browser settings
- Try refreshing the page

**Comments not showing?**
- Verify the issue is open (not closed)
- Check that the issue body contains a valid GitHub blob URL with line reference
- Try clicking the Clear Cache button (🗑️) to refresh

**Icons not appearing next to lines?**
- Only open issues are shown with line icons
- Make sure the blob URL in the issue references the current file

## Contributing

This extension is designed for educational code review workflows. Suggestions and improvements are welcome!

## License

[Add your license here]

## Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Edge Extension Documentation](https://docs.microsoft.com/microsoft-edge/extensions-chromium/)
- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
