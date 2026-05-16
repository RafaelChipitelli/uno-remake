import {
  getCurrentAuthSession,
  isAuthenticationAvailable,
  signInWithGoogle,
  signOutCurrentUser,
  subscribeAuthSession,
  updateCurrentUserNickname,
  type AuthSession,
} from '../services/playerAccount';
import { getLanguage, setLanguage, subscribeLanguageChange, t, type Language } from '../i18n';
import { askTextInput } from './modal';
import { mountSettingsScreen, type SettingsScreenHandle } from './settingsScreen';
import type { SceneLaunchData } from '../scenes/game/constants';

const MAX_NICKNAME_LENGTH = 20;

export type TitleScreenHandle = {
  destroy: () => void;
};

type StartHandler = (data: SceneLaunchData) => void;

/**
 * Richup-style lobby rendered as plain DOM/CSS instead of a Phaser canvas, so
 * hover/transitions are GPU-composited and the page is idle when nothing
 * changes. Phaser is only booted once the player actually starts a game.
 */
export function mountTitleScreen(root: HTMLElement, onStart: StartHandler): TitleScreenHandle {
  let authSession: AuthSession = getCurrentAuthSession();
  let lastNickname = '';
  let isStarting = false;
  let isMenuOpen = false;
  let settings: SettingsScreenHandle | null = null;

  const container = document.createElement('div');
  container.className = 'ts-root';
  container.innerHTML = renderShell();
  root.appendChild(container);

  const nicknameInput = container.querySelector<HTMLInputElement>('.ts-field input')!;
  const nicknameField = container.querySelector<HTMLElement>('.ts-field')!;
  const statsLine = container.querySelector<HTMLElement>('.ts-stats')!;
  const hintLine = container.querySelector<HTMLElement>('.ts-hint')!;
  const infoLine = container.querySelector<HTMLElement>('.ts-info')!;
  const subtitle = container.querySelector<HTMLElement>('.ts-subtitle')!;
  const playBtn = container.querySelector<HTMLButtonElement>('[data-action="play"]')!;
  const createBtn = container.querySelector<HTMLButtonElement>('[data-action="create"]')!;
  const joinBtn = container.querySelector<HTMLButtonElement>('[data-action="join"]')!;
  const topRight = container.querySelector<HTMLElement>('.ts-topright')!;

  const sanitize = (raw: string | null | undefined): string =>
    raw?.trim().slice(0, MAX_NICKNAME_LENGTH) ?? '';
  const sanitizeDraft = (raw: string | null | undefined): string =>
    raw?.slice(0, MAX_NICKNAME_LENGTH) ?? '';

  const syncFieldFilled = () => {
    nicknameField.classList.toggle('is-filled', sanitize(nicknameInput.value).length > 0);
  };

  const getNickname = (): string => sanitize(nicknameInput.value || lastNickname);
  // Settings shares this lobby field as its single source of truth so a guest's
  // edit survives the Settings remount and actually feeds ensureNicknameForPlay.
  const setNickname = (raw: string) => {
    const next = sanitize(raw);
    lastNickname = next;
    nicknameInput.value = next;
    syncFieldFilled();
  };

  const identityDetails = (): { statsLabel: string; hint?: string } => {
    if (!isAuthenticationAvailable()) {
      return {
        statsLabel: t('title.identity.stats.empty'),
        hint: t('title.identity.hint.firebaseDisabled'),
      };
    }
    if (authSession.isLoading) {
      return { statsLabel: t('title.identity.stats.loading') };
    }
    if (!authSession.user) {
      return {
        statsLabel: t('title.identity.stats.empty'),
        hint: t('title.identity.hint.loginForStats'),
      };
    }
    const stats = authSession.profile?.stats;
    return {
      statsLabel: stats
        ? t('title.identity.stats.dynamic', { gamesPlayed: stats.gamesPlayed, gamesWon: stats.gamesWon })
        : t('title.identity.stats.empty'),
    };
  };

  const showInfo = (message: string) => {
    infoLine.dataset.default = 'false';
    infoLine.textContent = message;
    infoLine.classList.remove('ts-pulse');
    void infoLine.offsetWidth;
    infoLine.classList.add('ts-pulse');
  };

  const showToast = (message: string) => {
    const toast = document.createElement('div');
    toast.className = 'ts-toast';
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    window.setTimeout(() => {
      toast.classList.remove('is-visible');
      window.setTimeout(() => toast.remove(), 220);
    }, 1900);
  };

  const googleSignInError = (error: unknown): string => {
    const code = (error as { code?: string } | null)?.code;
    switch (code) {
      case 'auth/unauthorized-domain':
        return t('title.auth.error.unauthorizedDomain');
      case 'auth/operation-not-allowed':
        return t('title.auth.error.operationNotAllowed');
      case 'auth/popup-blocked':
        return t('title.auth.error.popupBlocked');
      case 'auth/popup-closed-by-user':
        return t('title.auth.error.popupClosed');
      case 'auth/cancelled-popup-request':
        return t('title.auth.error.cancelledPopup');
      case 'auth/network-request-failed':
        return t('title.auth.error.network');
      default:
        return code ? t('title.auth.error.withCode', { code }) : t('title.auth.error.default');
    }
  };

  const renderText = () => {
    subtitle.textContent = t('title.subtitle');
    playBtn.textContent = t('title.primary.play');
    createBtn.textContent = t('title.secondary.createPrivate');
    joinBtn.textContent = t('title.secondary.joinCode');
    nicknameInput.setAttribute('aria-label', t('title.nickname.title'));
    if (!infoLine.textContent || infoLine.dataset.default === 'true') {
      infoLine.dataset.default = 'true';
      infoLine.textContent = t('title.info.chooseOption');
    }

    const identity = identityDetails();
    statsLine.textContent = identity.statsLabel;
    if (identity.hint) {
      hintLine.textContent = identity.hint;
      hintLine.hidden = false;
    } else {
      hintLine.hidden = true;
    }

    renderTopRight();
  };

  const initialsFromNickname = (): string => {
    const source =
      authSession.profile?.nickname ||
      authSession.user?.displayName ||
      sanitize(nicknameInput.value || lastNickname) ||
      '?';
    const parts = source.trim().split(/\s+/).filter(Boolean);
    const letters =
      parts.length >= 2 ? parts[0][0] + parts[1][0] : source.trim().slice(0, 2);
    return letters.toUpperCase() || '?';
  };

  const closeMenu = () => {
    if (!isMenuOpen) {
      return;
    }
    isMenuOpen = false;
    renderTopRight();
  };

  const openMenu = () => {
    if (isMenuOpen) {
      return;
    }
    isMenuOpen = true;
    renderTopRight();
    const firstItem = topRight.querySelector<HTMLButtonElement>('.ts-menu-item');
    firstItem?.focus();
  };

  const avatarButton = (): HTMLButtonElement | null =>
    topRight.querySelector<HTMLButtonElement>('.ts-avatar');

  const onDocumentPointerDown = (event: MouseEvent) => {
    if (isMenuOpen && !topRight.contains(event.target as Node)) {
      closeMenu();
    }
  };
  const onDocumentKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isMenuOpen) {
      closeMenu();
      avatarButton()?.focus();
    }
  };
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeydown);

  const addMenuItem = (
    menu: HTMLElement,
    label: string,
    onClick: () => void,
    tone?: 'danger',
  ) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'ts-menu-item';
    if (tone === 'danger') {
      item.classList.add('ts-menu-item--danger');
    }
    item.setAttribute('role', 'menuitem');
    item.textContent = label;
    item.addEventListener('click', () => {
      closeMenu();
      onClick();
    });
    menu.appendChild(item);
  };

  const renderTopRight = () => {
    topRight.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'ts-account';

    const avatar = document.createElement('button');
    avatar.type = 'button';
    avatar.className = 'ts-avatar';
    avatar.setAttribute('aria-haspopup', 'menu');
    avatar.setAttribute('aria-expanded', String(isMenuOpen));
    avatar.setAttribute('aria-label', t('title.menu.open'));

    const renderInitialsAvatar = () => {
      const initials = document.createElement('span');
      initials.className = 'ts-avatar-initials';
      initials.setAttribute('aria-hidden', 'true');
      initials.textContent = initialsFromNickname();
      return initials;
    };

    const photo = authSession.user?.photoURL;
    if (photo) {
      const img = document.createElement('img');
      img.className = 'ts-avatar-img';
      img.src = photo;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      // A dead/throttled Google photo URL must not render a broken image.
      img.addEventListener('error', () => {
        img.replaceWith(renderInitialsAvatar());
      });
      avatar.appendChild(img);
    } else {
      avatar.appendChild(renderInitialsAvatar());
    }
    avatar.addEventListener('click', () => {
      if (isMenuOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });
    wrap.appendChild(avatar);

    if (isMenuOpen) {
      const menu = document.createElement('div');
      menu.className = 'ts-menu';
      menu.setAttribute('role', 'menu');

      addMenuItem(menu, t('title.menu.profile'), () => {
        showToast(t('title.menu.profileSoon'));
      });
      addMenuItem(menu, t('title.menu.settings'), () => showSettings());

      if (isAuthenticationAvailable() && !authSession.isLoading) {
        if (authSession.user) {
          addMenuItem(menu, t('title.menu.signOut'), () => void handleGoogleSignOut(), 'danger');
        } else {
          addMenuItem(menu, t('title.auth.signInGoogle'), () => void handleGoogleSignIn());
        }
      }

      const langRow = document.createElement('div');
      langRow.className = 'ts-menu-lang';
      langRow.setAttribute('role', 'group');
      langRow.setAttribute('aria-label', t('title.menu.language'));
      const active = getLanguage();
      ([
        { language: 'pt-BR' as Language, flag: t('language.flag.br'), name: t('language.pt-BR') },
        { language: 'en-US' as Language, flag: t('language.flag.us'), name: t('language.en-US') },
      ]).forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ts-flag';
        btn.classList.toggle('is-active', item.language === active);
        btn.textContent = item.flag;
        btn.setAttribute('aria-label', item.name);
        btn.setAttribute('aria-pressed', String(item.language === active));
        btn.addEventListener('click', () => {
          setLanguage(item.language);
          closeMenu();
          showToast(t('title.language.changed'));
        });
        langRow.appendChild(btn);
      });
      menu.appendChild(langRow);

      wrap.appendChild(menu);
    }

    topRight.appendChild(wrap);
  };

  const showSettings = () => {
    if (settings) {
      return;
    }
    container.classList.add('is-hidden');
    settings = mountSettingsScreen(root, {
      getNickname,
      setNickname,
      onBack: () => {
        settings?.destroy();
        settings = null;
        container.classList.remove('is-hidden');
        avatarButton()?.focus();
      },
    });
  };

  async function handleGoogleSignIn(): Promise<void> {
    try {
      await signInWithGoogle();
      showToast(t('title.auth.connectedSuccess'));
    } catch (error) {
      console.error('[auth] Falha no login com Google', error);
      showInfo(googleSignInError(error));
    }
  }

  async function handleGoogleSignOut(): Promise<void> {
    try {
      await signOutCurrentUser();
      showInfo(t('title.auth.signedOut'));
    } catch (error) {
      console.error('[auth] Falha ao sair da conta', error);
      showInfo(t('title.auth.signOutError'));
    }
  }

  const ensureNicknameForPlay = async (): Promise<string | undefined> => {
    let nickname = sanitize(nicknameInput.value || lastNickname);
    if (!nickname) {
      nickname = `Player-${Math.floor(1000 + Math.random() * 9000)}`;
      nicknameInput.value = nickname;
      syncFieldFilled();
    }
    lastNickname = nickname;

    if (authSession.user && nickname !== authSession.profile?.nickname) {
      try {
        await updateCurrentUserNickname(nickname);
      } catch (error) {
        console.error('[auth] Falha ao atualizar nickname no Firestore', error);
        showInfo(t('title.nickname.cloudSaveFailed'));
      }
    }
    return nickname;
  };

  const setButtonsEnabled = (enabled: boolean) => {
    [playBtn, createBtn, joinBtn].forEach((btn) => {
      btn.disabled = !enabled;
    });
  };

  const startGame = async (autoAction: SceneLaunchData['autoAction']): Promise<void> => {
    if (isStarting) {
      return;
    }
    isStarting = true;
    setButtonsEnabled(false);
    try {
      let roomCode: string | undefined;
      if (autoAction === 'join') {
        roomCode = (
          await askTextInput({
            title: t('title.joinRoom.title'),
            message: t('title.joinRoom.message'),
            placeholder: t('title.joinRoom.placeholder'),
            confirmLabel: t('title.joinRoom.confirm'),
            cancelLabel: t('title.common.cancel'),
          })
        )
          ?.trim()
          .toUpperCase();
        if (!roomCode) {
          showInfo(t('title.joinRoom.invalidCode'));
          return;
        }
      }

      const nickname = await ensureNicknameForPlay();
      if (!nickname) {
        showInfo(t('title.start.noNickname'));
        return;
      }

      onStart({ autoAction, nickname, roomCode });
    } finally {
      isStarting = false;
      setButtonsEnabled(true);
    }
  };

  nicknameInput.addEventListener('input', () => {
    const draft = sanitizeDraft(nicknameInput.value);
    if (nicknameInput.value !== draft) {
      nicknameInput.value = draft;
    }
    lastNickname = sanitize(nicknameInput.value);
    syncFieldFilled();
  });
  nicknameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      nicknameInput.blur();
    }
  });
  nicknameInput.addEventListener('blur', syncFieldFilled);
  nicknameInput.addEventListener('focus', syncFieldFilled);

  playBtn.addEventListener('click', () => void startGame('quick_play'));
  createBtn.addEventListener('click', () => void startGame('create_private'));
  joinBtn.addEventListener('click', () => void startGame('join'));

  const unsubscribeAuth = subscribeAuthSession((session) => {
    authSession = session;
    renderText();
  });
  const unsubscribeLanguage = subscribeLanguageChange(() => renderText());

  renderText();
  syncFieldFilled();

  return {
    destroy: () => {
      unsubscribeAuth();
      unsubscribeLanguage();
      document.removeEventListener('pointerdown', onDocumentPointerDown);
      document.removeEventListener('keydown', onDocumentKeydown);
      settings?.destroy();
      settings = null;
      container.remove();
    },
  };
}

function renderShell(): string {
  // UNO-themed marks (numbers + the four action cards), scattered like
  // Richup: many, small, very faint, mostly fanning out from a warm glow
  // near the bottom-center. Positions are curated (not random) so the
  // cluster reads as intentional.
  // Faint grey UNO marks live ONLY in the lower half, densest near the
  // bottom-center and thinning/fading as they fan upward and outward —
  // the content area up top stays clean (like Richup). `o` = opacity.
  const glyphs: Array<{ c: string; x: number; y: number; s: number; o: number }> = [
    // outer ring (high, faint, small)
    { c: '8', x: 10, y: 56, s: 24, o: 0.03 },
    { c: '+4', x: 90, y: 55, s: 24, o: 0.03 },
    { c: '✦', x: 6, y: 70, s: 22, o: 0.035 },
    { c: '6', x: 94, y: 69, s: 22, o: 0.035 },
    { c: '4', x: 18, y: 62, s: 22, o: 0.04 },
    { c: '⇆', x: 82, y: 61, s: 22, o: 0.04 },
    // mid ring
    { c: '9', x: 24, y: 76, s: 28, o: 0.05 },
    { c: '✦', x: 76, y: 75, s: 28, o: 0.05 },
    { c: '1', x: 14, y: 84, s: 24, o: 0.045 },
    { c: 'Ø', x: 86, y: 83, s: 24, o: 0.045 },
    { c: '+2', x: 33, y: 70, s: 26, o: 0.055 },
    { c: '3', x: 67, y: 69, s: 26, o: 0.055 },
    // inner ring (lower, larger, a touch stronger)
    { c: '7', x: 40, y: 80, s: 38, o: 0.07 },
    { c: '⇆', x: 60, y: 80, s: 38, o: 0.07 },
    { c: '+4', x: 30, y: 90, s: 32, o: 0.06 },
    { c: '+2', x: 70, y: 89, s: 32, o: 0.06 },
    { c: '0', x: 47, y: 94, s: 30, o: 0.06 },
    { c: 'Ø', x: 55, y: 95, s: 30, o: 0.06 },
    { c: '5', x: 22, y: 95, s: 24, o: 0.045 },
    { c: '2', x: 78, y: 94, s: 24, o: 0.045 },
  ];
  const decor = glyphs
    .map(
      (g, i) =>
        `<span class="ts-glyph" aria-hidden="true" style="left:${g.x}%;top:${g.y}%;font-size:${g.s}px;opacity:${g.o};animation-delay:${(i % 7) * 0.6}s;animation-duration:${6 + (i % 5)}s">${g.c}</span>`,
    )
    .join('');

  // Vibrant focal pile of UNO cards at the bottom-center — the bright,
  // colorful anchor the faint marks fan out from (Richup's glowing heap).
  const pileCards = [
    { cls: 'r', label: '+4', rot: -26, x: -86 },
    { cls: 'y', label: '7', rot: -12, x: -44 },
    { cls: 'g', label: 'Ø', rot: 2, x: 0 },
    { cls: 'b', label: '+2', rot: 15, x: 44 },
    { cls: 'r', label: '⇆', rot: 28, x: 86 },
    { cls: 'w', label: 'W', rot: -4, x: 16, lift: 22 },
  ];
  const pile = pileCards
    .map(
      (c) =>
        `<span class="ts-pile-card ts-pile-card--${c.cls}" style="--rot:${c.rot}deg;--tx:${c.x}px;--lift:${c.lift ?? 0}px">${c.label}</span>`,
    )
    .join('');

  return `
    <div class="ts-bg" aria-hidden="true">
      <span class="ts-glow ts-glow--left"></span>
      <span class="ts-glow ts-glow--right"></span>
      <span class="ts-glow ts-glow--bottom"></span>
      ${decor}
      <div class="ts-pile">${pile}</div>
    </div>
    <div class="ts-topright"></div>
    <main class="ts-stage">
      <div class="ts-logo">
        <span class="ts-card-icon" aria-hidden="true"><b>UNO</b><i class="ts-sparkle"></i></span>
        <h1 class="ts-title"><span class="ts-uno">UNO</span><span class="ts-rmk">REMAKE</span></h1>
        <p class="ts-subtitle"></p>
      </div>
      <div class="ts-field">
        <input type="text" maxlength="${MAX_NICKNAME_LENGTH}" required autocomplete="off" />
        <label aria-hidden="true">Username</label>
      </div>
      <p class="ts-stats"></p>
      <p class="ts-hint" hidden></p>
      <button type="button" class="ts-btn ts-btn--primary" data-action="play"></button>
      <div class="ts-secondary">
        <button type="button" class="ts-btn ts-btn--secondary" data-action="create"></button>
        <button type="button" class="ts-btn ts-btn--secondary" data-action="join"></button>
      </div>
      <p class="ts-info" data-default="true"></p>
    </main>
  `;
}
