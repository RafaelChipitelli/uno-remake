import Phaser from 'phaser';

type ButtonConfig = {
  label: string;
  onClick: () => void;
};

const FONT = '"Space Mono", "Fira Code", monospace';
const TEXT_RESOLUTION = Math.min(window.devicePixelRatio || 1, 2);

export default class TitleScene extends Phaser.Scene {
  private staticElements: Phaser.GameObjects.GameObject[] = [];
  private buttons: Phaser.GameObjects.Zone[] = [];
  private infoText?: Phaser.GameObjects.Text;
  private lastNickname = '';

  constructor() {
    super('TitleScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#030712');
    this.buildLayout();

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
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
    const verticalPadding = Math.round(Math.max(24, Math.min(72, cardHeight * (compact ? 0.09 : 0.11))));
    const topY = panelTop + verticalPadding;

    const background = this.add
      .rectangle(centerX, height / 2, panelWidth, cardHeight, 0x0b1222, 0.55)
      .setStrokeStyle(2, 0x172036, 0.8);
    this.staticElements.push(background);

    const title = this.add
      .text(centerX, topY, 'UNO REMAKE', {
        fontFamily: FONT,
        fontSize: titleSize,
        fontStyle: 'bold',
        color: '#f4f4f5',
        letterSpacing: 4,
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(title);

    const subtitle = this.add
      .text(centerX, title.y + Math.max(30, Math.round(52 * fontScale)), 'Multiplayer em tempo real', {
        fontFamily: FONT,
        fontSize: subtitleSize,
        color: '#cbd5f5',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(subtitle);

    const buttons: ButtonConfig[] = [
      { label: 'Criar Sala', onClick: () => this.handleCreateRoom() },
      { label: 'Entrar com Código', onClick: () => this.handleJoinRoom() },
    ];

    const buttonHeight = compact ? 54 : 64;
    const buttonGap = compact ? 20 : 28;
    const subtitleToButtonsGap = Math.max(26, Math.round(42 * fontScale));
    const buttonsBlockHeight = buttons.length * buttonHeight + (buttons.length - 1) * buttonGap;

    const minInfoY = subtitle.y + subtitleToButtonsGap + buttonsBlockHeight + Math.max(24, Math.round(40 * fontScale));
    const idealInfoY = panelBottom - verticalPadding;
    const infoY = Math.max(minInfoY, idealInfoY);

    const buttonBaseY = subtitle.y + subtitleToButtonsGap + buttonHeight / 2;
    buttons.forEach((config, index) => {
      const posY = buttonBaseY + index * (buttonHeight + buttonGap);
      this.createButton(centerX, posY, config);
    });

    this.infoText = this.add
      .text(centerX, infoY, 'Escolha uma opção para continuar', {
        fontFamily: FONT,
        fontSize: infoSize,
        color: '#f9a8d4',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION);
    this.staticElements.push(this.infoText);
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

    const buttonRect = this.add
      .rectangle(x, y, width, height, 0xf97316, 0.9)
      .setStrokeStyle(2, 0xffffff, 0.9)
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

    zone.on('pointerover', () => buttonRect.setFillStyle(0xfb923c));
    zone.on('pointerout', () => {
      buttonRect.setFillStyle(0xf97316);
      buttonRect.setScale(1);
    });
    zone.on('pointerdown', () => buttonRect.setScale(0.98));
    zone.on('pointerup', () => {
      buttonRect.setScale(1);
      config.onClick();
    });

    this.staticElements.push(buttonRect, label);
    this.buttons.push(zone);
  }

  private handleCreateRoom() {
    const nickname = this.promptNickname();
    this.scene.start('GameScene', {
      autoAction: 'create',
      nickname,
    });
  }

  private handleJoinRoom() {
    const roomCode = window.prompt('Digite o código da sala (ex: ABCD)')?.trim().toUpperCase();
    if (!roomCode) {
      this.showInfo('Informe um código válido.');
      return;
    }

    const nickname = this.promptNickname();
    this.scene.start('GameScene', {
      autoAction: 'join',
      nickname,
      roomCode,
    });
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

  private promptNickname() {
    const input =
      window.prompt('Qual nickname deseja usar?', this.lastNickname || 'Player')?.trim() ?? '';
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

}
