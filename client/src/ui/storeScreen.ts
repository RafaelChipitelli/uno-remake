import {
  getCurrentAuthSession,
  isAuthenticationAvailable,
  subscribeAuthSession,
  type AuthSession,
} from '../services/playerAccount';
import { levelForKarma } from '../services/karma';
import { getCatalog, isUnlocked, type Cosmetic } from '../services/cosmetics';
import {
  equipCosmetic,
  getEffectiveCosmetic,
  subscribeEquippedCosmetic,
} from '../services/equippedCosmetic';
import { subscribeLanguageChange, t } from '../i18n';

export type StoreScreenHandle = {
  destroy: () => void;
};

type StoreScreenOptions = {
  onBack: () => void;
};

/**
 * Full-screen DOM store overlay, mirroring the profile/settings lifecycle
 * (lobby stays mounted underneath; caller re-shows it on back). Equipping is
 * optimistic and never throws — cloud persistence is best-effort in the
 * service layer.
 */
export function mountStoreScreen(
  root: HTMLElement,
  { onBack }: StoreScreenOptions,
): StoreScreenHandle {
  let authSession: AuthSession = getCurrentAuthSession();
  let equippedId: string = getEffectiveCosmetic().id;

  const container = document.createElement('div');
  container.className = 'st-root';
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-modal', 'true');
  container.setAttribute('aria-label', t('store.title'));
  container.innerHTML = renderShell();
  root.appendChild(container);

  const titleEl = container.querySelector<HTMLElement>('.st-title')!;
  const backBtn = container.querySelector<HTMLButtonElement>('[data-action="back"]')!;
  const subtitleEl = container.querySelector<HTMLElement>('.sc-subtitle')!;
  const progressLevelEl = container.querySelector<HTMLElement>('.sc-progress-level')!;
  const progressKarmaEl = container.querySelector<HTMLElement>('.sc-progress-karma')!;
  const sectionTitleEl = container.querySelector<HTMLElement>('[data-i18n="section"]')!;
  const gridEl = container.querySelector<HTMLElement>('.sc-grid')!;
  const guestNoteEl = container.querySelector<HTMLElement>('.sc-guest-note')!;
  const liveEl = container.querySelector<HTMLElement>('.sc-live')!;

  const currentLevel = (): number =>
    levelForKarma(authSession.profile?.stats?.karma ?? 0).level;

  const renderCard = (item: Cosmetic, level: number): HTMLElement => {
    const unlocked = isUnlocked(item, level);
    const isEquipped = unlocked && item.id === equippedId;
    const name = t(item.nameKey);

    const card = document.createElement('article');
    card.className = 'sc-item';
    if (isEquipped) {
      card.classList.add('is-equipped');
    }
    if (!unlocked) {
      card.classList.add('is-locked');
    }

    const preview = document.createElement('div');
    preview.className = 'sc-preview';
    preview.setAttribute('role', 'img');
    preview.setAttribute('aria-label', t('store.preview.alt', { name }));
    preview.style.setProperty('--sc-fill', item.colors.fill);
    preview.style.setProperty('--sc-stroke', item.colors.stroke);
    const previewMark = document.createElement('span');
    previewMark.className = 'sc-preview-mark';
    previewMark.setAttribute('aria-hidden', 'true');
    previewMark.textContent = 'UNO';
    preview.appendChild(previewMark);

    const nameEl = document.createElement('h3');
    nameEl.className = 'sc-item-name';
    nameEl.textContent = name;

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'st-btn sc-action';

    if (!unlocked) {
      action.classList.add('sc-action--locked');
      action.disabled = true;
      action.textContent = t('store.state.locked', { level: item.unlockLevel });
      action.setAttribute(
        'aria-label',
        t('store.state.lockedHint', { level: item.unlockLevel }),
      );
    } else if (isEquipped) {
      action.classList.add('sc-action--equipped');
      action.disabled = true;
      action.textContent = t('store.state.equipped');
    } else {
      action.classList.add('st-btn--primary');
      action.textContent = t('store.state.equip');
      action.setAttribute('aria-label', `${t('store.state.equip')}: ${name}`);
      action.addEventListener('click', () => {
        const effective = equipCosmetic(item.id);
        liveEl.textContent = t('store.equippedToast', { name: t(effective.nameKey) });
      });
    }

    card.append(preview, nameEl, action);
    return card;
  };

  const renderGrid = () => {
    const level = currentLevel();
    gridEl.innerHTML = '';
    getCatalog().forEach((item) => gridEl.appendChild(renderCard(item, level)));
  };

  const renderProgress = () => {
    const isSignedIn = Boolean(authSession.user);
    const total = authSession.profile?.stats?.karma ?? 0;
    const { level } = levelForKarma(total);
    progressLevelEl.textContent = t('store.progress.level', { level });
    progressKarmaEl.textContent = t('store.progress.karma', { points: total });
    progressKarmaEl.hidden = !isSignedIn;

    const showGuestNote = !isSignedIn;
    guestNoteEl.hidden = !showGuestNote;
    if (showGuestNote) {
      guestNoteEl.textContent = isAuthenticationAvailable()
        ? t('store.guestNote')
        : t('profile.auth.unavailable');
    }
  };

  const renderAll = () => {
    titleEl.textContent = t('store.title');
    backBtn.textContent = t('store.back');
    subtitleEl.textContent = t('store.subtitle');
    sectionTitleEl.textContent = t('store.section.cardBacks');
    renderProgress();
    renderGrid();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onBack();
    }
  };

  backBtn.addEventListener('click', () => onBack());
  document.addEventListener('keydown', handleKeydown);

  const unsubscribeAuth = subscribeAuthSession((session) => {
    authSession = session;
    renderAll();
  });
  const unsubscribeEquipped = subscribeEquippedCosmetic((cosmetic) => {
    equippedId = cosmetic.id;
    renderGrid();
  });
  const unsubscribeLanguage = subscribeLanguageChange(() => renderAll());

  renderAll();
  backBtn.focus();

  return {
    destroy: () => {
      unsubscribeAuth();
      unsubscribeEquipped();
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
      <section class="st-card sc-intro">
        <p class="sc-subtitle"></p>
        <div class="sc-progress">
          <span class="sc-progress-level"></span>
          <span class="sc-progress-karma"></span>
        </div>
        <p class="sc-guest-note" hidden></p>
      </section>
      <section class="st-card">
        <h2 class="st-card-title" data-i18n="section"></h2>
        <div class="sc-grid"></div>
      </section>
      <p class="sc-live" role="status" aria-live="polite"></p>
    </main>
  `;
}
