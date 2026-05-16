import {
  fetchRecentMatches,
  getCurrentAuthSession,
  isAuthenticationAvailable,
  signInWithGoogle,
  subscribeAuthSession,
  type AuthSession,
  type MatchSummary,
} from '../services/playerAccount';
import { levelForKarma } from '../services/karma';
import { getLanguage, subscribeLanguageChange, t } from '../i18n';
import { renderAvatarContent } from './avatar';

export type ProfileScreenHandle = {
  destroy: () => void;
};

type ProfileScreenOptions = {
  onBack: () => void;
};

const MAX_MATCHES = 20;
const MAX_OPPONENTS_SHOWN = 4;

/**
 * Full-screen DOM profile overlay rendered on top of the lobby, mirroring the
 * settings screen lifecycle (lobby stays mounted underneath, caller re-shows
 * it on back). Stats come from the live auth session; match history is fetched
 * once per mount and never throws into the UI.
 */
export function mountProfileScreen(
  root: HTMLElement,
  { onBack }: ProfileScreenOptions,
): ProfileScreenHandle {
  let authSession: AuthSession = getCurrentAuthSession();
  let matchesState: 'loading' | 'ready' = 'loading';
  let matches: MatchSummary[] = [];
  let destroyed = false;

  const container = document.createElement('div');
  container.className = 'st-root';
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-modal', 'true');
  container.setAttribute('aria-label', t('profile.title'));
  container.innerHTML = renderShell();
  root.appendChild(container);

  const backBtn = container.querySelector<HTMLButtonElement>('[data-action="back"]')!;
  const titleEl = container.querySelector<HTMLElement>('.st-title')!;
  const avatarEl = container.querySelector<HTMLElement>('.pf-avatar')!;
  const nameEl = container.querySelector<HTMLElement>('.pf-name')!;
  const memberEl = container.querySelector<HTMLElement>('.pf-member')!;
  const statsCard = container.querySelector<HTMLElement>('.st-card--stats')!;
  const statsTitle = container.querySelector<HTMLElement>('[data-i18n="statsTitle"]')!;
  const statsGrid = container.querySelector<HTMLElement>('.pf-stats-grid')!;
  const karmaCard = container.querySelector<HTMLElement>('.st-card--karma')!;
  const karmaTitle = container.querySelector<HTMLElement>('[data-i18n="karmaTitle"]')!;
  const karmaLevelEl = container.querySelector<HTMLElement>('.pf-karma-level')!;
  const karmaPointsEl = container.querySelector<HTMLElement>('.pf-karma-points')!;
  const karmaBarEl = container.querySelector<HTMLElement>('.pf-karma-bar')!;
  const karmaProgressEl = container.querySelector<HTMLElement>('.pf-karma-progress')!;
  const historyCard = container.querySelector<HTMLElement>('.st-card--history')!;
  const historyTitle = container.querySelector<HTMLElement>('[data-i18n="historyTitle"]')!;
  const historyBody = container.querySelector<HTMLElement>('.pf-history-body')!;
  const authCard = container.querySelector<HTMLElement>('.st-card--auth')!;

  const isSignedIn = (): boolean => Boolean(authSession.user);

  const formatDate = (epochMs: number | null): string => {
    if (epochMs === null) {
      return '—';
    }
    return new Date(epochMs).toLocaleDateString(getLanguage(), {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDuration = (durationMs: number): string => {
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const formatMemberSince = (): string => {
    const creationTime = authSession.user?.metadata?.creationTime;
    if (!creationTime) {
      return t('profile.memberSinceUnknown');
    }
    const parsed = new Date(creationTime);
    if (Number.isNaN(parsed.getTime())) {
      return t('profile.memberSinceUnknown');
    }
    return t('profile.memberSince', {
      date: parsed.toLocaleDateString(getLanguage(), {
        month: 'long',
        year: 'numeric',
      }),
    });
  };

  const statName = (): string =>
    authSession.profile?.nickname ||
    authSession.user?.displayName ||
    authSession.user?.email ||
    '—';

  const renderHeader = () => {
    const signedIn = isSignedIn();
    const headerName = signedIn ? statName() : t('profile.guest.name');
    renderAvatarContent(avatarEl, {
      photoURL: authSession.user?.photoURL,
      name: headerName,
    });
    nameEl.textContent = headerName;
    memberEl.textContent = signedIn ? formatMemberSince() : t('profile.guest.subtitle');
    memberEl.hidden = false;
  };

  const statTile = (label: string, value: string): HTMLElement => {
    const tile = document.createElement('div');
    tile.className = 'pf-stat';
    const valueEl = document.createElement('span');
    valueEl.className = 'pf-stat-value';
    valueEl.textContent = value;
    const labelEl = document.createElement('span');
    labelEl.className = 'pf-stat-label';
    labelEl.textContent = label;
    tile.append(valueEl, labelEl);
    return tile;
  };

  const renderStats = () => {
    const stats = authSession.profile?.stats ?? { gamesPlayed: 0, gamesWon: 0, gamesLost: 0 };
    const winRate =
      stats.gamesPlayed > 0
        ? `${Math.round((stats.gamesWon / stats.gamesPlayed) * 100)}%`
        : '—';

    statsGrid.innerHTML = '';
    statsGrid.append(
      statTile(t('profile.stats.gamesPlayed'), String(stats.gamesPlayed)),
      statTile(t('profile.stats.gamesWon'), String(stats.gamesWon)),
      statTile(t('profile.stats.gamesLost'), String(stats.gamesLost)),
      statTile(t('profile.stats.winRate'), winRate),
    );
  };

  const renderKarma = () => {
    const total = authSession.profile?.stats?.karma ?? 0;
    const { level, currentLevelKarma, nextLevelKarma, progress } = levelForKarma(total);
    const percent = Math.round(progress * 100);
    const remaining = Math.max(0, nextLevelKarma - currentLevelKarma);

    karmaLevelEl.textContent = t('profile.karma.level', { level });
    karmaPointsEl.textContent = t('profile.karma.points', { points: total });
    karmaProgressEl.textContent = t('profile.karma.progress', {
      remaining,
      next: level + 1,
    });
    karmaBarEl.style.setProperty('--pf-karma-fill', `${percent}%`);
    karmaBarEl.setAttribute('aria-valuenow', String(percent));
    karmaBarEl.setAttribute(
      'aria-valuetext',
      t('profile.karma.progressLabel', {
        level,
        current: currentLevelKarma,
        total: nextLevelKarma,
      }),
    );
  };

  const renderMatchRow = (match: MatchSummary): HTMLElement => {
    const row = document.createElement('article');
    row.className = 'pf-match';

    const head = document.createElement('div');
    head.className = 'pf-match-head';

    const result = document.createElement('span');
    result.className = match.didWin ? 'pf-result pf-result--win' : 'pf-result pf-result--loss';
    result.textContent = match.didWin
      ? `🏆 ${t('profile.history.win')}`
      : `✖ ${t('profile.history.loss')}`;

    const date = document.createElement('span');
    date.className = 'pf-match-date';
    date.textContent = formatDate(match.playedAt);

    head.append(result, date);

    const meta = document.createElement('div');
    meta.className = 'pf-match-meta';

    const shownOpponents = match.opponents.slice(0, MAX_OPPONENTS_SHOWN);
    const opponentsLabel = shownOpponents.length
      ? t('profile.history.opponents', {
          names:
            shownOpponents.join(', ') +
            (match.opponents.length > MAX_OPPONENTS_SHOWN ? '…' : ''),
        })
      : t('profile.history.noOpponents');

    const opponents = document.createElement('span');
    opponents.className = 'pf-match-opponents';
    opponents.textContent = opponentsLabel;

    const stats = document.createElement('span');
    stats.className = 'pf-match-stats';
    stats.textContent = `${t('profile.history.duration', {
      duration: formatDuration(match.durationMs),
    })} · ${t('profile.history.turns', { turns: String(match.turns) })}`;

    meta.append(opponents, stats);
    row.append(head, meta);
    return row;
  };

  const renderHistory = () => {
    historyBody.innerHTML = '';

    if (!isSignedIn()) {
      historyCard.hidden = true;
      return;
    }
    historyCard.hidden = false;

    if (matchesState === 'loading') {
      const loading = document.createElement('p');
      loading.className = 'pf-history-state';
      loading.setAttribute('aria-live', 'polite');
      loading.textContent = t('profile.history.loading');
      historyBody.appendChild(loading);
      return;
    }

    if (matches.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pf-history-state';
      empty.textContent = t('profile.history.empty');
      historyBody.appendChild(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'pf-match-list';
    matches.forEach((match) => list.appendChild(renderMatchRow(match)));
    historyBody.appendChild(list);
  };

  const renderAuthCard = () => {
    authCard.innerHTML = '';

    if (isSignedIn()) {
      authCard.hidden = true;
      return;
    }
    authCard.hidden = false;

    const title = document.createElement('h2');
    title.className = 'st-card-title';
    title.textContent = t('profile.auth.title');

    const message = document.createElement('p');
    message.className = 'pf-auth-message';

    if (isAuthenticationAvailable()) {
      message.textContent = t('profile.auth.message');
      const signInBtn = document.createElement('button');
      signInBtn.type = 'button';
      signInBtn.className = 'st-btn st-btn--primary';
      signInBtn.textContent = t('profile.auth.signIn');
      signInBtn.addEventListener('click', () => void handleSignIn());
      authCard.append(title, message, signInBtn);
    } else {
      message.textContent = t('profile.auth.unavailable');
      authCard.append(title, message);
    }
  };

  const renderAll = () => {
    titleEl.textContent = t('profile.title');
    backBtn.textContent = t('profile.back');
    statsTitle.textContent = t('profile.stats.title');
    karmaTitle.textContent = t('profile.karma.title');
    historyTitle.textContent = t('profile.history.title');
    statsCard.hidden = !isSignedIn();
    karmaCard.hidden = !isSignedIn();
    renderHeader();
    renderStats();
    renderKarma();
    renderHistory();
    renderAuthCard();
  };

  async function handleSignIn(): Promise<void> {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('[profile] Falha ao conectar com Google', error);
    }
  }

  async function loadMatches(): Promise<void> {
    if (!isSignedIn()) {
      return;
    }
    matchesState = 'loading';
    renderHistory();
    const recent = await fetchRecentMatches(MAX_MATCHES);
    if (destroyed) {
      return;
    }
    matches = recent;
    matchesState = 'ready';
    renderHistory();
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onBack();
    }
  };

  backBtn.addEventListener('click', () => onBack());
  document.addEventListener('keydown', handleKeydown);

  const unsubscribeAuth = subscribeAuthSession((session) => {
    const wasSignedIn = isSignedIn();
    authSession = session;
    renderAll();
    if (!wasSignedIn && isSignedIn() && matchesState !== 'ready') {
      void loadMatches();
    }
  });
  const unsubscribeLanguage = subscribeLanguageChange(() => renderAll());

  renderAll();
  void loadMatches();
  backBtn.focus();

  return {
    destroy: () => {
      destroyed = true;
      unsubscribeAuth();
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
        <button type="button" class="st-btn st-btn--ghost st-back" data-action="back"></button>
      </header>
      <section class="st-card pf-header-card">
        <div class="pf-avatar" aria-hidden="true"></div>
        <div class="pf-identity">
          <span class="pf-name st-value"></span>
          <span class="pf-member st-label"></span>
        </div>
      </section>
      <section class="st-card st-card--stats">
        <h2 class="st-card-title" data-i18n="statsTitle"></h2>
        <div class="pf-stats-grid"></div>
      </section>
      <section class="st-card st-card--karma">
        <h2 class="st-card-title" data-i18n="karmaTitle"></h2>
        <div class="pf-karma">
          <div class="pf-karma-head">
            <span class="pf-karma-level"></span>
            <span class="pf-karma-points"></span>
          </div>
          <div class="pf-karma-track">
            <div class="pf-karma-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"></div>
          </div>
          <span class="pf-karma-progress"></span>
        </div>
      </section>
      <section class="st-card st-card--history">
        <h2 class="st-card-title" data-i18n="historyTitle"></h2>
        <div class="pf-history-body"></div>
      </section>
      <section class="st-card st-card--auth" hidden></section>
    </main>
  `;
}
