import {
  getCurrentAuthSession,
  isAuthenticationAvailable,
  signInWithGoogle,
  subscribeAuthSession,
  updateCurrentUserNickname,
  type AuthSession,
} from '../services/playerAccount';
import {
  getAudioSettings,
  setMuted,
  setVolume,
  subscribeAudio,
  type AudioSettings,
} from '../services/audio';
import { subscribeLanguageChange, t } from '../i18n';
import { askTextInput } from './modal';

const MAX_NICKNAME_LENGTH = 20;

export type SettingsScreenHandle = {
  destroy: () => void;
};

type SettingsScreenOptions = {
  onBack: () => void;
  /** Reads the lobby's current nickname (shared source of truth for guests). */
  getNickname: () => string;
  /** Writes back to the lobby's nickname field so the match actually uses it. */
  setNickname: (nickname: string) => void;
};

/**
 * Full-screen DOM settings overlay rendered on top of the lobby. No Phaser is
 * involved; the lobby stays mounted underneath and is re-shown by the caller
 * on back.
 */
export function mountSettingsScreen(
  root: HTMLElement,
  { onBack, getNickname, setNickname }: SettingsScreenOptions,
): SettingsScreenHandle {
  let authSession: AuthSession = getCurrentAuthSession();
  let audio: AudioSettings = getAudioSettings();

  const container = document.createElement('div');
  container.className = 'st-root';
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-modal', 'true');
  container.setAttribute('aria-label', t('settings.title'));
  container.innerHTML = renderShell();
  root.appendChild(container);

  const backBtn = container.querySelector<HTMLButtonElement>('[data-action="back"]')!;
  const titleEl = container.querySelector<HTMLElement>('.st-title')!;
  const accountCardTitle = container.querySelector<HTMLElement>('[data-i18n="accountTitle"]')!;
  const nicknameLabel = container.querySelector<HTMLElement>('.st-nickname-label')!;
  const nicknameValue = container.querySelector<HTMLElement>('.st-nickname-value')!;
  const editNicknameBtn = container.querySelector<HTMLButtonElement>('[data-action="edit-nickname"]')!;
  const linkedCard = container.querySelector<HTMLElement>('.st-card--linked')!;
  const linkedCardTitle = container.querySelector<HTMLElement>('[data-i18n="linkedTitle"]')!;
  const googleRowLabel = container.querySelector<HTMLElement>('.st-google-label')!;
  const googleStatus = container.querySelector<HTMLElement>('.st-google-status')!;
  const audioCardTitle = container.querySelector<HTMLElement>('[data-i18n="audioTitle"]')!;
  const volumeLabel = container.querySelector<HTMLElement>('.st-volume-label')!;
  const volumeSlider = container.querySelector<HTMLInputElement>('.st-volume-slider')!;
  const volumeValue = container.querySelector<HTMLElement>('.st-volume-value')!;
  const muteToggle = container.querySelector<HTMLInputElement>('.st-mute-toggle')!;
  const muteLabel = container.querySelector<HTMLElement>('.st-mute-label')!;

  const currentNickname = (): string => authSession.profile?.nickname ?? getNickname();

  const renderAccount = () => {
    nicknameValue.textContent = currentNickname() || t('settings.account.noNickname');
  };

  const renderLinked = () => {
    if (!isAuthenticationAvailable()) {
      linkedCard.hidden = true;
      return;
    }
    linkedCard.hidden = false;
    googleStatus.innerHTML = '';
    if (authSession.user) {
      const badge = document.createElement('span');
      badge.className = 'st-badge st-badge--connected';
      const who = authSession.user.email ?? authSession.user.displayName ?? '';
      badge.textContent = who
        ? t('settings.linked.connectedAs', { who })
        : t('settings.linked.connected');
      googleStatus.appendChild(badge);
    } else {
      const connectBtn = document.createElement('button');
      connectBtn.type = 'button';
      connectBtn.className = 'st-btn st-btn--primary';
      connectBtn.textContent = t('settings.linked.connect');
      connectBtn.addEventListener('click', () => void handleConnectGoogle());
      googleStatus.appendChild(connectBtn);
    }
  };

  const renderAudio = () => {
    const percent = Math.round(audio.volume * 100);
    volumeSlider.value = String(percent);
    volumeSlider.setAttribute('aria-valuetext', `${percent}%`);
    volumeSlider.disabled = audio.muted;
    volumeValue.textContent = `${percent}%`;
    muteToggle.checked = audio.muted;
  };

  const renderText = () => {
    titleEl.textContent = t('settings.title');
    backBtn.textContent = t('settings.back');
    accountCardTitle.textContent = t('settings.account.title');
    nicknameLabel.textContent = t('settings.account.nickname');
    editNicknameBtn.textContent = t('settings.account.edit');
    linkedCardTitle.textContent = t('settings.linked.title');
    googleRowLabel.textContent = t('settings.linked.google');
    audioCardTitle.textContent = t('settings.audio.title');
    volumeLabel.textContent = t('settings.audio.volume');
    muteLabel.textContent = t('settings.audio.mute');
    volumeSlider.setAttribute('aria-label', t('settings.audio.volume'));
    renderAccount();
    renderLinked();
    renderAudio();
  };

  async function handleConnectGoogle(): Promise<void> {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('[settings] Falha ao conectar com Google', error);
    }
  }

  async function handleEditNickname(): Promise<void> {
    const next = await askTextInput({
      title: t('settings.account.editTitle'),
      message: t('settings.account.editMessage'),
      placeholder: t('settings.account.nickname'),
      initialValue: currentNickname(),
      confirmLabel: t('settings.account.edit'),
      cancelLabel: t('settings.back'),
    });
    const nickname = next?.trim().slice(0, MAX_NICKNAME_LENGTH);
    if (!nickname) {
      return;
    }
    if (authSession.user) {
      try {
        await updateCurrentUserNickname(nickname);
      } catch (error) {
        console.error('[settings] Falha ao atualizar nickname', error);
      }
    } else {
      setNickname(nickname);
    }
    renderAccount();
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onBack();
    }
  };

  backBtn.addEventListener('click', () => onBack());
  editNicknameBtn.addEventListener('click', () => void handleEditNickname());
  volumeSlider.addEventListener('input', () => {
    setVolume(Number(volumeSlider.value) / 100);
  });
  muteToggle.addEventListener('change', () => {
    setMuted(muteToggle.checked);
  });
  // Bound to document (not the container) so Esc still closes Settings when
  // focus has left the container — e.g. after the nickname modal closes focus
  // returns to <body>. stopPropagation keeps titleScreen's own document
  // keydown handler from double-handling the same Escape.
  document.addEventListener('keydown', handleKeydown);

  const unsubscribeAuth = subscribeAuthSession((session) => {
    authSession = session;
    renderAccount();
    renderLinked();
  });
  const unsubscribeAudio = subscribeAudio((next) => {
    audio = next;
    renderAudio();
  });
  const unsubscribeLanguage = subscribeLanguageChange(() => renderText());

  renderText();
  backBtn.focus();

  return {
    destroy: () => {
      unsubscribeAuth();
      unsubscribeAudio();
      unsubscribeLanguage();
      document.removeEventListener('keydown', handleKeydown);
      container.remove();
    },
  };
}

function renderShell(): string {
  return `
    <div class="st-bg" aria-hidden="true"></div>
    <main class="st-stage">
      <header class="st-header">
        <h1 class="st-title"></h1>
        <button type="button" class="st-btn st-btn--primary st-back" data-action="back"></button>
      </header>
      <section class="st-card">
        <h2 class="st-card-title" data-i18n="accountTitle"></h2>
        <div class="st-row">
          <div class="st-row-info">
            <span class="st-nickname-label st-label"></span>
            <span class="st-nickname-value st-value"></span>
          </div>
          <button type="button" class="st-btn st-btn--ghost" data-action="edit-nickname"></button>
        </div>
      </section>
      <section class="st-card st-card--linked">
        <h2 class="st-card-title" data-i18n="linkedTitle"></h2>
        <div class="st-row">
          <span class="st-google-label st-label"></span>
          <div class="st-google-status"></div>
        </div>
      </section>
      <section class="st-card">
        <h2 class="st-card-title" data-i18n="audioTitle"></h2>
        <div class="st-row">
          <label class="st-volume-label st-label" for="st-volume"></label>
          <div class="st-slider-wrap">
            <input
              id="st-volume"
              class="st-volume-slider"
              type="range"
              min="0"
              max="100"
              step="1"
            />
            <span class="st-volume-value st-value"></span>
          </div>
        </div>
        <div class="st-row">
          <label class="st-mute-label st-label" for="st-mute"></label>
          <input id="st-mute" class="st-mute-toggle" type="checkbox" />
        </div>
      </section>
    </main>
  `;
}
