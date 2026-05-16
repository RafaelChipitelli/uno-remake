type AvatarSource = {
  photoURL?: string | null;
  /** Best display name / nickname to derive initials from when no photo. */
  name?: string | null;
};

function initialsFrom(name: string | null | undefined): string {
  const source = (name ?? '').trim() || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase() || '?';
}

/**
 * Builds the avatar inner content shared by the lobby menu and the profile
 * header: a Google photo when present (falling back to initials if the URL is
 * dead/throttled), otherwise an initials badge.
 */
export function renderAvatarContent(host: HTMLElement, { photoURL, name }: AvatarSource): void {
  host.innerHTML = '';

  const renderInitials = () => {
    const initials = document.createElement('span');
    initials.className = 'ts-avatar-initials';
    initials.setAttribute('aria-hidden', 'true');
    initials.textContent = initialsFrom(name);
    host.appendChild(initials);
  };

  if (photoURL) {
    const img = document.createElement('img');
    img.className = 'ts-avatar-img';
    img.src = photoURL;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => {
      img.remove();
      renderInitials();
    });
    host.appendChild(img);
  } else {
    renderInitials();
  }
}
