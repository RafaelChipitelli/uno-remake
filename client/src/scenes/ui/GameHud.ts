import Phaser from 'phaser';
import { phaserTheme, theme } from '../../theme/tokens';

export type HudSnapshot = {
  status: string;
  roomLabel: string;
  playerList: string;
  logLines: string[];
  leaveEnabled: boolean;
  startEnabled: boolean;
  drawEnabled: boolean;
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
  onDrawRequested: () => void;
};

type HudButtonTone = 'primary' | 'secondary' | 'danger';

export default class GameHud {
  private scene: Phaser.Scene;
  private options: HudOptions;
  private callbacks: HudCallbacks;
  private elements: Phaser.GameObjects.GameObject[] = [];
  private currentState: HudSnapshot;
  private isBuilt = false;

  private titleText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private roomLabelText?: Phaser.GameObjects.Text;
  private turnLabelText?: Phaser.GameObjects.Text;
  private playersHeaderText?: Phaser.GameObjects.Text;
  private playerText?: Phaser.GameObjects.Text;
  private logsHeaderText?: Phaser.GameObjects.Text;
  private logsText?: Phaser.GameObjects.Text;

  private startButton?: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone; tone: HudButtonTone };
  private drawButton?: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone; tone: HudButtonTone };
  private leaveButton?: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone; tone: HudButtonTone };

  constructor(scene: Phaser.Scene, options: HudOptions, callbacks: HudCallbacks) {
    this.scene = scene;
    this.options = options;
    this.callbacks = callbacks;
    this.currentState = {
      status: '',
      roomLabel: '',
      playerList: '',
      logLines: [],
      leaveEnabled: false,
      startEnabled: true,
      drawEnabled: false,
      currentTurn: 'Aguardando jogo começar',
    };
  }

  init(initialState: HudSnapshot) {
    this.currentState = { ...initialState };
    this.build();
    this.refreshDynamicContent();
  }

  setLayoutMetrics(partial: Pick<HudOptions, 'width' | 'margin' | 'padding' | 'compact' | 'fontScale'>) {
    this.options = { ...this.options, ...partial };
    this.build();
  }

  update(partial: Partial<HudSnapshot>) {
    this.currentState = { ...this.currentState, ...partial };
    if (!this.isBuilt) {
      this.build();
    }
    this.refreshDynamicContent();
  }

  resize() {
    this.build();
  }

  destroy() {
    this.elements.forEach((obj) => obj.destroy());
    this.elements = [];
    this.isBuilt = false;
    this.titleText = undefined;
    this.statusText = undefined;
    this.roomLabelText = undefined;
    this.turnLabelText = undefined;
    this.playersHeaderText = undefined;
    this.playerText = undefined;
    this.logsHeaderText = undefined;
    this.logsText = undefined;
    this.startButton = undefined;
    this.drawButton = undefined;
    this.leaveButton = undefined;
  }

  private build() {
    this.destroy();

    const compact = Boolean(this.options.compact);
    const panelHeight = this.scene.scale.height - this.options.margin * 2;
    const panelX = this.options.margin;
    const panelY = this.options.margin;
    const innerX = panelX + this.options.padding;
    const innerWidth = this.options.width - this.options.padding * 2;
    const fontScale = this.options.fontScale ?? 1;
    const spacing = {
      s: 8,
      m: 16,
    };

    const panelShadow = this.scene.add
      .rectangle(panelX + 3, panelY + 6, this.options.width, panelHeight, phaserTheme.colors.decor.overlay, 0.3)
      .setOrigin(0);
    const panel = this.scene.add
      .rectangle(panelX, panelY, this.options.width, panelHeight, this.options.panelColor, 0.94)
      .setOrigin(0)
      .setStrokeStyle(1, this.options.panelBorder, 0.9);
    const panelTopGlow = this.scene.add
      .rectangle(panelX, panelY, this.options.width, 52, phaserTheme.colors.action.primary.base, 0.08)
      .setOrigin(0);

    this.elements.push(panelShadow, panel, panelTopGlow);

    let y = panelY + this.options.padding;
    const makeText = (text: string, size: number, color: string, fontStyle?: string) =>
      this.scene.add
        .text(innerX, y, text, {
          fontFamily: this.options.fontFamily,
          fontSize: `${Math.max(11, Math.round(size * fontScale))}px`,
          color,
          fontStyle,
          wordWrap: { width: innerWidth, useAdvancedWrap: true },
        })
        .setResolution(this.options.textResolution);

    this.titleText = makeText('👤 Player Panel', compact ? 17 : 19, theme.colors.text.primary, '700');
    this.elements.push(this.titleText);
    y += this.titleText.height + spacing.m;

    this.statusText = makeText(this.currentState.status || 'Conectando...', compact ? 13 : 14, theme.colors.text.primary, '600');
    this.elements.push(this.statusText);
    y += this.statusText.height + spacing.s;

    this.roomLabelText = this.scene.add
      .text(innerX, y, `🏷 ${this.currentState.roomLabel}`, {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.max(11, Math.round((compact ? 12 : 13) * fontScale))}px`,
        color: theme.colors.text.muted,
      })
      .setResolution(this.options.textResolution);
    this.elements.push(this.roomLabelText);
    y += this.roomLabelText.height + spacing.s;

    this.turnLabelText = this.scene.add
      .text(innerX, y, `⏱ Vez: ${this.currentState.currentTurn}`, {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.max(11, Math.round((compact ? 12 : 13) * fontScale))}px`,
        color: theme.colors.status.success,
        fontStyle: '600',
      })
      .setResolution(this.options.textResolution);
    this.elements.push(this.turnLabelText);
    y += this.turnLabelText.height + spacing.m;

    const controlsHeader = makeText('⚡ Ações', compact ? 13 : 14, theme.colors.text.muted, '600');
    this.elements.push(controlsHeader);
    y += controlsHeader.height + spacing.s;

    const buttonWidth = innerWidth;
    const buttonHeight = compact ? 42 : 46;

    this.startButton = this.createActionButton(innerX + buttonWidth / 2, y + buttonHeight / 2, buttonWidth, buttonHeight, 'Iniciar jogo', 'primary', () => this.callbacks.onStartRequested());
    y += buttonHeight + spacing.s;

    this.drawButton = this.createActionButton(innerX + buttonWidth / 2, y + buttonHeight / 2, buttonWidth, buttonHeight, 'Comprar carta', 'secondary', () => this.callbacks.onDrawRequested());
    y += buttonHeight + spacing.s;

    this.leaveButton = this.createActionButton(innerX + buttonWidth / 2, y + buttonHeight / 2, buttonWidth, buttonHeight, 'Sair da sala', 'danger', () => this.callbacks.onLeaveRequested());
    y += buttonHeight + spacing.m;

    const instructions = this.scene.add
      .text(innerX, y, this.options.instructions, {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.max(11, Math.round((compact ? 11 : 12) * fontScale))}px`,
        color: theme.colors.text.muted,
        lineSpacing: 4,
        wordWrap: { width: innerWidth, useAdvancedWrap: true },
      })
      .setResolution(this.options.textResolution);
    this.elements.push(instructions);
    y += instructions.height + spacing.m;

    this.playersHeaderText = makeText('🧑‍🤝‍🧑 Jogadores', compact ? 13 : 14, theme.colors.text.muted, '600');
    this.elements.push(this.playersHeaderText);
    y += this.playersHeaderText.height + spacing.s;

    const playerFontSize = Math.max(11, Math.round((compact ? 11 : 12) * fontScale));
    const playerLineSpacing = 4;
    const playerLineHeight = playerFontSize + playerLineSpacing;
    const playerBlockHeight = this.getMaxPlayerLines() * playerLineHeight + spacing.s;

    this.playerText = this.scene.add
      .text(innerX, y, this.getVisiblePlayerList(), {
        fontFamily: this.options.fontFamily,
        fontSize: `${playerFontSize}px`,
        color: theme.colors.text.primary,
        lineSpacing: playerLineSpacing,
        wordWrap: { width: innerWidth, useAdvancedWrap: true },
      })
      .setResolution(this.options.textResolution)
      .setFixedSize(innerWidth, playerBlockHeight);
    this.elements.push(this.playerText);
    y += playerBlockHeight + spacing.m;

    this.logsHeaderText = makeText('📝 Log da partida', compact ? 13 : 14, theme.colors.text.muted, '600');
    this.elements.push(this.logsHeaderText);
    y += this.logsHeaderText.height + spacing.s;

    const logsMinHeight = compact ? 140 : 180;
    const logsBackground = this.scene.add
      .rectangle(
        innerX,
        y,
        innerWidth,
        Math.max(logsMinHeight, panelY + panelHeight - y - spacing.m),
        phaserTheme.colors.bg.game,
        0.72,
      )
      .setOrigin(0)
      .setStrokeStyle(1, phaserTheme.colors.surface.panelBorder, 0.7);
    this.elements.push(logsBackground);

    this.logsText = this.scene.add
      .text(innerX + spacing.s, y + spacing.s, this.getVisibleLogText(), {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.max(11, Math.round((compact ? 11 : 12) * fontScale))}px`,
        color: theme.colors.text.muted,
        lineSpacing: 5,
        wordWrap: { width: innerWidth - spacing.m, useAdvancedWrap: true },
      })
      .setResolution(this.options.textResolution);
    this.elements.push(this.logsText);

    this.applyButtonState(this.startButton, this.currentState.startEnabled);
    this.applyButtonState(this.drawButton, this.currentState.drawEnabled);
    this.applyButtonState(this.leaveButton, this.currentState.leaveEnabled);

    this.animateEntry();
    this.isBuilt = true;
  }

  private refreshDynamicContent() {
    this.statusText?.setText(this.currentState.status || 'Conectando...');
    this.roomLabelText?.setText(`🏷 ${this.currentState.roomLabel}`);
    this.turnLabelText?.setText(`⏱ Vez: ${this.currentState.currentTurn}`);
    this.playerText?.setText(this.getVisiblePlayerList());
    this.logsText?.setText(this.getVisibleLogText());

    this.applyButtonState(this.startButton, this.currentState.startEnabled);
    this.applyButtonState(this.drawButton, this.currentState.drawEnabled);
    this.applyButtonState(this.leaveButton, this.currentState.leaveEnabled);
  }

  private createActionButton(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    labelText: string,
    tone: HudButtonTone,
    onClick: () => void,
  ) {
    const palette = this.getButtonPalette(tone);
    const shadow = this.scene.add.rectangle(centerX, centerY + 3, width, height, palette.shadow, 0.45).setOrigin(0.5);
    const bg = this.scene.add
      .rectangle(centerX, centerY, width, height, palette.base, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(1, palette.border, 0.9);
    const label = this.scene.add
      .text(centerX, centerY, labelText, {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.max(12, Math.round((this.options.compact ? 12 : 13) * (this.options.fontScale ?? 1)))}px`,
        color: theme.colors.text.inverse,
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setResolution(this.options.textResolution);

    const zone = this.scene.add
      .zone(centerX, centerY, width, height)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      if (!zone.input?.enabled) return;
      bg.setFillStyle(palette.hover, 1);
      this.scene.tweens.add({ targets: [bg, label, shadow], scaleX: 1.03, scaleY: 1.03, duration: 180, ease: 'Quad.easeOut' });
    });

    zone.on('pointerout', () => {
      bg.setFillStyle(palette.base, 0.95);
      this.scene.tweens.add({ targets: [bg, label, shadow], scaleX: 1, scaleY: 1, duration: 180, ease: 'Quad.easeOut' });
    });

    zone.on('pointerdown', () => {
      if (!zone.input?.enabled) return;
      this.scene.tweens.add({ targets: [bg, label, shadow], scaleX: 0.97, scaleY: 0.97, duration: 120, ease: 'Quad.easeInOut' });
    });

    zone.on('pointerup', () => {
      if (!zone.input?.enabled) return;
      this.scene.tweens.add({ targets: [bg, label, shadow], scaleX: 1, scaleY: 1, duration: 120, ease: 'Quad.easeOut' });
      onClick();
    });

    this.elements.push(shadow, bg, label, zone);

    return { bg, label, zone, tone };
  }

  private getButtonPalette(tone: HudButtonTone): { base: number; hover: number; border: number; shadow: number } {
    if (tone === 'primary') {
      return phaserTheme.colors.action.primary;
    }
    if (tone === 'secondary') {
      return phaserTheme.colors.action.secondary;
    }
    return phaserTheme.colors.action.danger;
  }

  private applyButtonState(button: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone; tone: HudButtonTone } | undefined, enabled: boolean) {
    if (!button) return;

    if (enabled) {
      const palette = this.getButtonPalette(button.tone);
      button.bg.setFillStyle(palette.base, 0.95).setAlpha(1);
      button.label.setAlpha(1);
      button.zone.setInteractive({ useHandCursor: true });
      return;
    }

    button.bg.setFillStyle(phaserTheme.colors.surface.disabled, 0.7).setAlpha(0.6);
    button.label.setAlpha(0.55);
    button.zone.disableInteractive();
  }

  private getVisiblePlayerList(): string {
    const maxLines = this.getMaxPlayerLines();
    const lines = this.currentState.playerList.split('\n').filter(Boolean);
    if (!lines.length) {
      return 'Nenhum jogador ainda.';
    }
    if (lines.length <= maxLines) {
      return lines.join('\n');
    }
    return `${lines.slice(0, maxLines).join('\n')}\n…`;
  }

  private getVisibleLogText(): string {
    const maxLines = this.getMaxLogLines();
    const lines = this.currentState.logLines.slice(0, maxLines);
    if (!lines.length) {
      return '• Nenhuma ação ainda.';
    }
    return lines.map((line) => `• ${line}`).join('\n');
  }

  private getMaxPlayerLines(): number {
    return this.options.compact ? 4 : 6;
  }

  private getMaxLogLines(): number {
    return this.options.compact ? 7 : 10;
  }

  private animateEntry() {
    this.elements.forEach((obj, index) => {
      const target = obj as unknown as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.Components.Transform;
      target.setAlpha(0);
      target.setY(target.y + 6);
      this.scene.tweens.add({
        targets: target,
        alpha: 1,
        y: target.y - 6,
        duration: 180,
        delay: index * 18,
        ease: 'Sine.easeOut',
      });
    });
  }
}