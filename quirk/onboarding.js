const emailDisplay = document.getElementById('email-display');
const signInBtn = document.getElementById('sign-in-btn');
const statusEl = document.getElementById('status');

// Detect Chrome profile email
async function detectEmail() {
  try {
    const userInfo = await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });

    if (userInfo.email) {
      emailDisplay.textContent = userInfo.email;
      signInBtn.disabled = false;
      return userInfo.email;
    } else {
      emailDisplay.textContent = 'No Chrome account detected';
      statusEl.innerHTML = '<div class="error">Please sign in to Chrome to continue</div>';
      return null;
    }
  } catch (error) {
    emailDisplay.textContent = 'Error detecting email';
    statusEl.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    return null;
  }
}

// Sign in and initialize user
signInBtn.addEventListener('click', async () => {
  signInBtn.disabled = true;
  signInBtn.textContent = 'Signing in...';
  statusEl.textContent = 'Initializing your account...';

  try {
    // Initialize user with backend
    const response = await chrome.runtime.sendMessage({ action: 'initializeUser' });

    if (response && response.success) {
      statusEl.textContent = '✓ Account created!';

      // Redirect to main popup after 1 second
      setTimeout(() => {
        window.location.href = 'popup.html';
      }, 1000);
    } else {
      throw new Error(response?.error || 'Failed to initialize user');
    }
  } catch (error) {
    statusEl.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    signInBtn.disabled = false;
    signInBtn.textContent = 'Try Again';
  }
});

// Auto-detect email on load
detectEmail();
