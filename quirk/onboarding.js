const emailDisplay = document.getElementById('email-display');
const signInBtn = document.getElementById('sign-in-btn');
const statusEl = document.getElementById('status');

// Detect Chrome profile email
chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
  if (userInfo && userInfo.email) {
    emailDisplay.textContent = userInfo.email;
    signInBtn.disabled = false;
    signInBtn.textContent = 'Sign In with Chrome Profile';
  } else {
    emailDisplay.textContent = 'No Chrome profile detected';
    signInBtn.disabled = false;
    signInBtn.textContent = 'Continue Anonymously';
  }
});

// Sign in and initialize user
signInBtn.addEventListener('click', () => {
  signInBtn.disabled = true;
  signInBtn.textContent = 'Setting up...';
  statusEl.textContent = 'Creating your account...';

  // Get email from Chrome profile
  chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, async (userInfo) => {
    try {
      const email = userInfo?.email || null;

      // Initialize user with backend (with email if available)
      const response = await chrome.runtime.sendMessage({
        action: 'initializeUser',
        email: email
      });

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
});
