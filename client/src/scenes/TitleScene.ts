import Phaser from 'phaser';
import {
  getCurrentAuthSession,
  isAuthenticationAvailable,
  signInWithGoogle,
  signOutCurrentUser,
  subscribeAuthSession,
  updateCurrentUserNickname,
  type AuthSession,
} from '../services/playerAccount';
import { phaserTheme, theme } from '../theme/tokens';
import { askTextInput } from '../ui/modal';
import { getLanguage, setLanguage, subscribeLanguageChange, t, type Language } from '../i18n';

type ButtonConfig = {
  label: string;
  tone?: 'primary' | 'secondary' | 'danger' | 'neutral' | 'ghost';
  onClick: () => void | Promise<void>;
};

const FONT = '"Inter", system-ui, sans-serif';
const TEXT_RESOLUTION = Math.min(window.devicePixelRatio || 1, 2);
const DECOR_DEPTH = -10;
const MAX_NICKNAME_LENGTH = 20;
const NICKNAME_INPUT_LABEL = 'Username';

export default class TitleScene extends Phaser.Scene {
  private staticElements: Phaser.GameObjects.GameObject[] = [];
  private buttons: Phaser.GameObjects.Zone[] = [];
  private iconElements: Phaser.GameObjects.GameObject[] = [];
  private logoElements: Phaser.GameObjects.GameObject[] = [];
  private subtitleElements: Phaser.GameObjects.GameObject[] = [];
  private actionElements: Phaser.GameObjects.GameObject[] = [];
  private infoText?: Phaser.GameObjects.Text;
  private authStatusText?: Phaser.GameObjects.Text;
  private nicknameInput?: HTMLInputElement;
  private nicknameInputWrapper?: HTMLDivElement;
  private nicknameOutsidePointerHandler?: (event: PointerEvent) => void;
  private lastNickname = '';
  private authSession: AuthSession = getCurrentAuthSession();
  private unsubscribeAuthSession?: () => void;
  private unsubscribeLanguageChange?: () => void;
  private iconFloatBaseY = 0;
  private iconFloatContainer?: Phaser.GameObjects.Container;
  private isStartingGame = false;
  private resizeDebounceCall?: Phaser.Time.TimerEvent;
  private lastResizeWidth = 0;
  private lastResizeHeight = 0;
  private hasPlayedInitialEntry = false;

  constructor() {
    super('TitleScene');
  }

  create() {
    this.cameras.main.setBackgroundColor(theme.colors.bg.canvas);
    this.lastResizeWidth = this.scale.width;
    this.lastResizeHeight = this.scale.height;

    this.unsubscribeAuthSession = subscribeAuthSession((session) => {
      const previousLayoutKey = this.getAuthLayoutKey(this.authSession);
      this.authSession = session;
      const nextLayoutKey = this.getAuthLayoutKey(session);

      if (previousLayoutKey !== nextLayoutKey || this.staticElements.length === 0) {
        this.buildLayout();
      }
    });

    this.unsubscribeLanguageChange = subscribeLanguageChange(() => {
      this.buildLayout();
    });

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
      this.resizeDebounceCall?.remove();
      this.resizeDebounceCall = undefined;
      this.unsubscribeAuthSession?.();
      this.unsubscribeAuthSession = undefined;
      this.unsubscribeLanguageChange?.();
      this.unsubscribeLanguageChange = undefined;
      this.clearLayout();
    });
  }

  private getAuthLayoutKey(session: AuthSession): string {
    const stats = session.profile?.stats;
    return [
      session.isLoading ? '1' : '0',
      session.user?.uid ?? '',
      session.profile?.nickname ?? '',
      stats?.gamesPlayed ?? '',
      stats?.gamesWon ?? '',
      stats?.gamesLost ?? '',
    ].join('|');
  }

  private buildLayout() {
    this.clearLayout();

    const { width, height } = this.scale;
    const centerX = width / 2;
    const compact = width < 640 || height < 640;
    const frameScale = Phaser.Math.Clamp(Math.min(width / 1920, height / 1080), 0.82, 1.18);
    const layoutCenterY = compact ? height * 0.5 : height * 0.43;
    const rem = 16 * frameScale;
    // ETAPA 6.1 — vertical scale system (equivalent to --space-unit: 1rem)
    const spaceUnit = Math.round(16 * frameScale);
    const spaceSmall = Math.round(spaceUnit * 0.5);
    const spaceMedium = Math.round(spaceUnit * 1);
    const spaceExtra = Math.round(spaceUnit * 2);
    // ETAPA 6.5 — visual block grouping rhythm
    const intraBlockGap = spaceSmall;
    const intraBlockGapMedium = spaceMedium;
    const interBlockGap = spaceExtra;
    // ETAPA 6.3 — relative type scale hierarchy (rem based)
    const titleSize = Math.round(Phaser.Math.Clamp(rem * 3.4, 3.2 * 16, 3.8 * 16));
    const subtitleSize = Math.round(rem * 1);
    const inputFontSize = Math.max(16, Math.round(rem * 0.95));
    const primaryButtonFontSize = Math.round(rem * 1.2);
    const secondaryButtonFontSize = Math.round(rem * 0.85);
    const metaTextSize = Math.round(rem * 0.8);
    const infoSize = Math.round(rem * 0.9);
    const baseContentWidth = Math.min(width * 0.9, 28 * 16);
    const contentWidth = baseContentWidth;
    const identity = this.getIdentityDetails();

    this.createBackgroundDecorations(width, height);

    const iconRadius = compact ? 34 : 40;
    // ETAPA 6.4 — block height proportion rhythm
    const inputBlockHeight = Math.round(rem * 2.5);
    const buttonHeight = Math.round(inputBlockHeight * 1.28);
    const secondaryButtonBaseHeight = Math.round(inputBlockHeight * 0.8);

    const secondaryButtons = this.getSecondaryButtonConfigs();
    const secondaryBlockHeight = compact
      ? secondaryButtons.length * secondaryButtonBaseHeight + Math.max(0, secondaryButtons.length - 1) * spaceSmall
      : secondaryButtonBaseHeight;
    const hintEstimatedHeight = identity.hint ? Math.round(infoSize * 2.8) : 0;
    const blockHeight =
      iconRadius * 2 +
      intraBlockGapMedium + // icon -> title (top block)
      titleSize +
      intraBlockGap + // title -> subtitle (top block)
      subtitleSize +
      interBlockGap + // top block -> middle block
      inputBlockHeight +
      intraBlockGap + // input -> stats (middle block)
      metaTextSize +
      (identity.hint ? intraBlockGap + hintEstimatedHeight : 0) +
      interBlockGap + // middle block -> action block
      buttonHeight +
      intraBlockGapMedium + // primary -> secondary buttons (action block)
      secondaryBlockHeight +
      spaceMedium + // secondary buttons -> info text
      infoSize;
    let cursorY = layoutCenterY - blockHeight / 2;

    const iconContainer = this.add.container(centerX, cursorY + iconRadius);
    const iconGlow = this.add.ellipse(0, 4, iconRadius * 2.8, iconRadius * 1.8, phaserTheme.colors.action.primary.base, 0.2);
    const makeRoundedCard = (
      offsetX: number,
      offsetY: number,
      w: number,
      h: number,
      fill: number,
      fillAlpha: number,
      strokeColor: number,
      strokeAlpha: number,
      angle: number,
    ): Phaser.GameObjects.Graphics => {
      const r = Math.round(Math.min(w, h) * 0.22);
      const g = this.add.graphics();
      g.fillStyle(fill, fillAlpha);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.lineStyle(2, strokeColor, strokeAlpha);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
      g.setPosition(offsetX, offsetY).setAngle(angle);
      return g;
    };
    const cardBackLeft = makeRoundedCard(
      -16, 2, iconRadius * 1.1, iconRadius * 1.5,
      phaserTheme.colors.decor.cardBackLeft, 0.95,
      phaserTheme.colors.action.secondary.base, 0.45, -20,
    );
    const cardBackRight = makeRoundedCard(
      14, 3, iconRadius * 1.1, iconRadius * 1.5,
      phaserTheme.colors.decor.cardBackRight, 0.95,
      phaserTheme.colors.action.secondary.hover, 0.45, 16,
    );
    const cardFront = makeRoundedCard(
      0, -2, iconRadius * 1.2, iconRadius * 1.65,
      phaserTheme.colors.action.primary.base, 1,
      phaserTheme.colors.text.inverse, 0.75, -8,
    );
    const cardFrontMark = this.add
      .ellipse(0, -2, iconRadius * 0.95, iconRadius * 0.45, phaserTheme.colors.text.inverse, 0.18)
      .setAngle(-22);
    const cardFrontText = this.add
      .text(0, -2, 'UNO', {
        fontFamily: FONT,
        fontSize: Math.round(rem * 0.9),
        fontStyle: '800',
        color: theme.colors.text.inverse,
      })
      .setOrigin(0.5)
      .setAngle(-8)
      .setResolution(TEXT_RESOLUTION);
    const sparkle = this.add.circle(iconRadius * 0.9, -iconRadius * 0.7, 3, phaserTheme.colors.decor.sparkle, 0.95);

    iconContainer.add([iconGlow, cardBackLeft, cardBackRight, cardFront, cardFrontMark, cardFrontText, sparkle]);
    this.iconFloatContainer = iconContainer;
    this.iconFloatBaseY = iconContainer.y;
    this.staticElements.push(iconContainer);
    this.iconElements.push(iconContainer);
    cursorY += iconRadius * 2 + intraBlockGapMedium;

    const unoText = this.add
      .text(0, cursorY, 'UNO', {
        fontFamily: FONT,
        fontSize: titleSize,
        fontStyle: '800',
        color: theme.colors.text.primary,
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    const remakeText = this.add
      .text(0, cursorY, 'REMAKE', {
        fontFamily: FONT,
        fontSize: titleSize,
        fontStyle: '800',
        color: theme.colors.action.secondary.hover,
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    const titleGap = compact ? 10 : Math.round(14 * frameScale);
    const totalTitleWidth = unoText.width + remakeText.width + titleGap;
    unoText.setX(centerX - totalTitleWidth / 2 + unoText.width / 2);
    remakeText.setX(centerX + totalTitleWidth / 2 - remakeText.width / 2);
    this.staticElements.push(unoText, remakeText);
    this.logoElements.push(unoText, remakeText);
    cursorY += Math.max(unoText.height, remakeText.height) + intraBlockGap;

    const subtitle = this.add
      .text(centerX, cursorY, t('title.subtitle'), {
        fontFamily: FONT,
        fontSize: subtitleSize,
        color: theme.colors.text.secondary,
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(subtitle);
    this.subtitleElements.push(subtitle);
    cursorY += subtitle.height + interBlockGap;

    const profileBoxWidth = contentWidth;
    const profileBoxHeight = inputBlockHeight;
    this.createNicknameInput(
      centerX,
      cursorY + profileBoxHeight / 2,
      profileBoxWidth,
      profileBoxHeight,
      inputFontSize,
    );
    cursorY += profileBoxHeight + intraBlockGap;

    const statsLine = this.add
      .text(centerX, cursorY, identity.statsLabel, {
        fontFamily: FONT,
        fontSize: `${metaTextSize}px`,
        color: theme.colors.text.subtle,
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(statsLine);
    this.subtitleElements.push(statsLine);
    cursorY += statsLine.height;

    if (identity.hint) {
      cursorY += intraBlockGap;
      const authHint = this.add
        .text(centerX, cursorY, identity.hint, {
          fontFamily: FONT,
          fontSize: infoSize,
          color: theme.colors.text.muted,
          align: 'center',
          wordWrap: { width: contentWidth, useAdvancedWrap: true },
        })
        .setOrigin(0.5, 0)
        .setResolution(TEXT_RESOLUTION);
      this.staticElements.push(authHint);
      this.subtitleElements.push(authHint);
      cursorY += authHint.height + interBlockGap;
    } else {
      cursorY += interBlockGap;
    }

    const primaryButtonY = cursorY + buttonHeight / 2;
    this.createPrimaryActionButton(centerX, primaryButtonY, contentWidth, buttonHeight, primaryButtonFontSize, {
      label: t('title.primary.play'),
      onClick: () => this.handleQuickPlay(),
    });
    cursorY += buttonHeight + intraBlockGapMedium;

    const secondaryButtonY = cursorY + secondaryButtonBaseHeight / 2;
    const secondaryButtonGap = spaceSmall;
    const secondaryButtonWidth = compact
      ? contentWidth
      : Math.max(120, Math.round((contentWidth - secondaryButtonGap) / 2));
    if (compact) {
      secondaryButtons.forEach((config, index) => {
        this.createSecondaryActionButton(
          centerX,
          secondaryButtonY + index * (secondaryButtonBaseHeight + spaceSmall),
          secondaryButtonWidth,
          secondaryButtonBaseHeight,
          secondaryButtonFontSize,
          config,
        );
      });
    } else {
      secondaryButtons.forEach((config, index) => {
        const horizontalOffset = (secondaryButtonWidth + secondaryButtonGap) / 2;
        const offset = index === 0 ? -horizontalOffset : horizontalOffset;
        this.createSecondaryActionButton(
          centerX + offset,
          secondaryButtonY,
          secondaryButtonWidth,
          secondaryButtonBaseHeight,
          secondaryButtonFontSize,
          config,
        );
      });
    }
    cursorY += secondaryBlockHeight + spaceMedium;

    this.infoText = this.add
      .text(centerX, cursorY, this.getDefaultInfoMessage(), {
        fontFamily: FONT,
        fontSize: infoSize,
        color: theme.colors.text.muted,
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(this.infoText);
    this.subtitleElements.push(this.infoText);

    this.createTopRightAccountActions();
    this.createTopRightAuthStatus();

    if (!this.hasPlayedInitialEntry) {
      this.animateScreenEntry();
      this.hasPlayedInitialEntry = true;
    }
    this.startIconFloating();
  }

  private createTopRightAccountActions() {
    if (isAuthenticationAvailable() && this.authSession.user) {
      this.createTopRightSignOut();
      return;
    }

    if (isAuthenticationAvailable()) {
      this.createTopRightSignIn();
      return;
    }

    this.createLanguageSelector(this.scale.width - 32, 28);
  }

  private createTopRightSignIn() {
    const { width } = this.scale;
    const label = this.add
      .text(width - 32, 28, t('title.auth.signInGoogle'), {
        fontFamily: FONT,
        fontSize: '13px',
        color: theme.colors.text.muted,
      })
      .setOrigin(1, 0)
      .setResolution(TEXT_RESOLUTION);

    const zone = this.add
      .zone(label.x - label.width / 2, label.y + label.height / 2, label.width + 8, label.height + 8)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      label.setColor(theme.colors.text.primary);
      this.tweens.add({ targets: label, alpha: 1, duration: 150, ease: 'Sine.easeOut' });
    });
    zone.on('pointerout', () => {
      label.setColor(theme.colors.text.muted);
    });
    zone.on('pointerup', () => {
      void this.handleGoogleSignIn();
    });

    this.staticElements.push(label);
    this.buttons.push(zone);
    this.actionElements.push(label);

    this.createLanguageSelector(width - 32, 52);
  }

  private createTopRightSignOut() {
    const { width } = this.scale;
    const label = this.add
      .text(width - 32, 28, t('title.auth.signOutGoogle'), {
        fontFamily: FONT,
        fontSize: '13px',
        color: theme.colors.text.muted,
      })
      .setOrigin(1, 0)
      .setResolution(TEXT_RESOLUTION);

    const zone = this.add
      .zone(label.x - label.width / 2, label.y + label.height / 2, label.width + 8, label.height + 8)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      label.setColor(theme.colors.text.primary);
      this.tweens.add({ targets: label, alpha: 1, duration: 150, ease: 'Sine.easeOut' });
    });
    zone.on('pointerout', () => {
      label.setColor(theme.colors.text.muted);
    });
    zone.on('pointerup', () => {
      void this.handleGoogleSignOut();
    });

    this.staticElements.push(label);
    this.buttons.push(zone);
    this.actionElements.push(label);

    this.createLanguageSelector(width - 32, 52);
  }

  private createTopRightAuthStatus() {
    if (!this.authSession.isLoading) {
      return;
    }

    const { width } = this.scale;
    this.authStatusText = this.add
      .text(width - 32, 46, t('title.auth.checkingSession'), {
        fontFamily: FONT,
        fontSize: '13px',
        color: theme.colors.text.muted,
      })
      .setOrigin(1, 0)
      .setAlpha(0.9)
      .setResolution(TEXT_RESOLUTION);

    this.staticElements.push(this.authStatusText);
    this.actionElements.push(this.authStatusText);
  }

  private createLanguageSelector(anchorRightX: number, y: number): void {
    const activeLanguage = getLanguage();
    const items: Array<{ language: Language; flag: string; offsetX: number }> = [
      { language: 'pt-BR', flag: t('language.flag.br'), offsetX: -22 },
      { language: 'en-US', flag: t('language.flag.us'), offsetX: 0 },
    ];

    items.forEach((item) => {
      const isActive = item.language === activeLanguage;
      const label = this.add
        .text(anchorRightX + item.offsetX, y, item.flag, {
          fontFamily: FONT,
          fontSize: '18px',
          color: isActive ? theme.colors.text.primary : theme.colors.text.muted,
        })
        .setOrigin(1, 0)
        .setAlpha(isActive ? 1 : 0.8)
        .setResolution(TEXT_RESOLUTION);

      const zone = this.add
        .zone(label.x - label.width / 2, label.y + label.height / 2, label.width + 8, label.height + 8)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      zone.on('pointerup', () => {
        setLanguage(item.language);
        this.showToast(t('title.language.changed'));
      });

      zone.on('pointerover', () => {
        label.setColor(theme.colors.text.primary);
      });

      zone.on('pointerout', () => {
        label.setColor(isActive ? theme.colors.text.primary : theme.colors.text.muted);
      });

      this.staticElements.push(label);
      this.buttons.push(zone);
      this.actionElements.push(label);
    });
  }

  private createBackgroundDecorations(width: number, height: number) {
    const leftGlow = this.add
      .ellipse(width * 0.16, height * 0.24, width * 0.4, height * 0.44, phaserTheme.colors.action.secondary.base, 0.08)
      .setDepth(DECOR_DEPTH);
    const rightGlow = this.add
      .ellipse(width * 0.86, height * 0.76, width * 0.44, height * 0.48, phaserTheme.colors.action.primary.base, 0.08)
      .setDepth(DECOR_DEPTH);

    const ambientDecor = [
      { text: '⟲', x: width * 0.1, y: height * 0.18, size: 76, color: theme.colors.action.secondary.base, alpha: 0.08, angle: -18 },
      { text: '⊘', x: width * 0.9, y: height * 0.18, size: 70, color: theme.colors.action.primary.base, alpha: 0.07, angle: 16 },
      { text: '+4', x: width * 0.83, y: height * 0.52, size: 58, color: theme.colors.action.danger.base, alpha: 0.08, angle: -14 },
      { text: 'UNO', x: width * 0.16, y: height * 0.58, size: 52, color: theme.colors.status.success, alpha: 0.06, angle: -12 },
      { text: '↺', x: width * 0.5, y: height * 0.12, size: 58, color: theme.colors.text.muted, alpha: 0.05, angle: 0 },
    ];

    const bottomCards = [
      { x: width * 0.42, y: height + 32, w: 104, h: 146, color: phaserTheme.colors.action.secondary.base, angle: -24, label: 'SKIP' },
      { x: width * 0.48, y: height + 24, w: 108, h: 150, color: phaserTheme.colors.action.danger.base, angle: -10, label: 'REVERSE' },
      { x: width * 0.54, y: height + 22, w: 110, h: 154, color: phaserTheme.colors.action.primary.base, angle: 8, label: '+4' },
      { x: width * 0.6, y: height + 30, w: 104, h: 146, color: phaserTheme.colors.status.success, angle: 18, label: 'UNO' },
      { x: width * 0.66, y: height + 44, w: 96, h: 136, color: phaserTheme.colors.action.secondary.base, angle: 28, label: 'DECK' },
    ];

    // Deep radial vignette darkening the edges, like Richup's lobby backdrop.
    const vignette = this.add.graphics().setDepth(DECOR_DEPTH - 5);
    vignette.fillStyle(phaserTheme.colors.decor.shadowDeep, 0.55);
    vignette.fillRect(0, 0, width, height);
    vignette.fillStyle(phaserTheme.colors.bg.canvas, 0.92);
    vignette.fillEllipse(width / 2, height * 0.46, width * 1.05, height * 1.15);

    this.staticElements.push(vignette, leftGlow, rightGlow);

    ambientDecor.forEach((item, index) => {
      const symbol = this.add
        .text(item.x, item.y, item.text, {
          fontFamily: FONT,
          fontSize: `${item.size}px`,
          fontStyle: '800',
          color: item.color,
        })
        .setOrigin(0.5)
        .setAlpha(item.alpha)
        .setAngle(item.angle)
        .setResolution(TEXT_RESOLUTION)
        .setDepth(DECOR_DEPTH);
      this.tweens.add({
        targets: symbol,
        y: item.y - 14,
        angle: item.angle + 3,
        duration: 3600 + index * 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.staticElements.push(symbol);
    });

    bottomCards.forEach((item) => {
      const glow = this.add
        .ellipse(item.x, item.y - item.h * 0.25, item.w * 1.1, item.h * 0.5, item.color, 0.08)
        .setDepth(DECOR_DEPTH);
      const card = this.add
        .rectangle(item.x, item.y, item.w, item.h, item.color, 0.1)
        .setStrokeStyle(2, phaserTheme.colors.text.inverse, 0.12)
        .setAngle(item.angle)
        .setDepth(DECOR_DEPTH);
      const cardLabel = this.add
        .text(item.x, item.y, item.label, {
          fontFamily: FONT,
          fontSize: '15px',
          fontStyle: '700',
          color: theme.colors.text.primary,
        })
        .setOrigin(0.5)
        .setAngle(item.angle)
        .setAlpha(0.1)
        .setResolution(TEXT_RESOLUTION)
        .setDepth(DECOR_DEPTH);

      this.staticElements.push(glow, card, cardLabel);
    });
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    if (gameSize.width === this.lastResizeWidth && gameSize.height === this.lastResizeHeight) {
      return;
    }

    this.lastResizeWidth = gameSize.width;
    this.lastResizeHeight = gameSize.height;
    this.cameras.resize(gameSize.width, gameSize.height);

    this.resizeDebounceCall?.remove();
    this.resizeDebounceCall = this.time.delayedCall(80, () => {
      this.buildLayout();
      this.resizeDebounceCall = undefined;
    });
  }

  private startIconFloating() {
    if (!this.iconFloatContainer) {
      return;
    }

    this.iconFloatContainer.setY(this.iconFloatBaseY);
    this.tweens.addCounter({
      from: 0,
      to: Math.PI * 2,
      duration: 3000,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const value = tween.getValue() ?? 0;
        this.iconFloatContainer?.setY(this.iconFloatBaseY + Math.sin(value) * 6);
      },
    });
  }

  private createPrimaryActionButton(
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    config: ButtonConfig,
  ) {
    this.createRoundedButton(x, y, width, height, fontSize, config, 'primary');
  }

  private createSecondaryActionButton(
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    config: ButtonConfig,
  ) {
    this.createRoundedButton(x, y, width, height, fontSize, config, 'secondary');
  }

  // Richup-style soft pill button: rounded corners, ambient glow, depth shadow,
  // and a subtle lift on hover. Phaser's rectangle GameObject can't round
  // corners, so the body is drawn with Graphics and redrawn on state change.
  private createRoundedButton(
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    config: ButtonConfig,
    variant: 'primary' | 'secondary',
  ) {
    const palette =
      variant === 'primary' ? phaserTheme.colors.action.primary : phaserTheme.colors.action.neutral;
    const radius = Math.min(20, Math.round(height * 0.34));
    const container = this.add.container(x, y);

    const glow = this.add
      .ellipse(0, height * 0.34, width * 1.04, height * 1.15, palette.base, variant === 'primary' ? 0.26 : 0.16)
      .setOrigin(0.5);
    const shadow = this.add.graphics();
    shadow.fillStyle(palette.shadow, variant === 'primary' ? 0.5 : 0.42);
    shadow.fillRoundedRect(-width / 2, -height / 2 + 5, width, height, radius);

    const body = this.add.graphics();
    const drawBody = (fill: number, fillAlpha: number) => {
      body.clear();
      body.fillStyle(fill, fillAlpha);
      body.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
      body.lineStyle(1.5, palette.border, variant === 'primary' ? 0.85 : 0.6);
      body.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
      // Top sheen for a soft 3D pill feel.
      body.fillStyle(phaserTheme.colors.text.inverse, variant === 'primary' ? 0.1 : 0.05);
      body.fillRoundedRect(-width / 2 + 3, -height / 2 + 3, width - 6, height * 0.42, radius * 0.7);
    };
    drawBody(palette.base, variant === 'primary' ? 0.95 : 0.85);

    const label = this.add
      .text(0, 0, config.label, {
        fontFamily: FONT,
        fontSize: `${fontSize}px`,
        color: variant === 'primary' ? theme.colors.text.inverse : theme.colors.text.secondary,
        fontStyle: variant === 'primary' ? '700' : '600',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);

    container.add([glow, shadow, body, label]);

    const zone = this.add
      .zone(x, y, width, height)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const idleGlow = variant === 'primary' ? 0.26 : 0.16;
    const hoverGlow = variant === 'primary' ? 0.42 : 0.28;
    const lift = (active: boolean) => {
      this.tweens.killTweensOf(container);
      this.tweens.killTweensOf(glow);
      this.tweens.add({
        targets: container,
        y: active ? y - 3 : y,
        scaleX: active ? 1.025 : 1,
        scaleY: active ? 1.025 : 1,
        duration: 120,
        ease: 'Quad.easeOut',
      });
      this.tweens.add({ targets: glow, alpha: active ? hoverGlow : idleGlow, duration: 120 });
    };

    zone.on('pointerover', () => {
      drawBody(palette.hover, variant === 'primary' ? 1 : 0.95);
      lift(true);
    });
    zone.on('pointerout', () => {
      drawBody(palette.base, variant === 'primary' ? 0.95 : 0.85);
      lift(false);
    });
    zone.on('pointerdown', () => {
      this.tweens.killTweensOf(container);
      this.tweens.add({ targets: container, scaleX: 0.97, scaleY: 0.97, duration: 90, ease: 'Quad.easeInOut' });
    });
    zone.on('pointerup', () => {
      this.tweens.killTweensOf(container);
      this.tweens.add({ targets: container, scaleX: 1.025, scaleY: 1.025, duration: 90, ease: 'Quad.easeOut' });
      void config.onClick();
    });

    this.staticElements.push(container);
    this.buttons.push(zone);
    this.actionElements.push(container);
  }

  private handleQuickPlay() {
    void this.startGameScene('quick_play');
  }

  private handleCreateRoom() {
    void this.startGameScene('create_private');
  }

  private handleJoinRoom() {
    void this.startGameScene('join');
  }

  private async startGameScene(autoAction: 'quick_play' | 'create_private' | 'join'): Promise<void> {
    if (this.isStartingGame) {
      return;
    }

    this.isStartingGame = true;
    this.setButtonsEnabled(false);

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
        )?.trim().toUpperCase();
        if (!roomCode) {
          this.showInfo(t('title.joinRoom.invalidCode'));
          return;
        }
      }

      const nickname = await this.ensureNicknameForPlay();
      if (!nickname) {
        this.showInfo(t('title.start.noNickname'));
        return;
      }

      this.scene.start('GameScene', {
        autoAction,
        nickname,
        roomCode,
      });
    } finally {
      this.isStartingGame = false;
      this.setButtonsEnabled(true);
    }
  }

  private setButtonsEnabled(enabled: boolean): void {
    this.buttons.forEach((button) => {
      if (enabled) {
        button.setInteractive({ useHandCursor: true });
      } else {
        button.disableInteractive();
      }
    });
  }

  private getSecondaryButtonConfigs(): ButtonConfig[] {
    return [
      { label: t('title.secondary.createPrivate'), tone: 'secondary', onClick: () => this.handleCreateRoom() },
      { label: t('title.secondary.joinCode'), tone: 'secondary', onClick: () => this.handleJoinRoom() },
    ];
  }

  private getIdentityDetails(): { nickname: string; statsLabel: string; hint?: string } {
    if (!isAuthenticationAvailable()) {
      return {
        nickname: this.getPreferredNickname(),
        statsLabel: t('title.identity.stats.empty'),
        hint: t('title.identity.hint.firebaseDisabled'),
      };
    }

    if (this.authSession.isLoading) {
      return {
        nickname: this.getPreferredNickname(),
        statsLabel: t('title.identity.stats.loading'),
      };
    }

    if (!this.authSession.user) {
      return {
        nickname: this.getPreferredNickname(),
        statsLabel: t('title.identity.stats.empty'),
        hint: t('title.identity.hint.loginForStats'),
      };
    }

    const nickname = this.getPreferredNickname();
    const stats = this.authSession.profile?.stats;
    const statsLabel = stats
      ? t('title.identity.stats.dynamic', { gamesPlayed: stats.gamesPlayed, gamesWon: stats.gamesWon })
      : t('title.identity.stats.empty');

    return {
      nickname,
      statsLabel,
    };
  }

  private getDefaultInfoMessage(): string {
    return t('title.info.chooseOption');
  }

  private async handleGoogleSignIn(): Promise<void> {
    try {
      await signInWithGoogle();
      this.showToast(t('title.auth.connectedSuccess'));
    } catch (error) {
      console.error('[auth] Falha no login com Google', error);
      this.showInfo(this.getGoogleSignInErrorMessage(error));
    }
  }

  private showToast(message: string) {
    const { width } = this.scale;
    const toast = this.add.container(width / 2, 24).setDepth(60).setAlpha(0);
    const bg = this.add.graphics();
    bg.fillStyle(phaserTheme.colors.status.success, 0.34);
    bg.lineStyle(1, phaserTheme.colors.status.success, 0.65);
    bg.fillRoundedRect(-128, -18, 256, 36, 8);
    bg.strokeRoundedRect(-128, -18, 256, 36, 8);
    const label = this.add
      .text(0, 0, message, {
        fontFamily: FONT,
        fontSize: '14px',
        color: theme.colors.text.success,
        fontStyle: '600',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    toast.add([bg, label]);

    this.tweens.add({
      targets: toast,
      alpha: 1,
      y: 40,
      duration: 180,
      ease: 'Sine.easeOut',
    });

    this.time.delayedCall(1900, () => {
      this.tweens.add({
        targets: toast,
        alpha: 0,
        y: 28,
        duration: 200,
        ease: 'Sine.easeIn',
        onComplete: () => toast.destroy(true),
      });
    });
  }

  private getGoogleSignInErrorMessage(error: unknown): string {
    const firebaseLikeError = error as { code?: string; message?: string } | null;
    const code = firebaseLikeError?.code;

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
  }

  private async handleGoogleSignOut(): Promise<void> {
    try {
      await signOutCurrentUser();
      this.showInfo(t('title.auth.signedOut'));
    } catch (error) {
      console.error('[auth] Falha ao sair da conta', error);
      this.showInfo(t('title.auth.signOutError'));
    }
  }

  private showInfo(message: string) {
    this.infoText?.setText(message);
    if (this.infoText) {
      this.tweens.add({
        targets: this.infoText,
        alpha: 0.3,
        yoyo: true,
        repeat: 1,
        duration: 150,
      });
    }
  }

  private sanitizeNickname(rawNickname: string | null | undefined): string {
    return rawNickname?.trim().slice(0, MAX_NICKNAME_LENGTH) ?? '';
  }

  private sanitizeNicknameDraft(rawNickname: string | null | undefined): string {
    return rawNickname?.slice(0, MAX_NICKNAME_LENGTH) ?? '';
  }

  private getPreferredNickname(): string {
    return this.sanitizeNickname(
      this.lastNickname || this.authSession.profile?.nickname || this.authSession.user?.displayName || 'Player',
    );
  }

  private createNicknameInput(
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
  ): void {
    this.destroyNicknameInput();

    const appRoot = document.getElementById('app');
    if (!appRoot) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'title-form-control';
    wrapper.style.left = `${x - width / 2}px`;
    wrapper.style.top = `${y - height / 2 - 8}px`;
    wrapper.style.width = `${width}px`;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = MAX_NICKNAME_LENGTH;
    input.value = '';
    input.style.fontSize = `${fontSize}px`;
    input.setAttribute('aria-label', t('title.nickname.title'));
    input.required = true;

    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');

    [...NICKNAME_INPUT_LABEL].forEach((letter, index) => {
      const span = document.createElement('span');
      span.textContent = letter;
      span.style.transitionDelay = `${index * 50}ms`;
      label.appendChild(span);
    });

    const syncFilledState = () => {
      wrapper.classList.toggle('is-filled', this.sanitizeNickname(input.value).length > 0);
    };

    input.addEventListener('input', () => {
      const sanitizedDraft = this.sanitizeNicknameDraft(input.value);
      if (input.value !== sanitizedDraft) {
        input.value = sanitizedDraft;
      }
      this.lastNickname = this.sanitizeNickname(input.value);
      syncFilledState();
    });

    input.addEventListener('blur', syncFilledState);
    input.addEventListener('focus', syncFilledState);

    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        input.blur();
      }
    });

    input.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });

    this.nicknameOutsidePointerHandler = (event: PointerEvent) => {
      if (!this.nicknameInput || !this.nicknameInputWrapper) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && this.nicknameInputWrapper.contains(target)) {
        return;
      }

      this.nicknameInput.blur();
    };
    window.addEventListener('pointerdown', this.nicknameOutsidePointerHandler);

    wrapper.append(input, label);
    appRoot.appendChild(wrapper);

    this.nicknameInputWrapper = wrapper;
    this.nicknameInput = input;
    this.lastNickname = this.sanitizeNickname(input.value);
    syncFilledState();
  }

  private destroyNicknameInput(): void {
    if (this.nicknameOutsidePointerHandler) {
      window.removeEventListener('pointerdown', this.nicknameOutsidePointerHandler);
      this.nicknameOutsidePointerHandler = undefined;
    }
    this.nicknameInputWrapper?.remove();
    this.nicknameInput = undefined;
    this.nicknameInputWrapper = undefined;
  }

  private getNicknameInputValue(): string {
    return this.sanitizeNickname(this.nicknameInput?.value ?? this.lastNickname);
  }

  private generateRandomNickname(): string {
    return `Player-${Phaser.Math.Between(1000, 9999)}`;
  }

  private async ensureNicknameForPlay(): Promise<string | undefined> {
    let nickname = this.getNicknameInputValue();
    if (!nickname) {
      nickname = this.generateRandomNickname();
      if (this.nicknameInput) {
        this.nicknameInput.value = nickname;
        this.nicknameInputWrapper?.classList.add('is-filled');
      }
    }

    this.lastNickname = nickname;
    if (this.nicknameInput && this.nicknameInput.value !== nickname) {
      this.nicknameInput.value = nickname;
    }

    if (this.authSession.user && nickname !== this.authSession.profile?.nickname) {
      try {
        await updateCurrentUserNickname(nickname);
      } catch (error) {
        console.error('[auth] Falha ao atualizar nickname no Firestore', error);
        this.showInfo(t('title.nickname.cloudSaveFailed'));
      }
    }

    return nickname;
  }

  private clearLayout() {
    this.tweens.killAll();
    this.destroyNicknameInput();
    this.staticElements.forEach((el) => el.destroy());
    this.buttons.forEach((btn) => btn.destroy());
    this.staticElements = [];
    this.buttons = [];
    this.iconElements = [];
    this.logoElements = [];
    this.subtitleElements = [];
    this.actionElements = [];
    this.iconFloatContainer = undefined;
  }

  private animateScreenEntry(): void {
    this.animateGroup(this.iconElements, 0, -16);
    this.animateGroup(this.logoElements, 120, 0);
    this.animateGroup(this.subtitleElements, 220, 0);
    this.animateGroup(this.actionElements, 320, 14);
  }

  private animateGroup(elements: Phaser.GameObjects.GameObject[], delay: number, startOffsetY: number) {
    elements.forEach((element, index) => {
      const target = element as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha;
      const finalY = target.y;
      target.setAlpha(0);
      target.setY(finalY + startOffsetY);
      this.tweens.add({
        targets: target,
        alpha: 1,
        y: finalY,
        duration: 240,
        delay: delay + index * 40,
        ease: 'Sine.easeOut',
      });
    });
  }

}
