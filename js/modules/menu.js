// Fullscreen menu opened by top-right icon. SPA: show auth container instead of navigating.
export function initMenu() {
  const openLoginBtn = document.getElementById('open-login-btn');

  function showAuth() {
    const authContainer = document.getElementById('auth-container');
    const lobby = document.getElementById('game-lobby-container');
    const game = document.getElementById('game-container');
    if (authContainer) authContainer.style.display = 'flex';
    if (lobby) lobby.style.display = 'none';
    if (game) game.style.display = 'none';
  }

  function ensureFullscreenMenu() {
    if (document.getElementById('fullscreen-menu')) return;

    const overlay = document.createElement('div');
    overlay.id = 'fullscreen-menu';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="fs-backdrop"></div>
      <div class="fs-card" role="dialog" aria-modal="true" aria-labelledby="fs-title">
        <button class="fs-close" aria-label="Close">✕</button>
        <nav class="fs-links" aria-label="Authentication links">
          <a id="fs-login-link" href="#">Login</a>
          <a id="fs-signup-link" href="#">Create account</a>
        </nav>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('.fs-close');
    const backdrop = overlay.querySelector('.fs-backdrop');
    const loginLink = overlay.querySelector('#fs-login-link');
    const signupLink = overlay.querySelector('#fs-signup-link');

    const openMenu = () => {
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      document.addEventListener('keydown', onEsc);
    };
    const closeMenu = () => {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      document.removeEventListener('keydown', onEsc);
    };
    const onEsc = (e) => { if (e.key === 'Escape') closeMenu(); };

    openLoginBtn?.addEventListener('click', openMenu);
    closeBtn?.addEventListener('click', closeMenu);
    backdrop?.addEventListener('click', closeMenu);

    loginLink?.addEventListener('click', (e) => { e.preventDefault(); showAuth(); closeMenu(); });
    signupLink?.addEventListener('click', (e) => { e.preventDefault(); showAuth(); closeMenu(); });
  }

  ensureFullscreenMenu();
}