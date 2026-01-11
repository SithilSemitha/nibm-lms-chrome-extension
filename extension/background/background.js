// Background Service Worker for LMS Activity Manager

const API_URL = 'http://localhost:3000/api';

// Install event
chrome.runtime.onInstalled.addListener(() => {
  console.log('LMS Activity Manager installed');
  
  // Set up alarms for notifications
  chrome.alarms.create('checkDeadlines', {
    delayInMinutes: 1,
    periodInMinutes: 60 // Check every hour
  });
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'addActivity') {
    handleAddActivity(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'getActivities') {
    handleGetActivities()
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'updateActivity') {
    handleUpdateActivity(request.id, request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'deleteActivity') {
    handleDeleteActivity(request.id)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Handle alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkDeadlines') {
    checkUpcomingDeadlines();
  }
});

// Add Activity
async function handleAddActivity(activityData) {
  try {
    const token = await getStorageData('authToken');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${API_URL}/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(activityData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to add activity');
    }
    
    const data = await response.json();
    
    // Create notification alarm if deadline is soon
    scheduleNotification(data);
    
    return data;
  } catch (error) {
    console.error('Error adding activity:', error);
    throw error;
  }
}

// Get Activities
async function handleGetActivities() {
  try {
    const token = await getStorageData('authToken');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${API_URL}/activities`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to get activities');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting activities:', error);
    throw error;
  }
}

// Update Activity
async function handleUpdateActivity(id, updateData) {
  try {
    const token = await getStorageData('authToken');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${API_URL}/activities/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updateData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update activity');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating activity:', error);
    throw error;
  }
}

// Delete Activity
async function handleDeleteActivity(id) {
  try {
    const token = await getStorageData('authToken');
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${API_URL}/activities/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete activity');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting activity:', error);
    throw error;
  }
}

// Check Upcoming Deadlines
async function checkUpcomingDeadlines() {
  try {
    const activities = await handleGetActivities();
    const now = new Date();
    
    activities.forEach(activity => {
      if (activity.status === 'pending') {
        const deadline = new Date(activity.deadline);
        const hoursUntil = (deadline - now) / (1000 * 60 * 60);
        
        // Notify if deadline is within 24 hours
        if (hoursUntil > 0 && hoursUntil <= 24) {
          sendNotification(
            'Upcoming Deadline!',
            `${activity.title} is due ${formatTimeUntil(hoursUntil)}`,
            activity.id
          );
        }
        
        // Notify if overdue
        if (hoursUntil < 0 && hoursUntil > -24) {
          sendNotification(
            'Overdue Activity!',
            `${activity.title} was due ${formatTimeUntil(Math.abs(hoursUntil))} ago`,
            activity.id
          );
        }
      }
    });
  } catch (error) {
    console.error('Error checking deadlines:', error);
  }
}

// Schedule Notification
function scheduleNotification(activity) {
  const deadline = new Date(activity.deadline);
  const now = new Date();
  const msUntilDeadline = deadline - now;
  
  // Schedule notification 24 hours before deadline
  const msUntilNotification = msUntilDeadline - (24 * 60 * 60 * 1000);
  
  if (msUntilNotification > 0) {
    const minutesUntilNotification = msUntilNotification / (1000 * 60);
    
    chrome.alarms.create(`activity_${activity.id}`, {
      delayInMinutes: minutesUntilNotification
    });
  }
}

// Send Notification
function sendNotification(title, message, activityId) {
  chrome.notifications.create(`activity_${activityId}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: title,
    message: message,
    priority: 2
  });
}

// Handle Notification Clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  // Open popup or activity details
  chrome.action.openPopup();
});

// Storage Helper
function getStorageData(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key]);
    });
  });
}

// Utility Functions
function formatTimeUntil(hours) {
  if (hours < 1) {
    return `${Math.round(hours * 60)} minutes`;
  } else if (hours < 24) {
    return `${Math.round(hours)} hour${Math.round(hours) !== 1 ? 's' : ''}`;
  } else {
    const days = Math.round(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
}

// Handle badge updates
async function updateBadge() {
  try {
    const activities = await handleGetActivities();
    const pending = activities.filter(a => a.status === 'pending').length;
    
    if (pending > 0) {
      chrome.action.setBadgeText({ text: pending.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

// Update badge periodically
setInterval(updateBadge, 5 * 60 * 1000); // Every 5 minutes
updateBadge(); // Initial update
