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
import { askTextInput } from '../ui/modal';

type ButtonConfig = {
  label: string;
  tone?: 'primary' | 'secondary' | 'danger' | 'neutral' | 'ghost';
  onClick: () => void | Promise<void>;
};

const FONT = '"Inter", system-ui, sans-serif';
const TEXT_RESOLUTION = Math.min(window.devicePixelRatio || 1, 2);
const DECOR_DEPTH = -10;

export default class TitleScene extends Phaser.Scene {
  private staticElements: Phaser.GameObjects.GameObject[] = [];
  private buttons: Phaser.GameObjects.Zone[] = [];
  private iconElements: Phaser.GameObjects.GameObject[] = [];
  private logoElements: Phaser.GameObjects.GameObject[] = [];
  private subtitleElements: Phaser.GameObjects.GameObject[] = [];
  private actionElements: Phaser.GameObjects.GameObject[] = [];
  private infoText?: Phaser.GameObjects.Text;
  private lastNickname = '';
  private authSession: AuthSession = getCurrentAuthSession();
  private unsubscribeAuthSession?: () => void;
  private iconFloatBaseY = 0;
  private iconFloatContainer?: Phaser.GameObjects.Container;

  constructor() {
    super('TitleScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0B0F1A');

    this.unsubscribeAuthSession = subscribeAuthSession((session) => {
      this.authSession = session;
      this.buildLayout();
    });

    this.buildLayout();

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
      this.unsubscribeAuthSession?.();
      this.unsubscribeAuthSession = undefined;
      this.clearLayout();
    });
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
    const inputFontSize = Math.round(rem * 0.95);
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
    const iconGlow = this.add.ellipse(0, 4, iconRadius * 2.8, iconRadius * 1.8, 0x6c5ce7, 0.2);
    const cardBackLeft = this.add
      .rectangle(-16, 2, iconRadius * 1.1, iconRadius * 1.5, 0x263042, 0.95)
      .setStrokeStyle(2, 0x3a86ff, 0.45)
      .setAngle(-20)
      .setOrigin(0.5);
    const cardBackRight = this.add
      .rectangle(14, 3, iconRadius * 1.1, iconRadius * 1.5, 0x24314c, 0.95)
      .setStrokeStyle(2, 0x7ba8ff, 0.45)
      .setAngle(16)
      .setOrigin(0.5);
    const cardFront = this.add
      .rectangle(0, -2, iconRadius * 1.2, iconRadius * 1.65, 0x6c5ce7, 1)
      .setStrokeStyle(2, 0xffffff, 0.75)
      .setAngle(-8)
      .setOrigin(0.5);
    const cardFrontMark = this.add.ellipse(0, -2, iconRadius * 0.95, iconRadius * 0.45, 0xffffff, 0.18).setAngle(-22);
    const cardFrontText = this.add
      .text(0, -2, 'UNO', {
        fontFamily: FONT,
        fontSize: Math.round(rem * 0.9),
        fontStyle: '800',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAngle(-8)
      .setResolution(TEXT_RESOLUTION);
    const sparkle = this.add.circle(iconRadius * 0.9, -iconRadius * 0.7, 3, 0x9ec1ff, 0.95);

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
        color: '#E5E7EB',
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    const remakeText = this.add
      .text(0, cursorY, 'REMAKE', {
        fontFamily: FONT,
        fontSize: titleSize,
        fontStyle: '800',
        color: '#7BA8FF',
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
      .text(centerX, cursorY, 'Multiplayer em tempo real', {
        fontFamily: FONT,
        fontSize: subtitleSize,
        color: '#A8B3C8',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(subtitle);
    this.subtitleElements.push(subtitle);
    cursorY += subtitle.height + interBlockGap;

    const profileBoxWidth = contentWidth;
    const profileBoxHeight = inputBlockHeight;
    const profileShadow = this.add
      .rectangle(centerX, cursorY + profileBoxHeight / 2 + 3, profileBoxWidth, profileBoxHeight, 0x101723, 0.42)
      .setOrigin(0.5);
    const profileBox = this.add
      .rectangle(centerX, cursorY + profileBoxHeight / 2, profileBoxWidth, profileBoxHeight, 0x111827, 0.92)
      .setStrokeStyle(1, 0x2b3852, 0.9)
      .setOrigin(0.5);
    const profileName = this.add
      .text(centerX - profileBoxWidth / 2 + 14, cursorY + profileBoxHeight / 2, identity.nickname, {
        fontFamily: FONT,
        fontSize: `${inputFontSize}px`,
        color: '#E5E7EB',
        fontStyle: '600',
      })
      .setOrigin(0, 0.5)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(profileShadow, profileBox, profileName);
    this.subtitleElements.push(profileShadow, profileBox, profileName);
    cursorY += profileBoxHeight + intraBlockGap;

    const statsLine = this.add
      .text(centerX, cursorY, identity.statsLabel, {
        fontFamily: FONT,
        fontSize: `${metaTextSize}px`,
        color: '#8FA0BB',
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
          color: '#9CA3AF',
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
    const needsLogin = isAuthenticationAvailable() && !this.authSession.user;
    this.createPrimaryActionButton(centerX, primaryButtonY, contentWidth, buttonHeight, primaryButtonFontSize, {
      label: needsLogin ? '» Entrar' : '» Jogar',
      onClick: () => (needsLogin ? this.handleGoogleSignIn() : this.handleCreateRoom()),
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
        color: '#9CA3AF',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(this.infoText);
    this.subtitleElements.push(this.infoText);

    if (isAuthenticationAvailable() && this.authSession.user) {
      this.createTopRightSignOut();
    }

    this.animateScreenEntry();
    this.startIconFloating();
  }

  private createTopRightSignOut() {
    const { width } = this.scale;
    const label = this.add
      .text(width - 32, 28, 'Sair da Conta Google', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#9CA3AF',
      })
      .setOrigin(1, 0)
      .setResolution(TEXT_RESOLUTION);

    const zone = this.add
      .zone(label.x - label.width / 2, label.y + label.height / 2, label.width + 8, label.height + 8)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      label.setColor('#E5E7EB');
      this.tweens.add({ targets: label, alpha: 1, duration: 150, ease: 'Sine.easeOut' });
    });
    zone.on('pointerout', () => {
      label.setColor('#9CA3AF');
    });
    zone.on('pointerup', () => {
      void this.handleGoogleSignOut();
    });

    this.staticElements.push(label);
    this.buttons.push(zone);
    this.actionElements.push(label);
  }

  private createBackgroundDecorations(width: number, height: number) {
    const leftGlow = this.add
      .ellipse(width * 0.16, height * 0.24, width * 0.4, height * 0.44, 0x3a86ff, 0.08)
      .setDepth(DECOR_DEPTH);
    const rightGlow = this.add
      .ellipse(width * 0.86, height * 0.76, width * 0.44, height * 0.48, 0x6c5ce7, 0.08)
      .setDepth(DECOR_DEPTH);

    const ambientDecor = [
      { text: '⟲', x: width * 0.1, y: height * 0.18, size: 76, color: '#3A86FF', alpha: 0.08, angle: -18 },
      { text: '⊘', x: width * 0.9, y: height * 0.18, size: 70, color: '#6C5CE7', alpha: 0.07, angle: 16 },
      { text: '+4', x: width * 0.83, y: height * 0.52, size: 58, color: '#FF4D4D', alpha: 0.08, angle: -14 },
      { text: 'UNO', x: width * 0.16, y: height * 0.58, size: 52, color: '#22C55E', alpha: 0.06, angle: -12 },
      { text: '↺', x: width * 0.5, y: height * 0.12, size: 58, color: '#9CA3AF', alpha: 0.05, angle: 0 },
    ];

    const bottomCards = [
      { x: width * 0.42, y: height + 32, w: 104, h: 146, color: 0x3a86ff, angle: -24, label: 'SKIP' },
      { x: width * 0.48, y: height + 24, w: 108, h: 150, color: 0xff4d4d, angle: -10, label: 'REVERSE' },
      { x: width * 0.54, y: height + 22, w: 110, h: 154, color: 0x6c5ce7, angle: 8, label: '+4' },
      { x: width * 0.6, y: height + 30, w: 104, h: 146, color: 0x22c55e, angle: 18, label: 'UNO' },
      { x: width * 0.66, y: height + 44, w: 96, h: 136, color: 0x3a86ff, angle: 28, label: 'DECK' },
    ];

    this.staticElements.push(leftGlow, rightGlow);

    ambientDecor.forEach((item) => {
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
      this.staticElements.push(symbol);
    });

    bottomCards.forEach((item) => {
      const glow = this.add
        .ellipse(item.x, item.y - item.h * 0.25, item.w * 1.1, item.h * 0.5, item.color, 0.08)
        .setDepth(DECOR_DEPTH);
      const card = this.add
        .rectangle(item.x, item.y, item.w, item.h, item.color, 0.1)
        .setStrokeStyle(2, 0xffffff, 0.12)
        .setAngle(item.angle)
        .setDepth(DECOR_DEPTH);
      const cardLabel = this.add
        .text(item.x, item.y, item.label, {
          fontFamily: FONT,
          fontSize: '15px',
          fontStyle: '700',
          color: '#E5E7EB',
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
    this.cameras.resize(gameSize.width, gameSize.height);
    this.buildLayout();
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
    const palette = { base: 0x6c5ce7, hover: 0x7f70ef, border: 0x4f46b6, shadow: 0x2b2368 };
    const shadow = this.add.rectangle(x, y + 4, width, height, palette.shadow, 0.45).setOrigin(0.5);

    const buttonRect = this.add
      .rectangle(x, y, width, height, palette.base, 0.9)
      .setStrokeStyle(1, palette.border, 0.8)
      .setOrigin(0.5);
    const label = this.add
      .text(x, y, config.label, {
        fontFamily: FONT,
        fontSize,
        color: '#ffffff',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);

    const zone = this.add
      .zone(x, y, width, height)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      buttonRect.setFillStyle(palette.hover);
      this.tweens.add({ targets: [buttonRect, label, shadow], y: '-=2', scaleX: 1.02, scaleY: 1.02, duration: 200, ease: 'Quad.easeOut' });
      shadow.setAlpha(0.62);
    });
    zone.on('pointerout', () => {
      buttonRect.setFillStyle(palette.base);
      this.tweens.add({ targets: [buttonRect, label, shadow], y: y, scaleX: 1, scaleY: 1, duration: 200, ease: 'Quad.easeOut' });
      shadow.setAlpha(0.45);
    });
    zone.on('pointerdown', () => {
      this.tweens.add({ targets: [buttonRect, label, shadow], scaleX: 0.97, scaleY: 0.97, duration: 120, ease: 'Quad.easeInOut' });
    });
    zone.on('pointerup', () => {
      this.tweens.add({ targets: [buttonRect, label, shadow], scaleX: 1, scaleY: 1, duration: 120, ease: 'Quad.easeOut' });
      void config.onClick();
    });

    this.staticElements.push(shadow, buttonRect, label);
    this.buttons.push(zone);
    this.actionElements.push(shadow, buttonRect, label);
  }

  private createSecondaryActionButton(
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    config: ButtonConfig,
  ) {
    const palette = { base: 0x22253a, hover: 0x2a2f4a, border: 0x404a6a, shadow: 0x131722 };

    const shadow = this.add.rectangle(x, y + 3, width, height, palette.shadow, 0.42).setOrigin(0.5);
    const buttonRect = this.add
      .rectangle(x, y, width, height, palette.base, 0.86)
      .setStrokeStyle(1, palette.border, 0.75)
      .setOrigin(0.5);
    const label = this.add
      .text(x, y, config.label, {
        fontFamily: FONT,
        fontSize: `${fontSize}px`,
        color: '#C9D4EA',
        fontStyle: '600',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);

    const zone = this.add
      .zone(x, y, width, height)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      buttonRect.setFillStyle(palette.hover, 0.95);
      this.tweens.add({ targets: [buttonRect, label, shadow], y: '-=2', scaleX: 1.02, scaleY: 1.02, duration: 200, ease: 'Quad.easeOut' });
      shadow.setAlpha(0.58);
    });
    zone.on('pointerout', () => {
      buttonRect.setFillStyle(palette.base, 0.86);
      this.tweens.add({ targets: [buttonRect, label, shadow], y: y, scaleX: 1, scaleY: 1, duration: 200, ease: 'Quad.easeOut' });
      shadow.setAlpha(0.42);
    });
    zone.on('pointerdown', () => {
      this.tweens.add({ targets: [buttonRect, label, shadow], scaleX: 0.97, scaleY: 0.97, duration: 120, ease: 'Quad.easeInOut' });
    });
    zone.on('pointerup', () => {
      this.tweens.add({ targets: [buttonRect, label, shadow], scaleX: 1, scaleY: 1, duration: 120, ease: 'Quad.easeOut' });
      void config.onClick();
    });

    this.staticElements.push(shadow, buttonRect, label);
    this.buttons.push(zone);
    this.actionElements.push(shadow, buttonRect, label);
  }

  private handleCreateRoom() {
    void this.startGameScene('create');
  }

  private handleJoinRoom() {
    void this.startGameScene('join');
  }

  private async startGameScene(autoAction: 'create' | 'join'): Promise<void> {
    if (isAuthenticationAvailable() && !this.authSession.user) {
      this.showInfo('Faça login com Google para jogar e salvar progresso.');
      return;
    }

    let roomCode: string | undefined;
    if (autoAction === 'join') {
      roomCode = (
        await askTextInput({
          title: 'Entrar com código',
          message: 'Digite o código da sala para entrar no jogo.',
          placeholder: 'Ex: ABCD',
          confirmLabel: 'Entrar',
          cancelLabel: 'Cancelar',
        })
      )?.trim().toUpperCase();
      if (!roomCode) {
        this.showInfo('Informe um código válido.');
        return;
      }
    }

    const nickname = await this.promptNickname();
    if (!nickname && isAuthenticationAvailable()) {
      this.showInfo('Não foi possível iniciar sem nickname.');
      return;
    }

    this.scene.start('GameScene', {
      autoAction,
      nickname,
      roomCode,
    });
  }

  private getSecondaryButtonConfigs(): ButtonConfig[] {
    return [
      { label: 'Criar Sala', tone: 'secondary', onClick: () => this.handleCreateRoom() },
      { label: 'Entrar com Código', tone: 'secondary', onClick: () => this.handleJoinRoom() },
    ];
  }

  private getIdentityDetails(): { nickname: string; statsLabel: string; hint?: string } {
    if (!isAuthenticationAvailable()) {
      return {
        nickname: this.lastNickname || 'Jogador convidado',
        statsLabel: 'Partidas: 0 • Vitórias: 0',
        hint: 'Firebase não configurado no .env.local. Login e estatísticas ficam desativados.',
      };
    }

    if (this.authSession.isLoading) {
      return {
        nickname: 'Carregando perfil...',
        statsLabel: 'Partidas: -- • Vitórias: --',
        hint: 'Verificando sessão de login...',
      };
    }

    if (!this.authSession.user) {
      return {
        nickname: this.lastNickname || 'Jogador',
        statsLabel: 'Partidas: 0 • Vitórias: 0',
        hint: 'Faça login com Google para salvar nickname e estatísticas.',
      };
    }

    const nickname = this.authSession.profile?.nickname ?? this.authSession.user.displayName ?? 'Jogador';
    const stats = this.authSession.profile?.stats;
    const statsLabel = stats
      ? `Partidas: ${stats.gamesPlayed} • Vitórias: ${stats.gamesWon}`
      : 'Partidas: 0 • Vitórias: 0';

    return {
      nickname,
      statsLabel,
    };
  }

  private getDefaultInfoMessage(): string {
    if (isAuthenticationAvailable() && !this.authSession.user) {
      return 'Entre com Google para continuar';
    }

    return 'Escolha uma opção para continuar';
  }

  private async handleGoogleSignIn(): Promise<void> {
    try {
      await signInWithGoogle();
      this.showToast('Conectado com sucesso');
    } catch (error) {
      console.error('[auth] Falha no login com Google', error);
      this.showInfo(this.getGoogleSignInErrorMessage(error));
    }
  }

  private showToast(message: string) {
    const { width } = this.scale;
    const toast = this.add.container(width / 2, 24).setDepth(60).setAlpha(0);
    const bg = this.add.graphics();
    bg.fillStyle(0x14532d, 0.34);
    bg.lineStyle(1, 0x22c55e, 0.65);
    bg.fillRoundedRect(-128, -18, 256, 36, 8);
    bg.strokeRoundedRect(-128, -18, 256, 36, 8);
    const label = this.add
      .text(0, 0, message, {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#d1fae5',
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
        return 'Domínio não autorizado no Firebase. Adicione localhost (e 127.0.0.1, se usar) em Authentication > Settings > Authorized domains.';
      case 'auth/operation-not-allowed':
        return 'Login Google desativado no Firebase. Ative em Authentication > Sign-in method > Google.';
      case 'auth/popup-blocked':
        return 'O navegador bloqueou o popup de login. Permita popups para este site e tente novamente.';
      case 'auth/popup-closed-by-user':
        return 'Popup de login fechado antes de concluir. Tente novamente.';
      case 'auth/cancelled-popup-request':
        return 'Tentativa anterior de popup foi cancelada. Tente clicar no botão novamente.';
      case 'auth/network-request-failed':
        return 'Falha de rede ao conectar com Firebase. Verifique internet/VPN/firewall e tente novamente.';
      default:
        return code
          ? `Não foi possível fazer login com Google (${code}). Veja o console para mais detalhes.`
          : 'Não foi possível fazer login com Google. Veja o console para mais detalhes.';
    }
  }

  private async handleGoogleSignOut(): Promise<void> {
    try {
      await signOutCurrentUser();
      this.showInfo('Você saiu da conta Google.');
    } catch (error) {
      console.error('[auth] Falha ao sair da conta', error);
      this.showInfo('Não foi possível sair da conta agora.');
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

  private async promptNickname(): Promise<string | undefined> {
    if (isAuthenticationAvailable()) {
      const profileNickname = this.authSession.profile?.nickname;
      const fallbackNickname =
        profileNickname ?? this.authSession.user?.displayName ?? this.lastNickname ?? 'Player';

      const input =
        (await askTextInput({
          title: 'Escolha seu nickname',
          message: 'Esse nome aparecerá para os outros jogadores na sala.',
          placeholder: 'Digite seu nickname',
          initialValue: fallbackNickname,
          confirmLabel: 'Continuar',
          cancelLabel: 'Cancelar',
        })) ?? '';
      const finalNickname = input || fallbackNickname;

      if (!finalNickname) {
        return undefined;
      }

      this.lastNickname = finalNickname;

      if (finalNickname !== profileNickname && this.authSession.user) {
        try {
          await updateCurrentUserNickname(finalNickname);
        } catch (error) {
          console.error('[auth] Falha ao atualizar nickname no Firestore', error);
          this.showInfo('Nickname aplicado localmente, mas não foi salvo na nuvem.');
        }
      }

      return finalNickname;
    }

    const input =
      (await askTextInput({
        title: 'Escolha seu nickname',
        message: 'Digite o nome que será mostrado na partida.',
        placeholder: 'Digite seu nickname',
        initialValue: this.lastNickname || 'Player',
        confirmLabel: 'Continuar',
        cancelLabel: 'Cancelar',
      })) ?? '';
    if (input) {
      this.lastNickname = input;
    }

    return input || undefined;
  }

  private clearLayout() {
    this.tweens.killAll();
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
