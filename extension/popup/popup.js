// Configuration
const API_URL = 'http://localhost:3000/api';

// State Management
let currentUser = null;
let activities = [];
let extractedActivities = [];

// DOM Elements
const authSection = document.getElementById('authSection');
const mainSection = document.getElementById('mainSection');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const addActivityBtn = document.getElementById('addActivityBtn');
const addActivityModal = document.getElementById('addActivityModal');
const closeModal = document.getElementById('closeModal');
const addActivityForm = document.getElementById('addActivityForm');
const activityList = document.getElementById('activityList');
const syncBtn = document.getElementById('syncBtn');
const syncLmsBtn = document.getElementById('syncLmsBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const extractedActivitiesList = document.getElementById('extractedActivitiesList');
const lmsSyncStatus = document.getElementById('lmsSyncStatus');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
  // Tab switching
  loginTab.addEventListener('click', () => switchTab('login'));
  registerTab.addEventListener('click', () => switchTab('register'));
  
  // Auth forms
  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);
  
  // Activity actions
  addActivityBtn.addEventListener('click', () => addActivityModal.classList.remove('hidden'));
  closeModal.addEventListener('click', () => addActivityModal.classList.add('hidden'));
  addActivityForm.addEventListener('submit', handleAddActivity);
  
  // Quick actions
  syncBtn.addEventListener('click', syncActivities);
  syncLmsBtn.addEventListener('click', handleSyncFromLMS);
  logoutBtn.addEventListener('click', handleLogout);
  
  // Close modal on outside click
  addActivityModal.addEventListener('click', (e) => {
    if (e.target === addActivityModal) {
      addActivityModal.classList.add('hidden');
    }
  });
}

// Tab Switching
function switchTab(tab) {
  if (tab === 'login') {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  } else {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  }
}

// Check Authentication
async function checkAuth() {
  const token = await getStorageData('authToken');
  if (token) {
    currentUser = await getStorageData('currentUser');
    showMainSection();
    await loadActivities();
  } else {
    showAuthSection();
  }
}

// Handle Login
async function handleLogin(e) {
  e.preventDefault();
  showLoading(true);
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      await setStorageData('authToken', data.token);
      await setStorageData('currentUser', data.user);
      currentUser = data.user;
      showToast('Login successful!', 'success');
      showMainSection();
      await loadActivities();
    } else {
      showToast(data.message || 'Login failed', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Connection error. Please try again.', 'error');
  } finally {
    showLoading(false);
  }
}

// Handle Register
async function handleRegister(e) {
  e.preventDefault();
  showLoading(true);
  
  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast('Registration successful! Please login.', 'success');
      switchTab('login');
      document.getElementById('loginEmail').value = email;
    } else {
      showToast(data.message || 'Registration failed', 'error');
    }
  } catch (error) {
    console.error('Register error:', error);
    showToast('Connection error. Please try again.', 'error');
  } finally {
    showLoading(false);
  }
}

// Handle Add Activity
async function handleAddActivity(e) {
  e.preventDefault();
  showLoading(true);
  
  const title = document.getElementById('activityTitle').value;
  const type = document.getElementById('activityType').value;
  const deadline = document.getElementById('activityDeadline').value;
  const description = document.getElementById('activityDescription').value;
  const priority = document.getElementById('activityPriority').value;
  
  try {
    const token = await getStorageData('authToken');
    const response = await fetch(`${API_URL}/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        type,
        deadline,
        description,
        priority,
        status: 'pending'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast('Activity added successfully!', 'success');
      addActivityModal.classList.add('hidden');
      addActivityForm.reset();
      await loadActivities();
    } else {
      showToast(data.message || 'Failed to add activity', 'error');
    }
  } catch (error) {
    console.error('Add activity error:', error);
    showToast('Connection error. Please try again.', 'error');
  } finally {
    showLoading(false);
  }
}

// Load Activities
async function loadActivities() {
  showLoading(true);
  
  try {
    const token = await getStorageData('authToken');
    const response = await fetch(`${API_URL}/activities`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      activities = await response.json();
      renderActivities();
      updateStats();
    } else {
      showToast('Failed to load activities', 'error');
    }
  } catch (error) {
    console.error('Load activities error:', error);
    showToast('Connection error. Please try again.', 'error');
  } finally {
    showLoading(false);
  }
}

// Render Activities
function renderActivities() {
  if (activities.length === 0) {
    activityList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-text">No activities yet. Add your first activity!</div>
      </div>
    `;
    return;
  }
  
  // Sort by deadline
  const sortedActivities = [...activities]
    .filter(a => a.status !== 'completed')
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 5); // Show only 5 most recent
  
  activityList.innerHTML = sortedActivities.map(activity => {
    const deadline = new Date(activity.deadline);
    const now = new Date();
    const isOverdue = deadline < now;
    
    return `
      <div class="activity-item ${activity.priority}-priority" data-id="${activity.id}">
        <div class="activity-header">
          <div class="activity-title">${escapeHtml(activity.title)}</div>
          <div class="activity-type">${activity.type}</div>
        </div>
        <div class="activity-deadline" style="color: ${isOverdue ? '#f56565' : '#718096'}">
          ${isOverdue ? '⚠️ ' : ''}${formatDate(deadline)}
        </div>
      </div>
    `;
  }).join('');
  
  // Add click listeners to activities
  document.querySelectorAll('.activity-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      showActivityDetails(id);
    });
  });
}

// Update Stats
function updateStats() {
  const total = activities.length;
  const pending = activities.filter(a => a.status === 'pending').length;
  const completed = activities.filter(a => a.status === 'completed').length;
  
  document.getElementById('totalActivities').textContent = total;
  document.getElementById('pendingActivities').textContent = pending;
  document.getElementById('completedActivities').textContent = completed;
}

// Sync Activities
async function syncActivities() {
  await loadActivities();
  showToast('Activities synced!', 'success');
}

// Sync from LMS
async function handleSyncFromLMS() {
  showLoading(true);
  lmsSyncStatus.textContent = 'Extracting activities from LMS page...';
  lmsSyncStatus.className = 'lms-sync-status info';
  lmsSyncStatus.classList.remove('hidden');
  extractedActivitiesList.classList.add('hidden');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'extractActivities' });
    
    if (response && response.success) {
      extractedActivities = response.data || [];
      
      if (extractedActivities.length === 0) {
        lmsSyncStatus.textContent = 'No activities found on this page. Make sure you are on the LMS dashboard.';
        lmsSyncStatus.className = 'lms-sync-status warning';
        extractedActivitiesList.classList.add('hidden');
      } else {
        lmsSyncStatus.textContent = `Found ${extractedActivities.length} activit${extractedActivities.length === 1 ? 'y' : 'ies'}. Select activities to import:`;
        lmsSyncStatus.className = 'lms-sync-status success';
        renderExtractedActivities();
        extractedActivitiesList.classList.remove('hidden');
      }
    } else {
      throw new Error(response?.error || 'Failed to extract activities');
    }
  } catch (error) {
    console.error('Sync from LMS error:', error);
    lmsSyncStatus.textContent = `Error: ${error.message}. Please make sure you are on the LMS website (lms.nibmworldwide.com)`;
    lmsSyncStatus.className = 'lms-sync-status error';
    extractedActivitiesList.classList.add('hidden');
  } finally {
    showLoading(false);
  }
}

// Render Extracted Activities
function renderExtractedActivities() {
  if (extractedActivities.length === 0) {
    extractedActivitiesList.innerHTML = '';
    return;
  }

  extractedActivitiesList.innerHTML = extractedActivities.map((activity, index) => {
    const deadline = new Date(activity.deadline);
    const now = new Date();
    const isOverdue = deadline < now;
    
    return `
      <div class="extracted-activity-item" data-index="${index}">
        <div class="extracted-activity-checkbox">
          <input type="checkbox" id="activity-${index}" checked class="activity-checkbox">
        </div>
        <div class="extracted-activity-content">
          <div class="activity-header">
            <div class="activity-title">${escapeHtml(activity.title)}</div>
            <div class="activity-type">${activity.type}</div>
          </div>
          <div class="activity-deadline" style="color: ${isOverdue ? '#f56565' : '#718096'}">
            ${isOverdue ? '⚠️ ' : ''}${formatDate(deadline)}
          </div>
          ${activity.url ? `<div class="activity-url">${new URL(activity.url).pathname}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Add import button if there are activities
  if (extractedActivities.length > 0) {
    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-primary';
    importBtn.style.width = '100%';
    importBtn.style.marginTop = '12px';
    importBtn.textContent = 'Import Selected Activities';
    importBtn.addEventListener('click', handleImportActivities);
    
    // Remove existing import button if any
    const existingBtn = extractedActivitiesList.querySelector('.import-btn-container');
    if (existingBtn) existingBtn.remove();
    
    const btnContainer = document.createElement('div');
    btnContainer.className = 'import-btn-container';
    btnContainer.appendChild(importBtn);
    extractedActivitiesList.appendChild(btnContainer);
  }
}

// Import Selected Activities
async function handleImportActivities() {
  const checkboxes = extractedActivitiesList.querySelectorAll('.activity-checkbox:checked');
  const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.id.split('-')[1]));
  const selectedActivities = selectedIndices.map(i => extractedActivities[i]);

  if (selectedActivities.length === 0) {
    showToast('Please select at least one activity to import', 'error');
    return;
  }

  showLoading(true);
  let successCount = 0;
  let errorCount = 0;

  try {
    for (const activity of selectedActivities) {
      try {
        await chrome.runtime.sendMessage({
          action: 'addActivity',
          data: {
            title: activity.title,
            type: activity.type,
            deadline: activity.deadline,
            description: activity.description || '',
            status: 'pending',
            priority: 'medium',
            url: activity.url || '',
            source: 'lms_extracted'
          }
        });
        successCount++;
      } catch (error) {
        console.error('Error importing activity:', error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      showToast(`Successfully imported ${successCount} activit${successCount === 1 ? 'y' : 'ies'}!`, 'success');
      await loadActivities();
      
      // Clear extracted activities
      extractedActivities = [];
      extractedActivitiesList.classList.add('hidden');
      lmsSyncStatus.textContent = '';
      lmsSyncStatus.classList.add('hidden');
    }
    
    if (errorCount > 0) {
      showToast(`Failed to import ${errorCount} activit${errorCount === 1 ? 'y' : 'ies'}`, 'error');
    }
  } catch (error) {
    console.error('Import activities error:', error);
    showToast('Error importing activities', 'error');
  } finally {
    showLoading(false);
  }
}

// Handle Logout
async function handleLogout() {
  await chrome.storage.local.remove(['authToken', 'currentUser']);
  currentUser = null;
  activities = [];
  showAuthSection();
  showToast('Logged out successfully', 'success');
}

// Show Activity Details (placeholder - implement as needed)
function showActivityDetails(id) {
  const activity = activities.find(a => a.id == id);
  if (activity) {
    // Open a new page or show a detailed modal
    alert(`Activity: ${activity.title}\nType: ${activity.type}\nDeadline: ${formatDate(new Date(activity.deadline))}\n\n${activity.description || 'No description'}`);
  }
}

// UI Helper Functions
function showAuthSection() {
  authSection.classList.remove('hidden');
  mainSection.classList.add('hidden');
}

function showMainSection() {
  authSection.classList.add('hidden');
  mainSection.classList.remove('hidden');
}

function showLoading(show) {
  if (show) {
    loadingIndicator.classList.remove('hidden');
  } else {
    loadingIndicator.classList.add('hidden');
  }
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// Storage Helpers
async function getStorageData(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key]);
    });
  });
}

async function setStorageData(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

// Utility Functions
function formatDate(date) {
  const now = new Date();
  const diff = date - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days < 0) {
    return `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`;
  } else if (days === 0) {
    return 'Today';
  } else if (days === 1) {
    return 'Tomorrow';
  } else if (days < 7) {
    return `In ${days} days`;
  } else {
    return date.toLocaleDateString();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
