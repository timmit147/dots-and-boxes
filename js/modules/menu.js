// Fullscreen menu opened by top-right icon. SPA: show auth container instead of navigating.
export function initMenu() {
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

    // Bind to the ONE icon (it’s the same node, moved between body/header)
    const bind = () => {
      const btn = document.getElementById('open-login-btn');
      btn?.addEventListener('click', openMenu);
    };
    bind();

    // In case DOM is re-rendered, re-bind on focus
    document.addEventListener('focusin', () => {
      // ensure it's still bound
      const btn = document.getElementById('open-login-btn');
      if (btn && !btn.__fsBound) {
        btn.addEventListener('click', openMenu);
        btn.__fsBound = true;
      }
    });

    closeBtn?.addEventListener('click', closeMenu);
    backdrop?.addEventListener('click', closeMenu);

    const showAuth = () => {
      const authContainer = document.getElementById('auth-container');
      const lobby = document.getElementById('game-lobby-container');
      const game = document.getElementById('game-container');
      if (authContainer) authContainer.style.display = 'flex';
      if (lobby) lobby.style.display = 'none';
      if (game) game.style.display = 'none';
    };

    loginLink?.addEventListener('click', (e) => { e.preventDefault(); showAuth(); closeMenu(); });
    signupLink?.addEventListener('click', (e) => { e.preventDefault(); showAuth(); closeMenu(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureFullscreenMenu);
  } else {
    ensureFullscreenMenu();
  }
}