const emailDisplay = document.getElementById('email-display');
const signInBtn = document.getElementById('sign-in-btn');
const statusEl = document.getElementById('status');

// Initialize - skip email detection, just show ready to start
emailDisplay.textContent = 'Ready to track your productivity';
signInBtn.disabled = false;
signInBtn.textContent = 'Get Started';

// Sign in and initialize user
signInBtn.addEventListener('click', async () => {
  signInBtn.disabled = true;
  signInBtn.textContent = 'Setting up...';
  statusEl.textContent = 'Creating your account...';

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
