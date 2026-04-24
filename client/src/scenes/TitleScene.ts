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
const SPACING_16 = 16;
const SPACING_24 = 24;
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
    const centerY = height / 2;
    const compact = width < 640 || height < 640;
    const fontScale = Math.max(0.75, Math.min(1, Math.min(width, height) / 900));
    const desktopTitleSize = Math.round(Math.min(64, Math.max(48, width * 0.055)));
    const titleSize = compact ? Math.max(38, Math.round(44 * fontScale)) : desktopTitleSize;
    const subtitleSize = Math.max(16, Math.round((compact ? 16 : 18) * fontScale));
    const infoSize = Math.max(14, Math.round((compact ? 14 : 16) * fontScale));
    const contentWidth = Math.min(compact ? 360 : 520, width * (compact ? 0.86 : 0.58));

    this.createBackgroundDecorations(width, height);

    const iconRadius = compact ? 34 : 40;
    const iconGap = compact ? SPACING_16 : SPACING_24;
    const subtitleGap = compact ? SPACING_16 : SPACING_24;
    const infoGap = SPACING_16;
    const buttonGap = SPACING_16;
    const buttonHeight = compact ? 54 : 60;
    const profileGap = compact ? 12 : 16;

    const secondaryButtons = this.getSecondaryButtonConfigs();
    const secondaryBlockHeight = compact
      ? secondaryButtons.length * 46 + Math.max(0, secondaryButtons.length - 1) * 10
      : 52;
    const blockHeight =
      iconRadius * 2 +
      iconGap +
      titleSize +
      subtitleGap +
      subtitleSize +
      infoGap +
      infoSize * 2.8 +
      SPACING_24 +
      buttonHeight +
      buttonGap +
      secondaryBlockHeight +
      SPACING_24;
    let cursorY = centerY - blockHeight / 2;

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
        fontSize: Math.max(14, Math.round((compact ? 14 : 16) * fontScale)),
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
    cursorY += iconRadius * 2 + iconGap;

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
    const titleGap = compact ? 10 : 14;
    const totalTitleWidth = unoText.width + remakeText.width + titleGap;
    unoText.setX(centerX - totalTitleWidth / 2 + unoText.width / 2);
    remakeText.setX(centerX + totalTitleWidth / 2 - remakeText.width / 2);
    this.staticElements.push(unoText, remakeText);
    this.logoElements.push(unoText, remakeText);
    cursorY += Math.max(unoText.height, remakeText.height) + subtitleGap;

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
    cursorY += subtitle.height + profileGap;

    const identity = this.getIdentityDetails();
    const profileBoxWidth = Math.min(contentWidth, compact ? 320 : 370);
    const profileBoxHeight = compact ? 42 : 46;
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
        fontSize: `${Math.max(13, Math.round((compact ? 14 : 15) * fontScale))}px`,
        color: '#E5E7EB',
        fontStyle: '600',
      })
      .setOrigin(0, 0.5)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(profileShadow, profileBox, profileName);
    this.subtitleElements.push(profileShadow, profileBox, profileName);
    cursorY += profileBoxHeight + 10;

    const statsLine = this.add
      .text(centerX, cursorY, identity.statsLabel, {
        fontFamily: FONT,
        fontSize: `${Math.max(12, Math.round((compact ? 12 : 13) * fontScale))}px`,
        color: '#8FA0BB',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(statsLine);
    this.subtitleElements.push(statsLine);
    cursorY += statsLine.height + 8;

    if (identity.hint) {
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
      cursorY += authHint.height + SPACING_24;
    } else {
      cursorY += SPACING_24;
    }

    const primaryButtonY = cursorY + buttonHeight / 2;
    const needsLogin = isAuthenticationAvailable() && !this.authSession.user;
    this.createPrimaryActionButton(centerX, primaryButtonY, {
      label: needsLogin ? '» Entrar' : '» Jogar',
      onClick: () => (needsLogin ? this.handleGoogleSignIn() : this.handleCreateRoom()),
    });
    cursorY += buttonHeight + buttonGap;

    const secondaryButtonY = cursorY + 24;
    if (compact) {
      secondaryButtons.forEach((config, index) => {
        this.createSecondaryActionButton(centerX, secondaryButtonY + index * 56, config, true);
      });
    } else {
      secondaryButtons.forEach((config, index) => {
        const offset = index === 0 ? -92 : 92;
        this.createSecondaryActionButton(centerX + offset, secondaryButtonY, config, false);
      });
    }
    cursorY += secondaryBlockHeight + SPACING_24;

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

  private createPrimaryActionButton(x: number, y: number, config: ButtonConfig) {
    const compact = this.scale.width < 640 || this.scale.height < 640;
    const fontScale = Math.max(0.75, Math.min(1, Math.min(this.scale.width, this.scale.height) / 900));
    const width = Math.min(compact ? 240 : 260, this.scale.width * (compact ? 0.7 : 0.34));
    const height = compact ? 58 : 62;
    const fontSize = Math.max(22, Math.round((compact ? 20 : 22) * fontScale));
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

  private createSecondaryActionButton(x: number, y: number, config: ButtonConfig, stacked: boolean) {
    const compact = this.scale.width < 640 || this.scale.height < 640;
    const width = stacked ? Math.min(232, this.scale.width * 0.72) : compact ? 148 : 170;
    const height = compact ? 42 : 46;
    const palette = { base: 0x22253a, hover: 0x2a2f4a, border: 0x404a6a, shadow: 0x131722 };

    const shadow = this.add.rectangle(x, y + 3, width, height, palette.shadow, 0.42).setOrigin(0.5);
    const buttonRect = this.add
      .rectangle(x, y, width, height, palette.base, 0.86)
      .setStrokeStyle(1, palette.border, 0.75)
      .setOrigin(0.5);
    const label = this.add
      .text(x, y, config.label, {
        fontFamily: FONT,
        fontSize: compact ? '14px' : '15px',
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
