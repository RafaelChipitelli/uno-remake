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
  tone?: 'primary' | 'secondary' | 'danger' | 'neutral';
  onClick: () => void | Promise<void>;
};

const FONT = '"Inter", system-ui, sans-serif';
const TEXT_RESOLUTION = Math.min(window.devicePixelRatio || 1, 2);
const SPACING_16 = 16;
const SPACING_24 = 24;

export default class TitleScene extends Phaser.Scene {
  private staticElements: Phaser.GameObjects.GameObject[] = [];
  private buttons: Phaser.GameObjects.Zone[] = [];
  private infoText?: Phaser.GameObjects.Text;
  private lastNickname = '';
  private authSession: AuthSession = getCurrentAuthSession();
  private unsubscribeAuthSession?: () => void;

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
    const fontScale = Math.max(0.75, Math.min(1, Math.min(width, height) / 900));
    const titleSize = Math.max(32, Math.round(Math.min(64, width * 0.06) * fontScale));
    const subtitleSize = Math.max(14, Math.round((compact ? 17 : 22) * fontScale));
    const infoSize = Math.max(12, Math.round((compact ? 14 : 18) * fontScale));
    const panelWidth = width * (compact ? 0.92 : 0.8);
    const cardHeight = Math.min(height * (compact ? 0.92 : 0.8), compact ? 700 : 660);
    const panelTop = (height - cardHeight) / 2;
    const panelBottom = panelTop + cardHeight;
    const verticalPadding = Math.round(Math.max(SPACING_24, Math.min(72, cardHeight * (compact ? 0.09 : 0.11))));
    const topY = panelTop + verticalPadding;

    const leftGlow = this.add.ellipse(width * 0.16, height * 0.22, width * 0.46, height * 0.5, 0x3a86ff, 0.16);
    const rightGlow = this.add.ellipse(width * 0.88, height * 0.78, width * 0.5, height * 0.56, 0x6c5ce7, 0.15);
    this.staticElements.push(leftGlow, rightGlow);

    const background = this.add
      .rectangle(centerX, height / 2, panelWidth, cardHeight, 0x111827, 0.78)
      .setStrokeStyle(1, 0x2b3852, 0.6);
    this.staticElements.push(background);

    const title = this.add
      .text(centerX, topY, 'UNO REMAKE', {
        fontFamily: FONT,
        fontSize: titleSize,
        fontStyle: 'bold',
        color: '#E5E7EB',
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(title);

    const subtitle = this.add
      .text(centerX, title.y + Math.max(SPACING_24, Math.round(48 * fontScale)), 'Multiplayer em tempo real', {
        fontFamily: FONT,
        fontSize: subtitleSize,
        color: '#9CA3AF',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(subtitle);

    const authHint = this.add
      .text(centerX, subtitle.y + Math.max(SPACING_16, Math.round(32 * fontScale)), this.getAuthSummaryMessage(), {
        fontFamily: FONT,
        fontSize: Math.max(12, Math.round((compact ? 13 : 16) * fontScale)),
        color: '#9CA3AF',
        align: 'center',
        wordWrap: { width: panelWidth * 0.84, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(authHint);

    const buttons = this.getButtonConfigs();

    const buttonHeight = compact ? 52 : 60;
    const buttonGap = compact ? SPACING_16 : SPACING_24;
    const subtitleToButtonsGap = Math.max(SPACING_16, Math.round(28 * fontScale));
    const buttonsBlockHeight = buttons.length * buttonHeight + (buttons.length - 1) * buttonGap;

    const buttonsAnchorY = authHint.y + authHint.height + subtitleToButtonsGap;

    const minInfoY = buttonsAnchorY + buttonsBlockHeight + Math.max(SPACING_24, Math.round(40 * fontScale));
    const idealInfoY = panelBottom - verticalPadding;
    const infoY = Math.max(minInfoY, idealInfoY);

    const buttonBaseY = buttonsAnchorY + buttonHeight / 2;
    buttons.forEach((config, index) => {
      const posY = buttonBaseY + index * (buttonHeight + buttonGap);
      this.createButton(centerX, posY, config);
    });

    this.infoText = this.add
      .text(centerX, infoY, this.getDefaultInfoMessage(), {
        fontFamily: FONT,
        fontSize: infoSize,
        color: '#9CA3AF',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(this.infoText);

    this.animateScreenEntry();
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    this.cameras.resize(gameSize.width, gameSize.height);
    this.buildLayout();
  }

  private createButton(x: number, y: number, config: ButtonConfig) {
    const compact = this.scale.width < 640 || this.scale.height < 640;
    const fontScale = Math.max(0.75, Math.min(1, Math.min(this.scale.width, this.scale.height) / 900));
    const width = Math.min(compact ? 280 : 320, this.scale.width * (compact ? 0.76 : 0.6));
    const height = compact ? 54 : 64;
    const fontSize = Math.max(14, Math.round((compact ? 16 : 20) * fontScale));

    const tone = config.tone ?? 'neutral';
    const toneMap: Record<NonNullable<ButtonConfig['tone']>, { base: number; hover: number; border: number; shadow: number }> = {
      primary: { base: 0x6c5ce7, hover: 0x7f70ef, border: 0x4f46b6, shadow: 0x2b2368 },
      secondary: { base: 0x3a86ff, hover: 0x5b9dff, border: 0x2d66bf, shadow: 0x163869 },
      danger: { base: 0xff4d4d, hover: 0xff6666, border: 0xbf3434, shadow: 0x6c1f1f },
      neutral: { base: 0x4b5563, hover: 0x596575, border: 0x2d3642, shadow: 0x1f2430 },
    };
    const palette = toneMap[tone];

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
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);

    const zone = this.add
      .zone(x, y, width, height)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      buttonRect.setFillStyle(palette.hover);
      this.tweens.add({ targets: [buttonRect, label, shadow], scaleX: 1.03, scaleY: 1.03, duration: 180, ease: 'Quad.easeOut' });
    });
    zone.on('pointerout', () => {
      buttonRect.setFillStyle(palette.base);
      this.tweens.add({ targets: [buttonRect, label, shadow], scaleX: 1, scaleY: 1, duration: 180, ease: 'Quad.easeOut' });
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

  private getButtonConfigs(): ButtonConfig[] {
    if (isAuthenticationAvailable()) {
      if (this.authSession.isLoading) {
        return [{ label: 'Carregando sessão...', tone: 'neutral', onClick: () => this.showInfo('Aguarde a sessão carregar.') }];
      }

      if (!this.authSession.user) {
        return [{ label: 'Entrar com Google', tone: 'primary', onClick: () => this.handleGoogleSignIn() }];
      }

      return [
        { label: 'Criar Sala', tone: 'primary', onClick: () => this.handleCreateRoom() },
        { label: 'Entrar com Código', tone: 'secondary', onClick: () => this.handleJoinRoom() },
        { label: 'Sair da Conta Google', tone: 'danger', onClick: () => this.handleGoogleSignOut() },
      ];
    }

    return [
      { label: 'Criar Sala', tone: 'primary', onClick: () => this.handleCreateRoom() },
      { label: 'Entrar com Código', tone: 'secondary', onClick: () => this.handleJoinRoom() },
    ];
  }

  private getAuthSummaryMessage(): string {
    if (!isAuthenticationAvailable()) {
      return 'Firebase não configurado no .env.local. Login e estatísticas ficam desativados.';
    }

    if (this.authSession.isLoading) {
      return 'Verificando sessão de login...';
    }

    if (!this.authSession.user) {
      return 'Faça login com Google para salvar nickname e estatísticas.';
    }

    const nickname = this.authSession.profile?.nickname ?? this.authSession.user.displayName ?? 'Jogador';
    const stats = this.authSession.profile?.stats;
    const statsMessage = stats
      ? `Partidas: ${stats.gamesPlayed} • Vitórias: ${stats.gamesWon}`
      : 'Sincronizando estatísticas...';

    return `Conectado como ${nickname}\n${statsMessage}`;
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
      this.showInfo('Login efetuado com sucesso.');
    } catch (error) {
      console.error('[auth] Falha no login com Google', error);
      this.showInfo(this.getGoogleSignInErrorMessage(error));
    }
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
    this.staticElements.forEach((el) => el.destroy());
    this.buttons.forEach((btn) => btn.destroy());
    this.staticElements = [];
    this.buttons = [];
  }

  private animateScreenEntry(): void {
    this.staticElements.forEach((element, index) => {
      const target = element as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha;
      target.setAlpha(0);
      target.setY(target.y + 10);
      this.tweens.add({
        targets: target,
        alpha: 1,
        y: target.y - 10,
        duration: 220,
        delay: index * 45,
        ease: 'Sine.easeOut',
      });
    });
  }

}
