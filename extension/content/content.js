// Content script for LMS Activity Manager
// This script runs on lms.nibmworldwide.com pages

(function() {
  'use strict';

  console.log('LMS Activity Manager: Content script loaded');

  // Create floating action button
  createFloatingButton();

  // Monitor page for activities
  observePageChanges();

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractActivities') {
      const activities = extractActivitiesFromPage();
      sendResponse({ success: true, activities });
      return true;
    }
  });

  // Create Floating Action Button
  function createFloatingButton() {
    const fab = document.createElement('div');
    fab.id = 'lms-activity-fab';
    fab.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    fab.title = 'Quick Add Activity';
    
    fab.addEventListener('click', () => {
      showQuickAddDialog();
    });
    
    document.body.appendChild(fab);
  }

  // Show Quick Add Dialog
  function showQuickAddDialog() {
    const existingDialog = document.getElementById('lms-quick-add-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    const dialog = document.createElement('div');
    dialog.id = 'lms-quick-add-dialog';
    dialog.innerHTML = `
      <div class="lms-dialog-overlay">
        <div class="lms-dialog-content">
          <div class="lms-dialog-header">
            <h3>Quick Add Activity</h3>
            <button class="lms-close-btn">&times;</button>
          </div>
          <form id="lms-quick-add-form">
            <input type="text" id="lms-quick-title" placeholder="Activity Title" required>
            <select id="lms-quick-type" required>
              <option value="">Select Type</option>
              <option value="assignment">Assignment</option>
              <option value="quiz">Quiz</option>
              <option value="exam">Exam</option>
              <option value="project">Project</option>
              <option value="reading">Reading</option>
              <option value="other">Other</option>
            </select>
            <input type="datetime-local" id="lms-quick-deadline" required>
            <button type="submit" class="lms-submit-btn">Add Activity</button>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // Event listeners
    dialog.querySelector('.lms-close-btn').addEventListener('click', () => {
      dialog.remove();
    });

    dialog.querySelector('.lms-dialog-overlay').addEventListener('click', (e) => {
      if (e.target.classList.contains('lms-dialog-overlay')) {
        dialog.remove();
      }
    });

    dialog.querySelector('#lms-quick-add-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleQuickAdd();
    });
  }

  // Handle Quick Add
  async function handleQuickAdd() {
    const title = document.getElementById('lms-quick-title').value;
    const type = document.getElementById('lms-quick-type').value;
    const deadline = document.getElementById('lms-quick-deadline').value;

    try {
      // Send message to background script to add activity
      chrome.runtime.sendMessage({
        action: 'addActivity',
        data: {
          title,
          type,
          deadline,
          status: 'pending',
          priority: 'medium',
          source: 'lms_page',
          url: window.location.href
        }
      }, (response) => {
        if (response && response.success) {
          showNotification('Activity added successfully!', 'success');
          document.getElementById('lms-quick-add-dialog').remove();
        } else {
          showNotification('Failed to add activity', 'error');
        }
      });
    } catch (error) {
      console.error('Error adding activity:', error);
      showNotification('Error adding activity', 'error');
    }
  }

  // Extract Activities from Page - Enhanced version
  function extractActivitiesFromPage() {
    const activities = [];
    console.log('LMS Activity Manager: Starting extraction from page:', window.location.href);
    
    // Common LMS selectors for activities/assignments - Moodle specific patterns
    const activitySelectors = [
      // Moodle activity modules
      '.activity.modtype_assign, .activity.modtype_quiz, .activity.modtype_assignment',
      '.modtype_assign, .modtype_quiz, .modtype_assignment',
      '[data-mod="assign"], [data-mod="quiz"], [data-mod="assignment"]',
      // Moodle course section activities
      '.course-content ul li[class*="modtype"]',
      '.section li.activity, .section li[data-modid]',
      // Generic patterns
      '.activity, .assignment, .quiz, .course-item, .event-item',
      '[class*="assignment"], [class*="quiz"], [class*="deadline"]',
      // Calendar/event patterns
      '.event, .deadline-item, .due-item',
      // List items with deadlines
      'li[class*="assign"], li[class*="quiz"], li[class*="deadline"]',
      // Moodle blocks (upcoming events)
      '.block_calendar_month .event, .block_calendar_upcoming .event'
    ];

    // Try each selector pattern
    activitySelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`Trying selector "${selector}": found ${elements.length} elements`);
        elements.forEach((element, idx) => {
          try {
            const activity = parseActivityElement(element);
            if (activity) {
              // Check for duplicates
              const isDuplicate = activities.some(a => 
                a.title === activity.title && 
                a.deadline === activity.deadline
              );
              if (!isDuplicate) {
                activities.push(activity);
                console.log(`Extracted activity ${activities.length}:`, activity.title, activity.deadline);
              }
            }
          } catch (error) {
            console.error(`Error parsing element ${idx} with selector ${selector}:`, error);
          }
        });
      } catch (error) {
        console.error('Error with selector:', selector, error);
      }
    });

    // Also check for calendar views and timeline sections
    extractFromCalendarView(activities);
    extractFromTimeline(activities);
    extractFromTables(activities);
    
    // Try extracting from upcoming events block (common Moodle feature)
    extractFromUpcomingEvents(activities);

    console.log('LMS Activity Manager: Total extracted activities:', activities.length);
    console.log('Extracted activities:', activities);
    return activities;
  }
  
  // Extract from Moodle's upcoming events block
  function extractFromUpcomingEvents(activities) {
    try {
      // Look for upcoming events blocks
      const upcomingBlocks = document.querySelectorAll('.block_calendar_upcoming, .block_timeline, [id*="calendar"]');
      upcomingBlocks.forEach(block => {
        const events = block.querySelectorAll('.event, .event_title, a[href*="mod"]');
        events.forEach(eventEl => {
          const activity = parseActivityElement(eventEl);
          if (activity && !activities.some(a => a.title === activity.title)) {
            activities.push(activity);
          }
        });
      });
    } catch (error) {
      console.error('Error extracting from upcoming events:', error);
    }
  }

  // Extract from calendar/timeline views
  function extractFromCalendarView(activities) {
    // Look for calendar events
    const calendarCells = document.querySelectorAll('.calendar_event, .event, .fc-event, [class*="event"]');
    calendarCells.forEach(cell => {
      const activity = parseActivityElement(cell);
      if (activity && activity.title && activity.deadline && !activities.some(a => a.title === activity.title)) {
        activities.push(activity);
      }
    });
  }

  // Extract from timeline/dashboard views
  function extractFromTimeline(activities) {
    // Look for timeline items
    const timelineItems = document.querySelectorAll('.timeline-item, .upcoming-event, [class*="timeline"]');
    timelineItems.forEach(item => {
      const activity = parseActivityElement(item);
      if (activity && activity.title && activity.deadline && !activities.some(a => a.title === activity.title)) {
        activities.push(activity);
      }
    });
  }

  // Extract from table views (common in LMS dashboards)
  function extractFromTables(activities) {
    const tables = document.querySelectorAll('table, .table');
    tables.forEach(table => {
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        if (row.cells && row.cells.length >= 2) {
          const activity = parseTableRow(row);
          if (activity && activity.title && activity.deadline && !activities.some(a => a.title === activity.title)) {
            activities.push(activity);
          }
        }
      });
    });
  }

  // Parse table row for activity data
  function parseTableRow(row) {
    try {
      const cells = Array.from(row.cells);
      let title = null;
      let deadlineText = null;
      let url = null;
      let type = 'other';

      // Find title (usually first or second cell with link)
      const titleLink = row.querySelector('a');
      if (titleLink) {
        title = titleLink.textContent.trim();
        url = titleLink.href;
        
        // Infer type from URL or text
        const href = url.toLowerCase();
        const text = title.toLowerCase();
        if (href.includes('assign') || text.includes('assign')) type = 'assignment';
        else if (href.includes('quiz') || text.includes('quiz')) type = 'quiz';
        else if (href.includes('exam') || text.includes('exam')) type = 'exam';
        else if (href.includes('project') || text.includes('project')) type = 'project';
      }

      // Look for date/deadline in cells
      cells.forEach(cell => {
        const text = cell.textContent.trim();
        if (isDateString(text)) {
          deadlineText = text;
        }
      });

      // Also check for time elements
      const timeEl = row.querySelector('time, [datetime]');
      if (timeEl) {
        deadlineText = timeEl.getAttribute('datetime') || timeEl.textContent.trim();
      }

      if (title && deadlineText) {
        const deadline = parseDate(deadlineText);
        if (deadline) {
          return {
            title,
            type,
            deadline: deadline.toISOString(),
            url: url || window.location.href,
            source: 'lms_extracted'
          };
        }
      }
    } catch (error) {
      console.error('Error parsing table row:', error);
    }
    return null;
  }

  // Parse Activity Element - Enhanced version
  function parseActivityElement(element) {
    try {
      let title = null;
      let deadlineText = null;
      let url = null;
      let type = 'other';
      let description = null;

      // Find title - try multiple selectors
      const titleSelectors = [
        'h3, h4, .title, .name, .activitytitle, .assignment-title',
        'a[href*="assign"], a[href*="quiz"], a[href*="mod"]',
        '.instancename, .activityname'
      ];

      for (const selector of titleSelectors) {
        const titleEl = element.querySelector(selector);
        if (titleEl) {
          title = titleEl.textContent.trim();
          
          // Get URL if it's a link
          if (titleEl.tagName === 'A') {
            url = titleEl.href;
          } else {
            const link = element.querySelector('a');
            if (link) url = link.href;
          }
          break;
        }
      }

      // If no title found, try getting text from element itself
      if (!title) {
        const link = element.querySelector('a');
        if (link) {
          title = link.textContent.trim();
          url = link.href;
        } else {
          title = element.textContent.trim().split('\n')[0].substring(0, 100);
        }
      }

      // Infer type from URL, class, or title
      const elementText = element.textContent.toLowerCase();
      const elementClasses = element.className.toLowerCase();
      const href = (url || '').toLowerCase();
      const titleLower = title.toLowerCase();

      if (href.includes('assign') || elementClasses.includes('assign') || titleLower.includes('assign')) {
        type = 'assignment';
      } else if (href.includes('quiz') || elementClasses.includes('quiz') || titleLower.includes('quiz')) {
        type = 'quiz';
      } else if (href.includes('exam') || elementClasses.includes('exam') || titleLower.includes('exam')) {
        type = 'exam';
      } else if (href.includes('project') || elementClasses.includes('project') || titleLower.includes('project')) {
        type = 'project';
      } else if (href.includes('resource') || elementClasses.includes('resource') || titleLower.includes('reading')) {
        type = 'reading';
      }

      // Find deadline - try multiple selectors and patterns
      const deadlineSelectors = [
        '.deadline, .due-date, .due, .submission-date',
        'time[datetime], .date, .deadline-date',
        '[class*="deadline"], [class*="due"], [class*="submission"]',
        '.text-muted, .small'
      ];

      for (const selector of deadlineSelectors) {
        const deadlineEl = element.querySelector(selector);
        if (deadlineEl) {
          deadlineText = deadlineEl.getAttribute('datetime') || deadlineEl.textContent.trim();
          if (deadlineText && isDateString(deadlineText)) {
            break;
          }
        }
      }

      // Also search text content for date patterns
      if (!deadlineText) {
        const text = element.textContent;
        const dateMatches = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:due|deadline|submission).*?(?:on|by|:).*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
        if (dateMatches) {
          deadlineText = dateMatches[0] || dateMatches[1];
        }
      }

      // Parse the date
      let deadline = null;
      if (deadlineText) {
        deadline = parseDate(deadlineText);
      }

      // Return activity if we have at least a title
      // If no deadline found, set a default future date (30 days from now)
      if (title && title.trim().length > 0) {
        let finalDeadline = deadline;
        if (!finalDeadline) {
          // If no deadline found, try to infer from text or set default
          const text = element.textContent.toLowerCase();
          if (text.includes('due') || text.includes('deadline') || text.includes('submission')) {
            // Try one more time to find date in full text
            const allText = element.textContent;
            const dateMatch = allText.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/);
            if (dateMatch) {
              finalDeadline = parseDate(dateMatch[0]);
            }
          }
          // If still no deadline, set to 30 days from now
          if (!finalDeadline) {
            finalDeadline = new Date();
            finalDeadline.setDate(finalDeadline.getDate() + 30);
            finalDeadline.setHours(23, 59, 59, 999);
          }
        }
        
        return {
          title: title.substring(0, 500), // Limit title length
          type,
          deadline: finalDeadline.toISOString(),
          url: url || window.location.href,
          description: description || '',
          source: 'lms_extracted'
        };
      }
    } catch (error) {
      console.error('Error parsing activity element:', error);
    }
    return null;
  }

  // Parse date string in various formats
  function parseDate(dateString) {
    if (!dateString) return null;

    try {
      // Clean the date string
      let cleanDate = dateString.trim();

      // Remove common prefixes
      cleanDate = cleanDate.replace(/^(due|deadline|submission|by|on|date):?\s*/i, '');
      cleanDate = cleanDate.replace(/\s*(due|deadline|submission|by|on).*$/i, '');
      
      // Remove timezone indicators for easier parsing
      cleanDate = cleanDate.replace(/\s*[A-Z]{3,4}\s*$/, '');

      // Try ISO format first
      let date = new Date(cleanDate);
      if (!isNaN(date.getTime()) && date.getFullYear() > 2000 && date.getFullYear() < 2100) {
        return date;
      }

      // Try common formats
      const formats = [
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, // MM/DD/YYYY or DD/MM/YYYY
        /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, // YYYY/MM/DD
        /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i, // DD Month YYYY
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i // Month DD, YYYY
      ];

      const monthNames = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };

      for (const format of formats) {
        const match = cleanDate.match(format);
        if (match) {
          if (format === formats[0]) {
            // MM/DD/YYYY or DD/MM/YYYY - try both
            const m = parseInt(match[1]);
            const d = parseInt(match[2]);
            const y = parseInt(match[3]);
            // Assume MM/DD/YYYY if month > 12, otherwise try DD/MM
            if (m > 12) {
              date = new Date(y, d - 1, m);
            } else {
              date = new Date(y, m - 1, d);
            }
          } else if (format === formats[1]) {
            date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
          } else if (format === formats[2]) {
            const month = monthNames[match[2].toLowerCase().substring(0, 3)];
            date = new Date(parseInt(match[3]), month, parseInt(match[1]));
          } else if (format === formats[3]) {
            const month = monthNames[match[1].toLowerCase().substring(0, 3)];
            date = new Date(parseInt(match[3]), month, parseInt(match[2]));
          }
          if (date && !isNaN(date.getTime())) {
            // Set to end of day if no time specified
            if (!cleanDate.match(/\d{1,2}:\d{2}/)) {
              date.setHours(23, 59, 59, 999);
            }
            return date;
          }
        }
      }

      // Last resort: try Date constructor again with cleaned string
      date = new Date(cleanDate);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (error) {
      console.error('Error parsing date:', dateString, error);
    }

    return null;
  }

  // Check if string looks like a date
  function isDateString(str) {
    if (!str) return false;
    return /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(str);
  }

  // Observe Page Changes
  function observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      // Re-scan for new activities when page content changes
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          // Debounce re-extraction
          clearTimeout(window.lmsExtractTimeout);
          window.lmsExtractTimeout = setTimeout(() => {
            extractActivitiesFromPage();
          }, 1000);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Show Notification
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `lms-notification lms-notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('lms-notification-show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('lms-notification-show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Add Activity Highlight Feature
  function highlightDeadlines() {
    const now = new Date();
    const deadlineElements = document.querySelectorAll('.deadline, .due-date, time[datetime], [class*="deadline"]');
    
    deadlineElements.forEach(element => {
      const dateText = element.textContent || element.getAttribute('datetime');
      if (dateText) {
        const deadline = parseDate(dateText);
        if (deadline && !isNaN(deadline.getTime())) {
          const daysUntil = Math.floor((deadline - now) / (1000 * 60 * 60 * 24));
          
          if (daysUntil < 0) {
            element.style.backgroundColor = '#fee';
            element.style.color = '#c00';
            element.style.fontWeight = 'bold';
          } else if (daysUntil <= 2) {
            element.style.backgroundColor = '#ffa';
            element.style.color = '#880';
            element.style.fontWeight = '600';
          }
        }
      }
    });
  }

  // Run deadline highlighting after page load
  setTimeout(highlightDeadlines, 1000);
  setTimeout(highlightDeadlines, 3000); // Run again after dynamic content loads

})();
