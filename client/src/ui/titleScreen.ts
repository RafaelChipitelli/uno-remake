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

  const renderTopRight = () => {
    topRight.innerHTML = '';

    if (isAuthenticationAvailable() && authSession.isLoading) {
      const status = document.createElement('span');
      status.className = 'ts-top-link ts-top-status';
      status.textContent = t('title.auth.checkingSession');
      topRight.appendChild(status);
    } else if (isAuthenticationAvailable()) {
      const authLink = document.createElement('button');
      authLink.type = 'button';
      authLink.className = 'ts-top-link';
      if (authSession.user) {
        authLink.textContent = t('title.auth.signOutGoogle');
        authLink.addEventListener('click', () => void handleGoogleSignOut());
      } else {
        authLink.textContent = t('title.auth.signInGoogle');
        authLink.addEventListener('click', () => void handleGoogleSignIn());
      }
      topRight.appendChild(authLink);
    }

    const langWrap = document.createElement('div');
    langWrap.className = 'ts-lang';
    const active = getLanguage();
    ([
      { language: 'pt-BR' as Language, flag: t('language.flag.br') },
      { language: 'en-US' as Language, flag: t('language.flag.us') },
    ]).forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ts-flag';
      btn.classList.toggle('is-active', item.language === active);
      btn.textContent = item.flag;
      btn.addEventListener('click', () => {
        setLanguage(item.language);
        showToast(t('title.language.changed'));
      });
      langWrap.appendChild(btn);
    });
    topRight.appendChild(langWrap);
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
      container.remove();
    },
  };
}

function renderShell(): string {
  const glyphs = ['⟲', '⊘', '+4', 'UNO', '↺', '🃏', 'SKIP'];
  const decor = glyphs
    .map((g, i) => `<span class="ts-glyph ts-glyph--${i}" aria-hidden="true">${g}</span>`)
    .join('');

  return `
    <div class="ts-bg" aria-hidden="true">
      <span class="ts-glow ts-glow--left"></span>
      <span class="ts-glow ts-glow--right"></span>
      ${decor}
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
