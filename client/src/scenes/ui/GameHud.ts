import Phaser from 'phaser';

export type HudSnapshot = {
  status: string;
  roomLabel: string;
  playerList: string;
  logLines: string[];
  leaveEnabled: boolean;
  startEnabled: boolean;
  currentTurn: string;
};

type HudOptions = {
  width: number;
  margin: number;
  padding: number;
  compact?: boolean;
  fontScale?: number;
  panelColor: number;
  panelBorder: number;
  accentColor: string;
  fontFamily: string;
  textResolution: number;
  instructions: string;
};

type HudCallbacks = {
  onLeaveRequested: () => void;
  onStartRequested: () => void;
};

export default class GameHud {
  private scene: Phaser.Scene;
  private options: HudOptions;
  private callbacks: HudCallbacks;
  private elements: Phaser.GameObjects.GameObject[];
  private statusText?: Phaser.GameObjects.Text;
  private playerListText?: Phaser.GameObjects.Text;
  private actionLog?: Phaser.GameObjects.Text;
  
  private leaveButtonBg?: Phaser.GameObjects.Rectangle;
  private leaveButtonLabel?: Phaser.GameObjects.Text;
  private leaveButtonZone?: Phaser.GameObjects.Zone;

  private startButtonBg?: Phaser.GameObjects.Rectangle;
  private startButtonLabel?: Phaser.GameObjects.Text;
  private startButtonZone?: Phaser.GameObjects.Zone;

  private currentState: HudSnapshot;

  constructor(scene: Phaser.Scene, options: HudOptions, callbacks: HudCallbacks) {
    this.scene = scene;
    this.options = options;
    this.callbacks = callbacks;
    this.elements = [];
    this.currentState = {
      status: '',
      roomLabel: '',
      playerList: '',
      logLines: [],
      leaveEnabled: false,
      startEnabled: true,
      currentTurn: 'Aguardando jogo começar',
    };
  }

  init(initialState: HudSnapshot) {
    this.currentState = { ...initialState };
    this.build();
  }

  setLayoutMetrics(partial: Pick<HudOptions, 'width' | 'margin' | 'padding' | 'compact' | 'fontScale'>) {
    this.options = { ...this.options, ...partial };
    this.build();
  }

  update(partial: Partial<HudSnapshot>) {
    this.currentState = { ...this.currentState, ...partial };

    const shouldRebuild =
      partial.status !== undefined ||
      partial.roomLabel !== undefined ||
      partial.playerList !== undefined ||
      partial.currentTurn !== undefined ||
      partial.logLines !== undefined;

    if (shouldRebuild) {
      this.build();
      return;
    }

    if (partial.leaveEnabled !== undefined) {
      this.applyLeaveState();
    }
    if (partial.startEnabled !== undefined) {
      this.applyStartState();
    }
  }

  resize() {
    this.build();
  }

  destroy() {
    this.elements.forEach((obj) => obj.destroy());
    this.elements = [];
    this.leaveButtonZone?.destroy();
    this.leaveButtonZone = undefined;
    this.startButtonZone?.destroy();
    this.startButtonZone = undefined;
  }

  private build() {
    this.destroy();

    const { height: gameHeight } = this.scene.scale;
    const panelHeight = gameHeight - this.options.margin * 2;
    const fontScale = this.options.fontScale ?? 1;
    const compact = Boolean(this.options.compact);
    const lineGap = compact ? 4 : 6;

    const panel = this.scene.add
      .rectangle(
        this.options.margin,
        this.options.margin,
        this.options.width,
        panelHeight,
        this.options.panelColor,
        0.92,
      )
      .setOrigin(0);
    panel.setStrokeStyle(2, this.options.panelBorder, 0.9);

    const contentX = panel.x + this.options.padding;
    let cursorY = panel.y + this.options.padding;
    const wrapWidth = this.options.width - this.options.padding * 2;
    const toFontSize = (px: number) => `${Math.max(11, Math.round(px * fontScale))}px`;
    const pushAndAdvance = (object: Phaser.GameObjects.Text, gap: number) => {
      this.elements.push(object);
      cursorY = object.y + object.height + gap;
    };

    this.statusText = this.scene.add
      .text(contentX, cursorY, this.currentState.status, {
        fontFamily: this.options.fontFamily,
        fontSize: toFontSize(compact ? 16 : 20),
        color: '#ffffff',
        wordWrap: { width: wrapWidth },
      })
      .setResolution(this.options.textResolution);

    this.elements.push(panel);
    pushAndAdvance(this.statusText, compact ? 12 : 16);

    const roomLabel = this.createLabel(
      contentX,
      cursorY,
      this.currentState.roomLabel,
      this.options.accentColor,
      'bold',
      toFontSize(compact ? 13 : 15),
    );
    pushAndAdvance(roomLabel, compact ? 10 : 12);

    const turnNowLabel = this.createLabel(
      contentX,
      cursorY,
      `Vez: ${this.currentState.currentTurn}`,
      '#34d399',
      'bold',
      toFontSize(compact ? 13 : 15),
    );
    pushAndAdvance(turnNowLabel, compact ? 10 : 12);

    const controlsLabel = this.createLabel(
      contentX,
      cursorY,
      'Controles rápidos',
      '#a5b4fc',
      'bold',
      toFontSize(16),
    );
    pushAndAdvance(controlsLabel, compact ? 4 : 6);

    const controlsText = this.scene.add
      .text(contentX, cursorY, this.options.instructions, {
        fontFamily: this.options.fontFamily,
        fontSize: toFontSize(compact ? 13 : 15),
        color: '#e2e8f0',
        lineSpacing: lineGap,
        wordWrap: { width: wrapWidth },
      })
      .setResolution(this.options.textResolution);
    pushAndAdvance(controlsText, compact ? 10 : 14);

    const startButtonHeight = compact ? 46 : 54;
    const leaveButtonHeight = compact ? 46 : 54;
    const actionButtonsGap = compact ? 10 : 12;

    this.createStartButton(
      panel.x + this.options.width / 2,
      cursorY + startButtonHeight / 2,
      compact,
      toFontSize(16),
    );
    cursorY += startButtonHeight + actionButtonsGap;

    this.createLeaveButton(
      panel.x + this.options.width / 2,
      cursorY + leaveButtonHeight / 2,
      compact,
      toFontSize(16),
    );
    cursorY += leaveButtonHeight + (compact ? 12 : 16);

    const playersLabel = this.createLabel(
      contentX,
      cursorY,
      'Jogadores',
      '#cbd5ff',
      'bold',
      toFontSize(15),
    );
    pushAndAdvance(playersLabel, 6);

    this.playerListText = this.scene.add
      .text(contentX, cursorY, this.getVisiblePlayerList(), {
        fontFamily: this.options.fontFamily,
        fontSize: toFontSize(compact ? 12 : 15),
        color: '#cbd5f5',
        lineSpacing: lineGap,
        wordWrap: { width: wrapWidth },
      })
      .setResolution(this.options.textResolution);
    pushAndAdvance(this.playerListText, compact ? 10 : 14);

    const logLabel = this.createLabel(
      contentX,
      cursorY,
      'Log recente',
      '#f9a8d4',
      'bold',
      toFontSize(15),
    );
    pushAndAdvance(logLabel, 6);

    this.actionLog = this.scene.add
      .text(contentX, cursorY, 'Nenhuma ação ainda.', {
        fontFamily: this.options.fontFamily,
        fontSize: toFontSize(compact ? 12 : 15),
        color: '#f472b6',
        lineSpacing: lineGap,
        wordWrap: { width: wrapWidth },
      })
      .setResolution(this.options.textResolution);
    this.elements.push(this.actionLog);

    this.applyLog();
    this.applyLeaveState();
    this.applyStartState();
  }

  private createLabel(
    x: number,
    y: number,
    text: string,
    color: string,
    fontStyle: string | undefined,
    fontSize: string,
  ) {
    return this.scene.add
      .text(x, y, text, {
        fontFamily: this.options.fontFamily,
        fontSize,
        fontStyle,
        color,
      })
      .setResolution(this.options.textResolution);
  }

  // Lógica do botão de Sair
  private createLeaveButton(centerX: number, y: number, compact: boolean, labelFontSize: string) {
    const width = this.options.width - this.options.padding * 2;
    const height = compact ? 46 : 54;

    this.leaveButtonBg = this.scene.add.rectangle(centerX, y, width, height, 0xdc2626, 0.9).setOrigin(0.5);
    this.leaveButtonBg.setStrokeStyle(2, 0xffffff, 0.85);

    this.leaveButtonLabel = this.scene.add.text(centerX, y, 'Sair da sala', {
        fontFamily: this.options.fontFamily,
        fontSize: labelFontSize,
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5).setResolution(this.options.textResolution);

    this.leaveButtonZone = this.scene.add.zone(centerX, y, width, height).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.leaveButtonZone.on('pointerover', () => {
      if (!this.currentState.leaveEnabled) return;
      this.leaveButtonBg?.setFillStyle(0xf87171);
    });

    this.leaveButtonZone.on('pointerout', () => {
      this.leaveButtonBg?.setFillStyle(0xdc2626);
      this.leaveButtonBg?.setScale(1);
    });

    this.leaveButtonZone.on('pointerdown', () => {
      if (!this.currentState.leaveEnabled) return;
      this.leaveButtonBg?.setScale(0.98);
    });

    this.leaveButtonZone.on('pointerup', () => {
      if (!this.currentState.leaveEnabled) {
        this.leaveButtonBg?.setScale(1);
        return;
      }
      this.leaveButtonBg?.setScale(1);
      this.callbacks.onLeaveRequested();
    });

    this.elements.push(this.leaveButtonBg, this.leaveButtonLabel, this.leaveButtonZone);
  }

  // Lógica do novo botão de Iniciar
  private createStartButton(centerX: number, y: number, compact: boolean, labelFontSize: string) {
    const width = this.options.width - this.options.padding * 2;
    const height = compact ? 46 : 54;

    this.startButtonBg = this.scene.add.rectangle(centerX, y, width, height, 0xdc2626, 0.9).setOrigin(0.5);
    this.startButtonBg.setStrokeStyle(2, 0xffffff, 0.85);

    this.startButtonLabel = this.scene.add.text(centerX, y, 'Iniciar Jogo', {
        fontFamily: this.options.fontFamily,
        fontSize: labelFontSize,
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5).setResolution(this.options.textResolution);

    this.startButtonZone = this.scene.add.zone(centerX, y, width, height).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.startButtonZone.on('pointerover', () => {
      if (!this.currentState.startEnabled) return;
      this.startButtonBg?.setFillStyle(0xf87171); // Mesma cor do hover do botão de sair
    });

    this.startButtonZone.on('pointerout', () => {
      this.startButtonBg?.setFillStyle(0xdc2626);
      this.startButtonBg?.setScale(1);
    });

    this.startButtonZone.on('pointerdown', () => {
      if (!this.currentState.startEnabled) return;
      this.startButtonBg?.setScale(0.98);
    });

    this.startButtonZone.on('pointerup', () => {
      if (!this.currentState.startEnabled) {
        this.startButtonBg?.setScale(1);
        return;
      }
      this.startButtonBg?.setScale(1);
      this.callbacks.onStartRequested();
    });

    this.elements.push(this.startButtonBg, this.startButtonLabel, this.startButtonZone);
  }

  private applyLog() {
    if (!this.actionLog) return;
    const lines = this.getVisibleLogLines();

    if (!lines.length) {
      this.actionLog.setText('• Nenhuma ação ainda.');
    } else {
      this.actionLog.setText(lines.map((line) => `• ${line}`).join('\n'));
    }
  }

  private getVisiblePlayerList(): string {
    const maxLines = this.options.compact ? 3 : 5;
    const lines = this.currentState.playerList.split('\n').filter(Boolean);
    if (lines.length <= maxLines) {
      return this.currentState.playerList;
    }

    return `${lines.slice(0, maxLines).join('\n')}\n…`;
  }

  private getVisibleLogLines(): string[] {
    const maxLines = this.options.compact ? 3 : 5;
    return this.currentState.logLines.slice(0, maxLines);
  }

  private applyLeaveState() {
    if (!this.leaveButtonBg || !this.leaveButtonZone || !this.leaveButtonLabel) return;
    if (this.currentState.leaveEnabled) {
      this.leaveButtonBg.setFillStyle(0xdc2626, 0.95).setAlpha(1);
      this.leaveButtonLabel.setAlpha(1);
      this.leaveButtonZone.setInteractive({ useHandCursor: true });
    } else {
      this.leaveButtonBg.setFillStyle(0x1f2937, 0.6).setAlpha(0.6);
      this.leaveButtonLabel.setAlpha(0.5);
      this.leaveButtonZone.disableInteractive();
    }
  }

  private applyStartState() {
    if (!this.startButtonBg || !this.startButtonZone || !this.startButtonLabel) return;
    if (this.currentState.startEnabled) {
      this.startButtonBg.setFillStyle(0xdc2626, 0.95).setAlpha(1);
      this.startButtonLabel.setAlpha(1);
      this.startButtonZone.setInteractive({ useHandCursor: true });
    } else {
      this.startButtonBg.setFillStyle(0x1f2937, 0.6).setAlpha(0.6);
      this.startButtonLabel.setAlpha(0.5);
      this.startButtonZone.disableInteractive();
    }
  }
}