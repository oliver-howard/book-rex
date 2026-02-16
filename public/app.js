// API base URL
console.log('BookRex App Version: 1.5.2');
const API_BASE = '/api';

// Track authentication state
let isAuthenticated = false;
let hasReadingHistory = false;
let hasBookLore = false;
let hasHardcover = false;
let hasGoodreads = false;
let isAdmin = false;
let isGuest = false;
let notificationTimeout;
let tbrCache = [];
let dataSourcePreference = 'auto';
let canToggleDataSource = false;
let adminUsers = [];
let heroPreviewBook = null;
let hasLoadedTBR = false;

function getChartColors() {
  const styles = getComputedStyle(document.documentElement);
  const axisText =
    styles.getPropertyValue('--text-primary')?.trim() ||
    styles.getPropertyValue('--text-secondary')?.trim() ||
    '#f6f7ff';
  const axisLine = styles.getPropertyValue('--border-color')?.trim() || 'rgba(255,255,255,0.3)';
  return { axisText, axisLine };
}

function generateClientBookId(title = '', author = '') {
  const normalized = `${title.toLowerCase()}-${author.toLowerCase()}`
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized;
}

function isInTBR(rec) {
  if (!tbrCache || tbrCache.length === 0) {
    return false;
  }
  const id = generateClientBookId(rec.title || '', rec.author || 'Unknown');
  return tbrCache.some((book) => book.id === id);
}
let authMode = 'login';

function clearAppState() {
  const resultAreas = [
    'similar-results',
    'contrasting-results',
    'blindspots-results',
    'custom-results',
    'stats-results',
    'tbr-results',
  ];

  resultAreas.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '';
    }
  });

  const loadingElement = document.getElementById('loading');
  loadingElement?.classList.add('hidden');

  const errorElement = document.getElementById('error');
  errorElement?.classList.add('hidden');

  const notificationElement = document.getElementById('notification');
  notificationElement?.classList.add('hidden');

  tbrCache = [];
  dataSourcePreference = 'auto';
  canToggleDataSource = false;
  isAdmin = false;
  heroPreviewBook = null;
  hasLoadedTBR = false;
  updateDataSourceToggle();
  updateHeroPreviewCard();
}

// Check authentication status
// Check authentication status
async function checkAuthStatus() {
  try {
    const response = await fetch(`${API_BASE}/auth/status?t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    const data = await response.json();

    if (data.authenticated) {
      const isNewlyAuthenticated = !isAuthenticated;
      isAuthenticated = true;
      isGuest = data.isGuest || false;
      hasReadingHistory = data.hasReadingHistory || false;
      hasBookLore = data.hasBookLore || false;
      hasHardcover = data.hasHardcover || false;
      hasGoodreads = data.hasGoodreads || false;
      isAdmin = !!data.isAdmin;
      dataSourcePreference = data.dataSourcePreference || 'auto';
      canToggleDataSource = !!data.canChooseDataSource;
      hideLoginModal();
      
      const guestControls = document.getElementById('guest-controls');
      const userInfo = document.getElementById('user-info');
      const authActionBtn = document.getElementById('auth-action-btn');

      if (isGuest) {
        document.body.classList.add('guest-mode');
        if (guestControls) guestControls.classList.remove('hidden');
        if (userInfo) userInfo.classList.add('hidden');
      } else {
        document.body.classList.remove('guest-mode');
        if (guestControls) guestControls.classList.add('hidden');
        if (userInfo) userInfo.classList.remove('hidden');
        if (authActionBtn) authActionBtn.textContent = 'Logout';
      }

      try {
        if (!isGuest) {
            showUserInfo(data.username);
        }
      } catch (e) {
        console.error('Error showing user info:', e);
      }
      
      try {
        if (!hasLoadedTBR || isNewlyAuthenticated) {
          loadTBR(false, true);
        }

        // Page-specific initialization
        const path = window.location.pathname;
        if (path === '/settings') {
          updateSettingsUI(data);
          updateDataSourceToggle();
          loadAppVersion();
          if (isAdmin) {
            await loadAdminUsers();
          }
          await loadExclusionList();
        } else if (path === '/stats') {
          if (hasReadingHistory) {
            getStats();
          } else {
            const statsResults = document.getElementById('stats-results');
            if (statsResults) {
              statsResults.innerHTML = 
                '<p class="error-message">Connect a data source in Settings to view statistics.</p>';
            }
          }
        } else {
          // Home page
          updateUIForMode();
          const isHome = path === '/' || path === '/index.html';
          if (isHome && hasLoadedTBR) {
            updateHeroPreviewCard();
          }
        }
      } catch (uiError) {
        console.error('Error updating UI after auth:', uiError);
        // Do NOT show login modal here, as we are authenticated
      }
    } else {
      // Not authenticated - Default to Guest Mode behavior
      isAuthenticated = false;
      isGuest = true; // Effectively treating no-session as guest for UI purposes until they interact
      hasReadingHistory = false;
      hasBookLore = false;
      hasHardcover = false;
      hasGoodreads = false;
      isAdmin = false;
      dataSourcePreference = 'auto';
      canToggleDataSource = false;
      clearAppState();
      
      const guestControls = document.getElementById('guest-controls');
      const userInfo = document.getElementById('user-info');
      
      if (guestControls) guestControls.classList.remove('hidden');
      if (userInfo) userInfo.classList.add('hidden');
      document.body.classList.add('guest-mode');
      
      // Implicitly start guest session if needed, or just let backend create it on first action?
      // Better to explicitly start it so we don't have issues.
      handleGuestLogin(true); // silent
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
    // Silent fail to guest mode UI
     const guestControls = document.getElementById('guest-controls');
     if (guestControls) guestControls.classList.remove('hidden');
  }
}

// Update UI based on available data sources
function updateUIForMode() {
  // Tabs that require reading history (BookLore or Goodreads CSV)
  const historyRequiredTabs = ['similar', 'contrasting', 'blindspots'];

  historyRequiredTabs.forEach(tab => {
    const button = document.querySelector(`[data-tab="${tab}"]`);
    if (button) {
      if (hasReadingHistory) {
        button.disabled = false;
        button.title = '';
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
      } else {
        button.disabled = true;
        button.title = 'Configure a data source in Settings to access this feature';
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
      }
    }
  });

  // If on a restricted tab without proper access, switch to custom tab
  const activeTab = document.querySelector('.tab-button.active');
  if (activeTab) {
    const tabName = activeTab.dataset.tab;
    const needsHistory = historyRequiredTabs.includes(tabName);

    if (needsHistory && !hasReadingHistory) {
      switchTab('custom');
    }
  }

    if (needsHistory && !hasReadingHistory) {
      switchTab('custom');
    }
  }
// Update settings UI based on current configuration
function updateSettingsUI(data) {
  // Update BookLore status
  const bookloreStatus = document.getElementById('booklore-status-text');
  if (data.hasBookLore) {
    bookloreStatus.textContent = '✓ Connected';
    bookloreStatus.style.color = 'var(--success-color, #22c55e)';
  } else {
    bookloreStatus.textContent = 'Not connected';
    bookloreStatus.style.color = 'var(--text-secondary)';
  }

  // Update Hardcover status
  const hardcoverStatus = document.getElementById('hardcover-status-text');
  if (data.hasHardcover) {
    hardcoverStatus.textContent = '✓ Connected';
    hardcoverStatus.style.color = 'var(--success-color, #22c55e)';
  } else {
    hardcoverStatus.textContent = 'Not connected';
    hardcoverStatus.style.color = 'var(--text-secondary)';
  }

  // Update Goodreads status
  const goodreadsStatus = document.getElementById('goodreads-status-text');
  if (data.hasGoodreads) {
    goodreadsStatus.textContent = `✓ ${data.booksCount} books imported`;
    goodreadsStatus.style.color = 'var(--success-color, #22c55e)';
  } else {
    goodreadsStatus.textContent = 'No data uploaded';
    goodreadsStatus.style.color = 'var(--text-secondary)';
  }

  if (data.canChooseDataSource) {
    document.getElementById('data-source-section')?.classList.remove('hidden');
  } else {
    document.getElementById('data-source-section')?.classList.add('hidden');
  }

  if (data.isAdmin) {
    document.getElementById('admin-section')?.classList.remove('hidden');
    renderAdminUsers();
  } else {
    document.getElementById('admin-section')?.classList.add('hidden');
  }
  
  // Update toggle icon state
  updateBookLoreToggleIcon();
  updateHardcoverToggleIcon();
}

function toggleHardcoverSection() {
  const content = document.getElementById('hardcover-content');
  if (content) {
    content.classList.toggle('hidden');
    updateHardcoverToggleIcon();
  }
}

function updateHardcoverToggleIcon() {
  const content = document.getElementById('hardcover-content');
  const icon = document.querySelector('.toggle-icon-hardcover svg');
  if (content && icon) {
    if (content.classList.contains('hidden')) {
      icon.style.transform = 'rotate(0deg)';
    } else {
      icon.style.transform = 'rotate(180deg)';
    }
  }
}

function toggleBookLoreSection() {
  const content = document.getElementById('booklore-content');
  if (content) {
    content.classList.toggle('hidden');
    updateBookLoreToggleIcon();
  }
}

function updateBookLoreToggleIcon() {
  const content = document.getElementById('booklore-content');
  const icon = document.querySelector('.toggle-icon svg');
  if (content && icon) {
    if (content.classList.contains('hidden')) {
      icon.style.transform = 'rotate(0deg)';
    } else {
      icon.style.transform = 'rotate(180deg)';
    }
  }
}

// Display app version in settings
async function loadAppVersion() {
  const versionEl = document.getElementById('app-version');
  if (!versionEl) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/version`);
    if (!response.ok) {
      throw new Error(`Failed with status ${response.status}`);
    }
    const data = await response.json();
    const versionLabel = data.version ? `v${data.version}` : '';
    const name = 'BookRex';
    versionEl.textContent = versionLabel ? `${name} ${versionLabel}` : name;
  } catch (error) {
    console.error('Error loading app version:', error);
    versionEl.textContent = 'Version unavailable';
  }
}

// Show/hide login modal
function showLoginModal() {
  if (isAuthenticated && !isGuest) {
    console.log('Blocked showLoginModal: User is authenticated');
    return;
  }
  setAuthMode('login');
  document.getElementById('login-modal').style.display = 'flex';
}

function hideLoginModal() {
  console.log('Hiding login modal');
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Show user info
function showUserInfo(username) {
  document.getElementById('username-display').textContent = username;
  document.getElementById('user-info').classList.remove('hidden');
}

function setAuthMode(mode) {
  authMode = mode;
  const modeInput = document.getElementById('auth-mode');
  const subtitle = document.getElementById('auth-modal-subtitle');
  const submitButton = document.getElementById('auth-submit-btn');
  const toggleMessage = document.getElementById('auth-toggle-message');
  const toggleButton = document.getElementById('auth-toggle-button');
  const usernameInput = document.getElementById('auth-username');
  const passwordInput = document.getElementById('auth-password');
  const errorElement = document.getElementById('auth-error');

  if (!modeInput || !subtitle || !submitButton || !toggleMessage || !toggleButton || !usernameInput || !passwordInput) {
    return;
  }

  modeInput.value = mode;
  errorElement?.classList.add('hidden');

  if (mode === 'login') {
    subtitle.textContent = 'Log in to your account';
    submitButton.textContent = 'Log In';
    toggleMessage.textContent = 'Need an account?';
    toggleButton.textContent = 'Create one';
    usernameInput.placeholder = 'Enter your username';
    passwordInput.placeholder = 'Enter your password';
    passwordInput.setAttribute('minlength', '1');
  } else {
    subtitle.textContent = 'Create a new account';
    submitButton.textContent = 'Create Account';
    toggleMessage.textContent = 'Already have an account?';
    toggleButton.textContent = 'Log in';
    usernameInput.placeholder = 'Choose a username';
    passwordInput.placeholder = 'Choose a password (min 6 characters)';
    passwordInput.setAttribute('minlength', '6');
  }
}

function toggleAuthMode() {
  setAuthMode(authMode === 'login' ? 'register' : 'login');
}

// Handle authentication (login or register)
async function handleAuth(event) {
  event.preventDefault();

  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const action = document.getElementById('auth-mode').value || 'login';

  const errorElement = document.getElementById('auth-error');
  errorElement.classList.add('hidden');

  try {
    const response = await fetch(`${API_BASE}/auth/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (data.success) {
      hideLoginModal();
      await checkAuthStatus();
    } else {
      errorElement.textContent = data.message || `${action === 'login' ? 'Login' : 'Registration'} failed`;
      errorElement.classList.remove('hidden');
    }
  } catch (error) {
    console.error(`${action} error:`, error);
    errorElement.textContent = `Failed to ${action}. Please try again.`;
    errorElement.classList.remove('hidden');
  }
}

async function handleGuestLogin(silent = false) {
  const errorElement = document.getElementById('auth-error');
  if (!silent) {
    errorElement?.classList.add('hidden');
  }
  
  try {
    const response = await fetch(`${API_BASE}/auth/guest`, { method: 'POST' });
    const data = await response.json();
    
    if (data.success) {
      if (!silent) hideLoginModal();
      await checkAuthStatus();
    } else {
      if (!silent) {
        if (errorElement) errorElement.textContent = data.message || 'Guest login failed';
        errorElement?.classList.remove('hidden');
      }
    }
  } catch (error) {
    console.error('Guest login error:', error);
    if (!silent) {
      if (errorElement) errorElement.textContent = 'Network error. Please try again.';
      errorElement?.classList.remove('hidden');
    }
  }
}

// Settings functions
function goToSimilarRecommendations() {
  switchTab('similar');
  getSimilarRecommendations();
}

function dataSourceSummaryText() {
  if (dataSourcePreference === 'booklore') {
    return 'Currently using BookLore data for recommendations.';
  }
  if (dataSourcePreference === 'goodreads') {
    return 'Currently using Goodreads data for recommendations.';
  }
  if (dataSourcePreference === 'hardcover') {
    return 'Currently using Hardcover data for recommendations.';
  }
  if (hasBookLore) { // Auto mode
    return 'Using Hardcover data when available, otherwise falling back to Goodreads or BookLore.';
  }
  if (hasGoodreads) {
    return 'Using your Goodreads import for recommendations.';
  }
  if (hasHardcover) {
    return 'Using your Hardcover reading history for recommendations.';
  }
  return 'Connect BookLore or upload Goodreads data to begin.';
}

function updateDataSourceToggle() {
  const section = document.getElementById('data-source-section');
  const summary = document.getElementById('data-source-summary');

  if (!section) {
    return;
  }

  if (!canToggleDataSource) {
    section.classList.add('hidden');
    if (summary) {
      summary.textContent = dataSourceSummaryText();
    }
    return;
  }

  section.classList.remove('hidden');
  if (summary) {
    summary.textContent = dataSourceSummaryText();
  }

  document.querySelectorAll('.toggle-option').forEach((button) => {
    const source = button.dataset.source;
    if (!source) {
      return;
    }
    button.classList.toggle(
      'active',
      source === dataSourcePreference
    );
  });
}

async function setDataSourcePreference(preference) {
  if (preference === dataSourcePreference) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/settings/data-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preference }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showNotification(data.message || 'Failed to update data source', 'error');
      return;
    }

    showNotification(data.message || 'Data source updated', 'success');
    await checkAuthStatus();
  } catch (error) {
    console.error('Error updating data source preference:', error);
    showNotification('Failed to update data source preference. Please try again.', 'error');
  }
}

async function loadAdminUsers() {
  if (!isAdmin) {
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/admin/users`);
    const data = await response.json();
    adminUsers = data.users || [];
    renderAdminUsers();
  } catch (error) {
    console.error('Error loading users:', error);
    showNotification('Failed to load user list', 'error');
  }
}

function renderAdminUsers() {
  const section = document.getElementById('admin-section');
  const list = document.getElementById('admin-users-list');

  if (!section || !list) {
    return;
  }

  if (!isAdmin) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');

  if (!adminUsers || adminUsers.length === 0) {
    list.innerHTML = '<p class="settings-description">No users found.</p>';
    return;
  }

  const rows = adminUsers
    .map(
      (user) => `
        <tr>
          <td>${user.username}${user.isAdmin ? ' <span class="badge">Admin</span>' : ''}</td>
          <td>${new Date(user.createdAt).toLocaleDateString()}</td>
          <td>${user.hasBookLore ? '✔︎' : '—'}</td>
          <td>${user.hasGoodreads ? '✔︎' : '—'}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="promptPasswordReset(${user.id})">Change Password</button>
            <button class="btn btn-sm btn-secondary" onclick="toggleAdmin(${user.id}, ${user.isAdmin})">
              ${user.isAdmin ? 'Remove Admin' : 'Make Admin'}
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteUserAccount(${user.id})">Delete</button>
          </td>
        </tr>
      `
    )
    .join('');

  list.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Joined</th>
          <th>BookLore</th>
          <th>Goodreads</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

async function deleteUserAccount(userId) {
  if (!confirm('Delete this user? This action cannot be undone.')) {
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      showNotification(data.message || 'Failed to delete user', 'error');
      return;
    }
    showNotification('User deleted', 'success');
    await loadAdminUsers();
  } catch (error) {
    console.error('Error deleting user:', error);
    showNotification('Failed to delete user', 'error');
  }
}

function promptPasswordReset(userId) {
  const newPassword = prompt('Enter a new password for this user (min 6 characters):');
  if (!newPassword) {
    return;
  }
  if (newPassword.length < 6) {
    showNotification('Password must be at least 6 characters.', 'error');
    return;
  }
  updateUserPassword(userId, newPassword);
}

async function updateUserPassword(userId, password) {
  try {
    const response = await fetch(`${API_BASE}/admin/users/${userId}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      showNotification(data.message || 'Failed to update password', 'error');
      return;
    }
    showNotification('Password updated', 'success');
  } catch (error) {
    console.error('Error updating password:', error);
    showNotification('Failed to update password', 'error');
  }
}

async function toggleAdmin(userId, currentStatus) {
  if (
    !confirm(
      currentStatus
        ? 'Remove admin privileges from this user?'
        : 'Grant admin privileges to this user?'
    )
  ) {
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/admin/users/${userId}/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin: !currentStatus }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      showNotification(data.message || 'Failed to update role', 'error');
      return;
    }
    showNotification('Role updated', 'success');
    await loadAdminUsers();
  } catch (error) {
    console.error('Error updating role:', error);
    showNotification('Failed to update role', 'error');
  }
}

async function saveBookLoreCredentials(event) {
  event.preventDefault();

  const username = document.getElementById('booklore-username').value.trim();
  const password = document.getElementById('booklore-password').value;

  if (!username || !password) {
    showNotification('Please enter both username and password', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/settings/booklore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (data.success) {
      showNotification('BookLore credentials saved successfully!', 'success');
      // Clear the form
      document.getElementById('booklore-form').reset();
      // Refresh auth status to update UI
      await checkAuthStatus();
    } else {
      showNotification(data.message || 'Failed to save credentials', 'error');
    }
  } catch (error) {
    console.error('Error saving BookLore credentials:', error);
    showNotification('Failed to save credentials. Please try again.', 'error');
  }
}

async function removeBookLoreCredentials() {
  if (!confirm('Remove BookLore connection? This will not delete your reading history.')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/settings/booklore`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (data.success) {
      showNotification('BookLore connection removed', 'success');
      await checkAuthStatus();
    } else {
      showNotification(data.message || 'Failed to remove connection', 'error');
    }
  } catch (error) {
    console.error('Error removing BookLore credentials:', error);
    showNotification('Failed to remove connection. Please try again.', 'error');
  }
}

async function saveHardcoverCredentials(event) {
  event.preventDefault();

  const apiKey = document.getElementById('hardcover-api-key').value.trim();

  if (!apiKey) {
    showNotification('Please enter an API Key', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/settings/hardcover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });

    const data = await response.json();

    if (data.success) {
      showNotification('Hardcover API Key saved successfully!', 'success');
      // Clear the form
      document.getElementById('hardcover-form').reset();
      // Refresh auth status to update UI
      await checkAuthStatus();
    } else {
      showNotification(data.message || 'Failed to save API Key', 'error');
    }
  } catch (error) {
    console.error('Error saving Hardcover credentials:', error);
    showNotification('Failed to save API Key. Please try again.', 'error');
  }
}

async function removeHardcoverCredentials() {
  if (!confirm('Remove Hardcover connection? This will not delete your reading history.')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/settings/hardcover`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (data.success) {
      showNotification('Hardcover connection removed', 'success');
      await checkAuthStatus();
    } else {
      showNotification(data.message || 'Failed to remove connection', 'error');
    }
  } catch (error) {
    console.error('Error removing Hardcover credentials:', error);
    showNotification('Failed to remove connection. Please try again.', 'error');
  }
}

async function uploadGoodreadsCSV() {
  const fileInput = document.getElementById('settings-csv-input');
  const file = fileInput.files[0];
  const errorElement = document.getElementById('settings-csv-error');
  const successElement = document.getElementById('settings-csv-success');

  errorElement.classList.add('hidden');
  successElement.classList.add('hidden');

  if (!file) {
    errorElement.textContent = 'Please select a CSV file';
    errorElement.classList.remove('hidden');
    return;
  }

  try {
    const csvContent = await file.text();

    const response = await fetch(`${API_BASE}/settings/goodreads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvContent }),
    });

    const data = await response.json();

    if (data.success) {
      successElement.textContent = data.message;
      successElement.classList.remove('hidden');
      fileInput.value = ''; // Clear the file input
      // Refresh auth status to update UI
      await checkAuthStatus();
    } else {
      errorElement.textContent = data.message || 'Failed to upload CSV';
      errorElement.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error uploading CSV:', error);
    errorElement.textContent = 'Failed to upload CSV. Please try again.';
    errorElement.classList.remove('hidden');
  }
}

async function removeGoodreadsData() {
  if (!confirm('Remove Goodreads data? You can upload it again later.')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/settings/goodreads`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (data.success) {
      showNotification('Goodreads data removed', 'success');
      await checkAuthStatus();
    } else {
      showNotification(data.message || 'Failed to remove data', 'error');
    }
  } catch (error) {
    console.error('Error removing Goodreads data:', error);
    showNotification('Failed to remove data. Please try again.', 'error');
  }
}

// Logout
async function handleLogout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    isAuthenticated = false;
    hasReadingHistory = false;
    hasBookLore = false;
    hasHardcover = false;
    hasGoodreads = false;
    clearAppState();
    showLoginModal();
    document.getElementById('user-info').classList.add('hidden');
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Tab switching
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

  // Update tab panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  document.getElementById(`${tabName}-tab`)?.classList.add('active');

  if (tabName === 'tbr') {
    loadTBR(true, false);
  }
}

// Loading state
function showLoading(message = 'Loading recommendations...', targetResultsId) {
  const loadingElement = document.getElementById('loading');
  loadingElement.querySelector('p').textContent = message;

  if (targetResultsId) {
    const targetElement = document.getElementById(targetResultsId);
    if (targetElement && targetElement.parentElement) {
      targetElement.parentElement.insertBefore(loadingElement, targetElement);
    }
  }

  loadingElement.classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatReasoning(reasoning = '') {
  return escapeHtml(reasoning).replace(/\n/g, '<br>');
}

function escapeForOnclick(str = '') {
  return String(str)
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/'/g, "\\'")   // Escape single quotes for JS string
    .replace(/"/g, '&quot;');// Escape double quotes for HTML attribute
}

function buildRecommendationActions(rec) {
  const titleData = encodeURIComponent(rec.title || '');
  const authorData = encodeURIComponent(rec.author || 'Unknown');
  const reasoningData = encodeURIComponent(rec.reasoning || '');
  const amazonData = rec.amazonUrl ? encodeURIComponent(rec.amazonUrl) : '';
  const coverData = rec.coverUrl ? encodeURIComponent(rec.coverUrl) : '';

  // Use escapeForOnclick for the inline JS arguments
  const jsTitle = escapeForOnclick(rec.title || '');
  const jsAuthor = escapeForOnclick(rec.author || '');
  const jsAmazon = escapeForOnclick(rec.amazonUrl || '');

  const inTBR = isInTBR(rec);
  
  let tbrButtonHtml;
  
  if (inTBR) {
    // Find the book ID from cache if possible, though removeFromTBR usually needs ID
    // Since we store title/author in TBR, we might need to look it up or pass title/author to remove
    // For now, let's assume we can find it or use a different removal strategy.
    // Actually, removeFromTBR takes an ID. Let's find the ID from the cache.
    const tbrBook = tbrCache.find(b => b.title === rec.title && b.author === rec.author);
    const bookId = tbrBook ? tbrBook.id : '';
    
    tbrButtonHtml = `
      <button
        class="btn btn-sm btn-danger"
        onclick="removeFromTBR(${bookId}, this)"
      >
        Remove from TBR
      </button>
    `;
  } else {
    tbrButtonHtml = `
      <button
        class="btn btn-sm btn-secondary"
        data-title="${titleData}"
        data-author="${authorData}"
        data-reasoning="${reasoningData}"
        data-amazon-url="${amazonData}"
        data-cover-url="${coverData}"
        onclick="addRecommendationToTBR(this)"
      >
        Add to TBR
      </button>
    `;
  }

  return `
    <div class="recommendation-actions">
      <button
        class="btn btn-sm btn-primary"
        onclick="fetchBookDetails('${jsTitle}', '${jsAuthor}', '${jsAmazon}', this)"
      >
        View Details
      </button>
      ${tbrButtonHtml}
      <button
        class="btn btn-sm btn-ghost"
        title="Not Interested"
        data-title="${titleData}"
        data-author="${authorData}"
        onclick="addToExclusionList(this)"
      >
        Not Interested
      </button>
    </div>
  `;
}

function renderRecommendationMarkup(rec, index, prefix = '') {
  const safeTitle = escapeHtml(rec.title || 'Untitled');
  const safeAuthor = escapeHtml(rec.author || 'Unknown');
  const safeReasoning = formatReasoning(rec.reasoning || '');
  const imgId = prefix ? `${prefix}-cover-${index}` : `cover-${index}`;

  return `
    <li class="recommendation-item">
      <div class="recommendation-layout">
          <div class="recommendation-cover-container">
            <img id="${imgId}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" 
              data-title="${safeTitle}" 
              data-author="${safeAuthor}" 
              alt="Cover of ${safeTitle}" 
              class="recommendation-cover loading" 
              loading="lazy">
          </div>
        <div class="recommendation-content">
          <div class="recommendation-title">
            <span class="recommendation-index">${index + 1}.</span>
            <div>
              <h3>${safeTitle}</h3>
              <span class="author">by ${safeAuthor}</span>
            </div>
          </div>
          <p class="reasoning">${safeReasoning}</p>
          ${buildRecommendationActions(rec)}
        </div>
      </div>
    </li>
  `;
}

function addRecommendationToTBR(button) {
  const book = {
    title: decodeURIComponent(button.dataset.title || ''),
    author: decodeURIComponent(button.dataset.author || ''),
    reasoning: decodeURIComponent(button.dataset.reasoning || ''),
    amazonUrl: button.dataset.amazonUrl ? decodeURIComponent(button.dataset.amazonUrl) : undefined,
    coverUrl: button.dataset.coverUrl ? decodeURIComponent(button.dataset.coverUrl) : undefined,
  };
  addToTBR(book, button);
}

async function addToExclusionList(button) {
  if (!confirm('Mark this book as "Not Interested"? It won\'t be recommended again.')) {
    return;
  }

  const book = {
    title: decodeURIComponent(button.dataset.title || ''),
    author: decodeURIComponent(button.dataset.author || ''),
  };

  try {
    const response = await fetch(`${API_BASE}/exclusion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book }),
    });

    const data = await response.json();

    if (data.success) {
      showNotification('Book marked as not interested', 'success');
      // Remove the card from the UI
      const card = button.closest('.recommendation-item');
      if (card) {
        card.remove();
      }
    } else {
      showNotification(data.message || 'Failed to exclude book', 'error');
    }
  } catch (error) {
    console.error('Error excluding book:', error);
    showNotification('Failed to exclude book', 'error');
  }
}

async function loadExclusionList() {
  const listElement = document.getElementById('exclusion-list');
  if (!listElement) return;

  try {
    const response = await fetch(`${API_BASE}/exclusion`);
    const data = await response.json();
    
    if (data.list && data.list.length > 0) {
      renderExclusionList(data.list);
    } else {
      listElement.innerHTML = '<p class="settings-description">No excluded books.</p>';
    }
  } catch (error) {
    console.error('Error loading exclusion list:', error);
    listElement.innerHTML = '<p class="error-message">Failed to load exclusion list.</p>';
  }
}

function renderExclusionList(list) {
  const listElement = document.getElementById('exclusion-list');
  if (!listElement) return;

  const html = list.map(book => `
    <div class="exclusion-item">
      <div class="exclusion-info">
        <span class="exclusion-title">${escapeHtml(book.title)}</span>
        <span class="exclusion-author">by ${escapeHtml(book.author)}</span>
      </div>
      <button class="btn btn-sm btn-secondary" onclick="removeFromExclusionList('${book.id}')">
        Remove
      </button>
    </div>
  `).join('');

  listElement.innerHTML = html;
}

async function removeFromExclusionList(bookId) {
  try {
    const response = await fetch(`${API_BASE}/exclusion/${bookId}`, {
      method: 'DELETE',
    });
    const data = await response.json();

    if (data.success) {
      showNotification('Book removed from exclusion list', 'success');
      await loadExclusionList();
    } else {
      showNotification(data.message || 'Failed to remove book', 'error');
    }
  } catch (error) {
    console.error('Error removing book:', error);
    showNotification('Failed to remove book', 'error');
  }
}

function toggleExclusionSection() {
  const content = document.getElementById('exclusion-content');
  const icon = document.querySelector('.toggle-icon-exclusion svg');
  if (content) {
    content.classList.toggle('hidden');
    if (icon) {
      icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    }
  }
}

// Error handling
function showError(message) {
  const errorElement = document.getElementById('error');
  errorElement.textContent = message;
  errorElement.classList.remove('hidden');
  setTimeout(() => {
    errorElement.classList.add('hidden');
  }, 5000);
}

function showNotification(message, type = 'success') {
  const notificationElement = document.getElementById('notification');
  notificationElement.textContent = message;
  notificationElement.classList.remove('hidden');
  notificationElement.classList.remove('success', 'error');
  notificationElement.classList.add(type);

  clearTimeout(notificationTimeout);
  notificationTimeout = setTimeout(() => {
    notificationElement.classList.add('hidden');
  }, 4000);
}

// SSE Progress functions
function showProgressBar(targetElementId, initialMessage = 'Initializing...') {
  const targetElement = document.getElementById(targetElementId);
  if (!targetElement) return;

  const progressHtml = `
    <div class="progress-container" id="progress-container">
      <div class="progress-text">
        <span class="progress-message" id="progress-message">${initialMessage}</span>
        <span class="progress-percent" id="progress-percent">0%</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" id="progress-bar-fill" style="width: 0%"></div>
      </div>
    </div>
  `;

  targetElement.innerHTML = progressHtml;
}

function updateProgress(percent, message) {
  const fillElement = document.getElementById('progress-bar-fill');
  const messageElement = document.getElementById('progress-message');
  const percentElement = document.getElementById('progress-percent');

  if (fillElement) {
    fillElement.style.width = `${percent}%`;
  }
  if (messageElement) {
    messageElement.textContent = message;
  }
  if (percentElement) {
    percentElement.textContent = `${percent}%`;
  }
}

function hideProgress() {
  const progressContainer = document.getElementById('progress-container');
  if (progressContainer) {
    progressContainer.remove();
  }
}

/**
 * Fetch recommendations using Server-Sent Events for progress tracking
 * @param {string} endpoint - SSE endpoint URL
 * @param {string} targetElementId - Element to display results
 * @param {function} displayCallback - Function to display the final results
 */
function fetchRecommendationsWithSSE(endpoint, targetElementId, displayCallback) {
  return new Promise((resolve, reject) => {
    showProgressBar(targetElementId, 'Connecting...');

    const eventSource = new EventSource(endpoint, { withCredentials: true });
    let isComplete = false;
    let hasReceivedData = false;
    let currentPercent = 0;
    let currentStage = '';
    let rotatingMessageInterval = null;
    let fakeProgressInterval = null;
    
    // Rotating messages for when stuck on "analyzing" stage
    const analyzingMessages = [
      'AI is analyzing your reading patterns...',
      'Finding books that match your taste...',
      'Considering themes and writing styles...',
      'Searching through millions of books...',
      'Identifying perfect matches...',
      'Almost there, generating personalized picks...',
    ];
    let messageIndex = 0;

    // Start rotating messages if stuck at analyzing stage
    function startRotatingMessages() {
      if (rotatingMessageInterval) return;
      
      rotatingMessageInterval = setInterval(() => {
        if (currentStage === 'analyzing' && currentPercent >= 60 && currentPercent < 90) {
          messageIndex = (messageIndex + 1) % analyzingMessages.length;
          updateProgress(currentPercent, analyzingMessages[messageIndex]);
        }
      }, 4000); // Rotate every 4 seconds
    }

    // Start fake micro-progress for analyzing stage
    function startFakeMicroProgress() {
      if (fakeProgressInterval) return;
      
      let fakePercent = currentPercent;
      const targetPercent = 85; // Don't go beyond 85%
      
      fakeProgressInterval = setInterval(() => {
        if (currentStage === 'analyzing' && fakePercent < targetPercent) {
          // Logarithmic slowdown: faster at first, slower as we approach target
          const remaining = targetPercent - fakePercent;
          const increment = Math.max(0.5, remaining * 0.08);
          
          fakePercent = Math.min(targetPercent, fakePercent + increment);
          currentPercent = Math.floor(fakePercent);
          
          // Update with current rotating message
          const currentMessage = analyzingMessages[messageIndex % analyzingMessages.length];
          updateProgress(currentPercent, currentMessage);
        } else if (currentStage !== 'analyzing') {
          // Stop fake progress if we've moved to a different stage
          clearInterval(fakeProgressInterval);
          fakeProgressInterval = null;
        }
      }, 2500); // Update every 2.5 seconds
    }

    // Cleanup intervals
    function cleanup() {
      if (rotatingMessageInterval) {
        clearInterval(rotatingMessageInterval);
        rotatingMessageInterval = null;
      }
      if (fakeProgressInterval) {
        clearInterval(fakeProgressInterval);
        fakeProgressInterval = null;
      }
    }

    eventSource.addEventListener('progress', (event) => {
      hasReceivedData = true;
      try {
        const data = JSON.parse(event.data);
        currentPercent = data.percent;
        currentStage = data.stage;
        
        updateProgress(data.percent, data.message);
        
        // Start enhancements when we hit the analyzing stage
        if (data.stage === 'analyzing' && data.percent >= 60) {
          startRotatingMessages();
          startFakeMicroProgress();
        }
      } catch (error) {
        console.error('Error parsing progress event:', error);
      }
    });

    eventSource.addEventListener('complete', (event) => {
      isComplete = true;
      hasReceivedData = true;
      cleanup();
      
      try {
        const data = JSON.parse(event.data);
        
        // Jump to 100% before completing
        updateProgress(100, 'Complete!');
        
        setTimeout(() => {
          hideProgress();
          displayCallback(data);
          eventSource.close();
          resolve(data);
        }, 300);
      } catch (error) {
        console.error('Error parsing complete event:', error);
        hideProgress();
        showError('Failed to process recommendations');
        eventSource.close();
        reject(error);
      }
    });

    eventSource.addEventListener('server_error', (event) => {
      isComplete = true;
      hasReceivedData = true; // Received a structured error, so connection worked
      cleanup();
      hideProgress();
      
      let errorMessage = 'An error occurred';
      try {
        const data = JSON.parse(event.data);
        errorMessage = data.error || errorMessage;
        showError(errorMessage);
      } catch (error) {
        console.error('Error parsing server_error event:', error);
        showError(errorMessage);
      }
      
      eventSource.close();
      reject(new Error(errorMessage));
    });

    eventSource.addEventListener('error', (event) => {
      if (isComplete) return;
      
      console.error('SSE error:', event);
      cleanup();
      hideProgress();
      
      if (!hasReceivedData) {
        // Connection failed, show error
        showError('Failed to connect. Please try again.');
      } else {
        showError('Connection interrupted. Please try again.');
      }
      
      eventSource.close();
      reject(new Error('SSE connection error'));
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      if (eventSource.readyState !== EventSource.CLOSED) {
        cleanup();
        eventSource.close();
        hideProgress();
        showError('Request timed out. Please try again.');
        reject(new Error('Timeout'));
      }
    }, 60000);
  });
}

// Recommendation functions
async function getSimilarRecommendations() {
  try {
    await fetchRecommendationsWithSSE(
      `${API_BASE}/recommendations/similar/stream`,
      'similar-results',
      (data) => {
        if (data.recommendations) {
          displayRecommendations(data.recommendations, 'similar-results');
        } else {
          showError('Failed to get recommendations');
        }
      }
    );
  } catch (error) {
    console.error('Error getting recommendations:', error);
    // Error already shown by fetchRecommendationsWithSSE
  }
}

async function getContrastingRecommendations() {
  try {
    await fetchRecommendationsWithSSE(
      `${API_BASE}/recommendations/contrasting/stream`,
      'contrasting-results',
      (data) => {
        if (data.recommendations) {
          displayRecommendations(data.recommendations, 'contrasting-results');
        } else {
          showError('Failed to get recommendations');
        }
      }
    );
  } catch (error) {
    console.error('Error getting recommendations:', error);
    // Error already shown by fetchRecommendationsWithSSE
  }
}

async function getBlindspots() {
  try {
    await fetchRecommendationsWithSSE(
      `${API_BASE}/recommendations/blindspots/stream`,
      'blindspots-results',
      (data) => {
        if (data.analysis) {
          displayBlindSpotsAnalysis(data.analysis, 'blindspots-results');
        } else {
          showError('Failed to get analysis');
        }
      }
    );
  } catch (error) {
    console.error('Error getting analysis:', error);
    // Error already shown by fetchRecommendationsWithSSE
  }
}

async function getCustomRecommendations() {
  const criteria = document.getElementById('custom-criteria').value.trim();

  if (!criteria) {
    showError('Please enter your criteria');
    return;
  }

  try {
    const encodedCriteria = encodeURIComponent(criteria);
    await fetchRecommendationsWithSSE(
      `${API_BASE}/recommendations/custom/stream?criteria=${encodedCriteria}`,
      'custom-results',
      (data) => {
        if (data.recommendations) {
          displayRecommendations(data.recommendations, 'custom-results');
        } else {
          showError('Failed to get recommendations');
        }
      }
    );
  } catch (error) {
    console.error('Error getting recommendations:', error);
    // Error already shown by fetchRecommendationsWithSSE
  }
}

async function getStats() {
  showLoading('Loading statistics...', 'stats-results');
  try {
    const response = await fetch(`${API_BASE}/stats`);
    const stats = await response.json();
    hideLoading();

    displayStats(stats, 'stats-results');
  } catch (error) {
    hideLoading();
    console.error('Error getting stats:', error);
    showError('Failed to load statistics. Please try again.');
  }
}

// Display functions
function displayRecommendations(recommendations, elementId) {
  const resultsElement = document.getElementById(elementId);

  if (recommendations.length === 0) {
    resultsElement.innerHTML = '<p class="no-results">No recommendations found.</p>';
    return;
  }

  const filtered = recommendations.filter((rec) => !isInTBR(rec));

  if (filtered.length === 0) {
    resultsElement.innerHTML =
      '<p class="no-results">All recommended books are already in your TBR list.</p>';
    return;
  }

  let html = '<ol class="recommendations-list">';
  filtered.forEach((rec, index) => {
    // Use elementId as prefix to ensure unique IDs across tabs
    html += renderRecommendationMarkup(rec, index, elementId);
  });
  html += '</ol>';
  resultsElement.innerHTML = html;
  
  // Lazy load covers
  filtered.forEach((rec, index) => {
    fetchCoverImage(rec.title, rec.author, `${elementId}-cover-${index}`);
  });
}

async function fetchCoverImage(title, author, imgId) {
  try {
    const response = await fetch(`${API_BASE}/books/details?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`);
    const data = await response.json();
    if (data.success && data.details && data.details.images && data.details.images.length > 0) {
      const img = document.getElementById(imgId);
      if (img) {
        img.src = data.details.images[0].url;
        img.classList.remove('loading');
        
        // Update the "Add to TBR" button's data-cover-url
        const btn = img.closest('.recommendation-layout').querySelector('button[data-cover-url]');
        if (btn) {
            btn.dataset.coverUrl = data.details.images[0].url;
        }
      }
    }
  } catch (e) {
    console.error('Failed to load cover', e);
  }
}

function displayBlindSpotsAnalysis(analysis, elementId) {
  const resultsElement = document.getElementById(elementId);
  const coversToLoad = [];

  let html = '<div class="analysis-container">';

  // Patterns
  html += '<div class="analysis-section"><h3>Reading Patterns</h3><div class="patterns-grid">';
  analysis.patterns.forEach(pattern => {
    html += `<div class="pattern-tag">${pattern}</div>`;
  });
  html += '</div></div>';

  // Blind Spots
  html += '<div class="analysis-section"><h3>Blind Spots & Recommendations</h3><div class="blind-spots-grid">';
  analysis.blindSpots.forEach((blindSpot, index) => {
    html += `
      <div class="blind-spot-card">
        <div class="blind-spot-header">
            <div class="blind-spot-number">${String(index + 1).padStart(2, '0')}</div>
            <div class="blind-spot-info">
                <h4>${blindSpot.category}</h4>
                <p>${blindSpot.description}</p>
            </div>
        </div>
        <div class="blind-spot-recommendations">
          <h5>Recommended to bridge this gap:</h5>
    `;

    html += '<ol class="recommendations-list nested">';
    blindSpot.recommendations.forEach((rec, recIndex) => {
      const prefix = `blindspots-${index}`;
      html += renderRecommendationMarkup(rec, recIndex, prefix);
      coversToLoad.push({
        title: rec.title,
        author: rec.author,
        id: `${prefix}-cover-${recIndex}`
      });
    });
    html += '</ol>';

    html += '</div></div>';
  });
  html += '</div></div>';

  // Suggested Topics
  html += '<div class="analysis-section"><h3>Suggested Topics to Explore</h3><div class="topics-grid">';
  analysis.suggestedTopics.forEach(topic => {
    html += `<div class="topic-tag">${topic}</div>`;
  });
  html += '</div></div>';

  html += '</div>';
  resultsElement.innerHTML = html;

  // Lazy load covers
  coversToLoad.forEach(item => {
    fetchCoverImage(item.title, item.author, item.id);
  });
}

function displayStats(stats, elementId) {
  const resultsElement = document.getElementById(elementId);
  resultsElement.innerHTML = ''; // Clear previous content

  const container = document.createElement('div');
  container.className = 'stats-container';

  // Source Indicator
  const sourceDiv = document.createElement('div');
  sourceDiv.className = 'stats-source';
  sourceDiv.innerHTML = `Data source: <strong>${stats.source === 'booklore' ? 'BookLore' : 'Goodreads'}</strong>`;
  container.appendChild(sourceDiv);

  // Render Reader Profile
  const profileContainer = document.getElementById('reader-profile');
  if (stats.readerProfile) {
    profileContainer.innerHTML = `
      <div class="profile-card">
        <div class="profile-header">
          <div class="profile-icon">
            <span class="profile-icon-emoji">📚</span>
          </div>
          <div class="profile-title-group">
            <p class="profile-label">Your Reader Persona</p>
            <h3 class="profile-title">${stats.readerProfile.title}</h3>
          </div>
          <span class="profile-chip">AI insight</span>
        </div>
        <div class="profile-body">
          <p class="profile-summary">${stats.readerProfile.summary}</p>
          <div class="profile-fun-fact">
            <div class="profile-fun-icon">💡</div>
            <div>
              <p class="profile-fun-label">Signature quirk</p>
              <p class="profile-fun-text">${stats.readerProfile.funFact}</p>
            </div>
          </div>
        </div>
      </div>
    `;
    profileContainer.classList.remove('hidden');
  } else {
    profileContainer.classList.add('hidden');
  }

  // Summary Cards
  const grid = document.createElement('div');
  grid.className = 'stats-grid';
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${stats.totalBooksRead}</div>
      <div class="stat-label">Books Read</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.booksRated}</div>
      <div class="stat-label">Books Rated</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.averageRating.toFixed(1)}/10</div>
      <div class="stat-label">Average Rating</div>
    </div>
  `;
  container.appendChild(grid);

  // Charts Container
  const chartsContainer = document.createElement('div');
  chartsContainer.className = 'charts-wrapper';

  // Top Genres Chart
  if (stats.topGenres && stats.topGenres.length > 0) {
    const genreSection = document.createElement('div');
    genreSection.className = 'chart-section';
    genreSection.innerHTML = '<h3>Top Genres</h3><div id="genre-chart"></div>';
    chartsContainer.appendChild(genreSection);
  }

  // Top Authors Chart
  if (stats.topAuthors && stats.topAuthors.length > 0) {
    const authorSection = document.createElement('div');
    authorSection.className = 'chart-section';
    authorSection.innerHTML = '<h3>Top Authors</h3><div id="author-chart"></div>';
    chartsContainer.appendChild(authorSection);
  }

  container.appendChild(chartsContainer);
  resultsElement.appendChild(container);

  // Render D3 Charts
  if (stats.topGenres && stats.topGenres.length > 0) {
    renderBarChart(stats.topGenres, '#genre-chart', 'Genres');
  }
  if (stats.topAuthors && stats.topAuthors.length > 0) {
    renderBarChart(stats.topAuthors, '#author-chart', 'Authors');
  }
}

function renderBarChart(data, selector, label) {
  // Set dimensions - use container width for responsiveness
  const margin = { top: 20, right: 60, bottom: 40, left: 120 }; // Increased right margin for labels
  const container = document.querySelector(selector);
  const containerWidth = container.clientWidth;
  const width = containerWidth - margin.left - margin.right;
  const height = 300 - margin.top - margin.bottom;
  const { axisText, axisLine } = getChartColors();

  // Append SVG
  const svg = d3.select(selector)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // X axis - add 10% padding to prevent cutoff
  const maxValue = d3.max(data, d => d.count);
  const x = d3.scaleLinear()
    .domain([0, maxValue * 1.1]) // Add 10% padding
    .range([0, width]);
  
  const xAxis = svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5));

  xAxis.selectAll("path")
    .attr("stroke", axisLine);

  xAxis.selectAll("line")
    .attr("stroke", axisLine);

  xAxis.selectAll("text")
    .attr("transform", "translate(-10,0)rotate(-45)")
    .style("text-anchor", "end")
    .style("fill", axisText);

  // Y axis
  const y = d3.scaleBand()
    .range([0, height])
    .domain(data.map(d => d.name))
    .padding(0.2);
  
  const yAxis = svg.append("g")
    .call(d3.axisLeft(y));

  yAxis.selectAll("path")
    .attr("stroke", axisLine);

  yAxis.selectAll("line")
    .attr("stroke", axisLine);

  yAxis.selectAll("text")
    .style("font-size", "12px")
    .style("fill", axisText);

  // Bars
  svg.selectAll("myRect")
    .data(data)
    .join("rect")
    .attr("x", x(0))
    .attr("y", d => y(d.name))
    .attr("width", d => x(d.count))
    .attr("height", y.bandwidth())
    .attr("fill", "url(#bar-gradient)")
    .style("rx", 4); // Rounded corners

  // Gradient definition
  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient")
    .attr("id", "bar-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  gradient.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", "var(--accent)");

  gradient.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "var(--accent-strong)");

  // Labels on bars
  svg.selectAll("myLabel")
    .data(data)
    .join("text")
    .attr("x", d => x(d.count) + 5)
    .attr("y", d => y(d.name) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .text(d => d.count)
    .style("fill", axisText)
    .style("font-size", "12px");
}

// TBR functions
async function loadTBR(showLoader = true, refreshHero = true) {
  if (showLoader) {
    showLoading('Loading your TBR list...', 'tbr-results');
  }
  try {
    const response = await fetch(`${API_BASE}/tbr`);
    const data = await response.json();
    if (showLoader) {
      hideLoading();
    }

    if (data.tbr) {
      hasLoadedTBR = true;
      tbrCache = data.tbr;
      displayTBR(data.tbr, 'tbr-results');
      if (refreshHero) {
        updateHeroPreviewCard();
      }
    } else {
      tbrCache = [];
      if (refreshHero) {
        updateHeroPreviewCard();
      }
      if (showLoader) {
        showError('Failed to load TBR list');
      }
    }
  } catch (error) {
    hasLoadedTBR = false;
    if (showLoader) {
      hideLoading();
    }
    console.error('Error loading TBR:', error);
    if (showLoader) {
      showError('Failed to load TBR list. Please try again.');
    }
  }
}

async function addToTBR(book, buttonElement) {
  try {
    const response = await fetch(`${API_BASE}/tbr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: book.title,
        author: book.author,
        reasoning: book.reasoning,
        amazonUrl: book.amazonUrl,
        coverUrl: book.coverUrl,
      }),
    });

    const data = await response.json();

    if (data.success) {
      // Update cache
      if (data.book) {
        tbrCache = [data.book, ...tbrCache];
        updateHeroPreviewCard();
      }

      // If called from a button, handle the UI transition
      if (buttonElement) {
        // 1. Success State (Checkmark)
        const originalText = buttonElement.textContent;
        buttonElement.textContent = '✓ Added';
        buttonElement.classList.remove('btn-secondary');
        buttonElement.classList.add('btn-success');
        buttonElement.disabled = true; // Prevent double clicks during transition

        // 2. Transition to Remove State after 1 second
        setTimeout(() => {
          buttonElement.textContent = 'Remove from TBR';
          buttonElement.classList.remove('btn-success');
          buttonElement.classList.add('btn-danger');
          buttonElement.disabled = false;
          
          // Update onclick handler to remove
          // We need the ID of the newly added book
          if (data.book && data.book.id) {
            buttonElement.onclick = (e) => {
              e.preventDefault(); // Prevent any default behavior
              removeFromTBR(data.book.id, buttonElement);
            };
            // Keep data attributes so we can re-add if needed
          }
        }, 1000);
      } else {
        // Fallback for non-button calls (e.g. if we had other ways to add)
        showNotification(`Added "${book.title}" to your TBR list!`, 'success');
      }
      
      // If we are on the TBR tab, reload it
      if (document.querySelector('[data-tab="tbr"]').classList.contains('active')) {
        loadTBR();
      }
    } else {
      showNotification(data.message || 'Failed to add book to TBR', 'error');
    }
  } catch (error) {
    console.error('Error adding to TBR:', error);
    showNotification('Failed to add book to TBR. Please try again.', 'error');
  }
}

async function removeFromTBR(bookId, buttonElement) {
  try {
    const response = await fetch(`${API_BASE}/tbr/${encodeURIComponent(bookId)}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (data.success) {
      // Update cache
      tbrCache = tbrCache.filter(b => b.id !== bookId);
      updateHeroPreviewCard();

      if (buttonElement) {
        // Revert to "Add to TBR" state
        // We need to reconstruct the book object to put back into data attributes or onclick
        // But wait, the button originally had data attributes. 
        // If we stripped them, we might need to put them back or just reload the list.
        // Actually, simpler: if we remove from a recommendation card, we can just reset the button style and text
        // and re-attach the addRecommendationToTBR handler.
        // However, addRecommendationToTBR reads from data attributes.
        // So we should NOT remove data attributes in addToTBR, just ignore them.
        
        buttonElement.textContent = 'Add to TBR';
        buttonElement.classList.remove('btn-danger');
        buttonElement.classList.add('btn-secondary');
        buttonElement.onclick = (e) => {
            e.preventDefault();
            addRecommendationToTBR(buttonElement);
        };
      } else {
        showNotification('Book removed from your TBR list.', 'success');
      }

      // If on TBR tab, reload
      if (document.querySelector('[data-tab="tbr"]').classList.contains('active')) {
        loadTBR();
      }
    } else {
      showNotification(data.message || 'Failed to remove book.', 'error');
    }
  } catch (error) {
    console.error('Error removing from TBR:', error);
    showNotification('Failed to remove book. Please try again.', 'error');
  }
}

async function clearTBR() {
  if (!confirm('Clear your entire TBR list? This cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/tbr`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (data.success) {
      showNotification('Your TBR list has been cleared.', 'success');
      loadTBR();
    } else {
      showNotification(data.message || 'Failed to clear TBR list', 'error');
    }
  } catch (error) {
    console.error('Error clearing TBR:', error);
    showNotification('Failed to clear TBR list. Please try again.', 'error');
  }
}

function displayTBR(books, elementId) {
  const resultsElement = document.getElementById(elementId);

  if (books.length === 0) {
    resultsElement.innerHTML = '<p class="no-results">Your TBR list is empty. Add books from recommendations!</p>';
    return;
  }

  let html = '<ol class="recommendations-list">';
  books.forEach((book, index) => {
    const safeTitle = escapeHtml(book.title || 'Untitled');
    const safeAuthor = escapeHtml(book.author || 'Unknown');
    const safeReasoning = book.reasoning ? formatReasoning(book.reasoning) : '';
    const addedDate = new Date(book.addedAt).toLocaleDateString();
    html += `
      <li class="recommendation-item">
        <div class="recommendation-layout">
          ${book.coverUrl ? `
            <div class="recommendation-cover-container">
              <img src="${escapeHtml(book.coverUrl)}" alt="Cover of ${safeTitle}" class="recommendation-cover" loading="lazy">
            </div>
          ` : ''}
          <div class="recommendation-content">
            <div class="recommendation-title">
              <span class="recommendation-index">${index + 1}.</span>
              <div>
                <h3>${safeTitle}</h3>
                <span class="author">by ${safeAuthor}</span>
              </div>
            </div>
            ${book.reasoning ? `<p class="reasoning">${safeReasoning}</p>` : ''}
            <div class="recommendation-actions">
              <button
                class="btn btn-sm btn-primary"
                onclick="fetchBookDetails('${escapeForOnclick(book.title)}', '${escapeForOnclick(book.author)}', '${escapeForOnclick(book.amazonUrl || '')}', this)"
              >
                View Details
              </button>
              <button class="btn btn-sm btn-secondary" onclick="removeFromTBR('${book.id}')">Remove</button>
            </div>
            <div class="tbr-meta">Added: ${addedDate}</div>
          </div>
        </div>
      </li>
    `;
  });
  html += '</ol>';

  resultsElement.innerHTML = html;
}

function updateHeroPreviewCard() {
  const card = document.getElementById('hero-preview-card');
  const titleEl = document.getElementById('hero-preview-title');
  const authorEl = document.getElementById('hero-preview-author');
  const buttonEl = document.getElementById('hero-preview-button');

  if (!card || !titleEl || !authorEl || !buttonEl) {
    return;
  }

  if (!tbrCache || tbrCache.length === 0) {
    heroPreviewBook = null;
    card.classList.add('hidden');
    titleEl.textContent = 'TBR is empty';
    titleEl.removeAttribute('href');
    authorEl.textContent = '';
    buttonEl.disabled = true;
    return;
  }

  const index = Math.floor(Math.random() * tbrCache.length);
  const topBook = tbrCache[index];
  heroPreviewBook = topBook;
  card.classList.remove('hidden');
  titleEl.textContent = topBook.title || 'Upcoming book';
  if (topBook.amazonUrl) {
    titleEl.setAttribute('href', topBook.amazonUrl);
  } else {
    titleEl.removeAttribute('href');
  }
  authorEl.textContent = topBook.author ? `by ${topBook.author}` : '';
  buttonEl.disabled = false;
}

function openHeroPreviewDetails() {
  const button = document.getElementById('hero-preview-button');
  if (!heroPreviewBook || !button) {
    return;
  }

  fetchBookDetails(
    heroPreviewBook.title || '',
    heroPreviewBook.author || 'Unknown',
    heroPreviewBook.amazonUrl || '',
    button
  );
}

// Theme toggle
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);

  // Update icon
  const icon = document.getElementById('theme-icon');
  icon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

// Initialize theme from localStorage
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  const icon = document.getElementById('theme-icon');
  icon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

// Hide/show the sidebar on mobile depending on scroll direction
function setupMobileSidebarAutoHide() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  const updateSidebarVisibility = () => {
    const isMobile = window.matchMedia('(max-width: 1024px)').matches;
    if (!isMobile) {
      sidebar.classList.remove('sidebar-hidden');
      lastScrollY = window.scrollY;
      ticking = false;
      return;
    }

    const currentScroll = window.scrollY;
    const passedThreshold = currentScroll > 120;

    if (!passedThreshold) {
      sidebar.classList.remove('sidebar-hidden');
    } else if (currentScroll > lastScrollY) {
      sidebar.classList.add('sidebar-hidden');
    } else if (currentScroll < lastScrollY) {
      sidebar.classList.remove('sidebar-hidden');
    }

    lastScrollY = currentScroll;
    ticking = false;
  };

  const handleScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(updateSidebarVisibility);
      ticking = true;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', updateSidebarVisibility);
  updateSidebarVisibility();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  checkAuthStatus();
  loadAppVersion();
  setupMobileSidebarAutoHide();

  // Tab switching
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      if (!button.disabled) {
        switchTab(button.dataset.tab);
      }
    });
  });
});

// Book Details Modal Functions
async function fetchBookDetails(title, author, amazonUrl, button) {
  const originalText = button ? button.textContent : 'View Details';
  if (button) {
    button.textContent = 'Opening...';
    button.disabled = true;
  }

  try {
    const response = await fetch(`${API_BASE}/books/details?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`);
    const data = await response.json();

    if (data.success && data.details) {
      showBookModal(data.details, amazonUrl);
    } else {
      showError('Could not find details for this book.');
    }
  } catch (error) {
    console.error('Error fetching book details:', error);
    showError('Failed to fetch book details.');
  } finally {
    if (button) {
      button.textContent = originalText;
      button.disabled = false;
    }
  }
}

function showBookModal(book, amazonUrl) {
  const modal = document.getElementById('book-modal');
  
  // Populate fields
  document.getElementById('modal-book-title').textContent = book.title;
  
  const authorName = book.contributions && book.contributions[0] && book.contributions[0].author 
    ? book.contributions[0].author.name 
    : 'Unknown Author';
  document.getElementById('modal-book-author').textContent = authorName;
  
  document.getElementById('modal-book-description').textContent = book.description || 'No description available.';
  
  const pages = book.pages ? `${book.pages} pages` : '';
  const rating = book.rating ? `★ ${book.rating.toFixed(1)}` : '';
  const year = book.release_date ? new Date(book.release_date).getFullYear() : '';
  
  document.getElementById('modal-book-pages').textContent = pages;
  document.getElementById('modal-book-rating').textContent = rating;
  document.getElementById('modal-book-year').textContent = year;
  
  const coverImg = document.getElementById('modal-book-cover');
  if (book.images && book.images.length > 0) {
    coverImg.src = book.images[0].url;
  } else {
    coverImg.src = ''; 
  }

  // Actions
  const actionsContainer = document.getElementById('modal-actions');
  actionsContainer.innerHTML = '';

  if (amazonUrl) {
    const amazonBtn = document.createElement('a');
    amazonBtn.href = amazonUrl;
    amazonBtn.target = '_blank';
    amazonBtn.className = 'action-btn';
    amazonBtn.innerHTML = `<img src="/assets/logo/amazon-logo.png" class="action-icon" alt="Amazon"> Amazon`;
    actionsContainer.appendChild(amazonBtn);
  }

  if (book.slug) {
    const hardcoverBtn = document.createElement('a');
    hardcoverBtn.href = `https://hardcover.app/books/${book.slug}`;
    hardcoverBtn.target = '_blank';
    hardcoverBtn.className = 'action-btn';
    hardcoverBtn.innerHTML = `<img src="/assets/logo/hardcover-logo.png" class="action-icon" alt="Hardcover"> Hardcover`;
    actionsContainer.appendChild(hardcoverBtn);
  }

  modal.classList.add('show');
  modal.style.display = 'flex';
}

function closeBookModal() {
  const modal = document.getElementById('book-modal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
  const bookModal = document.getElementById('book-modal');
  if (event.target === bookModal) {
    closeBookModal();
  }
  
  const loginModal = document.getElementById('login-modal');
  if (event.target === loginModal && isAuthenticated) {
      hideLoginModal();
  }
}
