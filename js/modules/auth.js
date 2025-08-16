import {
  auth, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, signInAnonymously
} from '../firebase.js';

export function initAuthUI() {
  const authContainer = document.getElementById('auth-container');
  const gameLobbyContainer = document.getElementById('game-lobby-container');
  const gameContainer = document.getElementById('game-container');

  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const signupButton = document.getElementById('signup-button');
  const signinButton = document.getElementById('signin-button');
  const signoutButton = document.getElementById('signout-button');
  const guestLoginButton = document.getElementById('guest-login-button');
  const authStatus = document.getElementById('auth-status');

  // Guarded listeners
  signupButton?.addEventListener('click', async () => {
    try {
      await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
      authStatus.textContent = 'Account created.';
    } catch (e) {
      authStatus.textContent = `Sign Up Error: ${e.message}`;
    }
  });

  signinButton?.addEventListener('click', async () => {
    try {
      await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
      authStatus.textContent = 'Signed in.';
    } catch (e) {
      authStatus.textContent = `Sign In Error: ${e.message}`;
    }
  });

  guestLoginButton?.addEventListener('click', async () => {
    try {
      await signInAnonymously(auth);
      authStatus.textContent = 'Signed in as a guest!';
    } catch (e) {
      authStatus.textContent = `Guest Sign In Error: ${e.message}`;
    }
  });

  signoutButton?.addEventListener('click', async () => {
    try {
      await signOut(auth);
      authStatus.textContent = 'User signed out.';
    } catch (e) {
      authStatus.textContent = `Sign Out Error: ${e.message}`;
    }
  });

  onAuthStateChanged(auth, (user) => {
    if (!authContainer || !gameLobbyContainer || !gameContainer) return;
    if (user) {
      authContainer.style.display = 'none';
      gameLobbyContainer.style.display = 'flex';
      // status text preserved
      if (user.isAnonymous) authStatus.textContent = "You are logged in as a guest. Your game progress will not be saved.";
      else authStatus.textContent = `Welcome, ${user.email}!`;
    } else {
      authContainer.style.display = 'flex';
      gameLobbyContainer.style.display = 'none';
      gameContainer.style.display = 'none';
    }
  });
}