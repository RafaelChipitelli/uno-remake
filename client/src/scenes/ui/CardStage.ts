import Phaser from 'phaser';
import { CARD_COLOR_HEX } from '../../game/colors';
import { phaserTheme, theme } from '../../theme/tokens';
import type { Card } from '../../types';

type CardStageOptions = {
  hudWidth: number;
  hudMargin: number;
  fontFamily: string;
  textResolution: number;
  stagePadding?: number;
  handBottomOffset?: number;
  tableCardScale?: number;
  fontScale?: number;
  compact?: boolean;
  onCardSelected?: (card: Card, index: number) => void;
};

type OpponentHandSnapshot = {
  id: string;
  nickname: string;
  cardCount: number;
  isTurn: boolean;
};

type StageMetrics = {
  stageLeft: number;
  stageRight: number;
  stageWidth: number;
  stageX: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default class CardStage {
  private scene: Phaser.Scene;
  private options: CardStageOptions;
  private onCardSelected?: (card: Card, index: number) => void;

  private handCards: Card[] = [];
  private opponents: OpponentHandSnapshot[] = [];
  private playerNickname?: string;

  private elements: Phaser.GameObjects.GameObject[] = [];
  private handElements: Phaser.GameObjects.GameObject[] = [];
  private opponentElements: Phaser.GameObjects.GameObject[] = [];

  private tableCard?: Card;
  private currentColor?: Card['color'];
  private placeholderContainer?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, options: CardStageOptions) {
    this.scene = scene;
    this.options = options;
    this.onCardSelected = options.onCardSelected;
  }

  setLayoutMetrics(
    partial: Pick<
      CardStageOptions,
      'hudWidth' | 'hudMargin' | 'stagePadding' | 'handBottomOffset' | 'tableCardScale' | 'fontScale' | 'compact'
    >,
  ) {
    this.options = { ...this.options, ...partial };
    this.build();
  }

  build() {
    this.clearStageObjects();
    this.renderTableArea();
    this.renderOpponents();
    this.renderHand();
  }

  resize() {
    this.build();
  }

  setPlayerNickname(nickname?: string) {
    this.playerNickname = nickname;
    this.build();
  }

  pulsePlaceholder() {
    if (!this.placeholderContainer) return;
    this.scene.tweens.add({
      targets: this.placeholderContainer,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 220,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  setHandCards(cards: Card[]) {
    this.handCards = cards;
    this.renderHand();
  }

  setOpponents(opponents: OpponentHandSnapshot[]) {
    this.opponents = [...opponents];
    this.renderOpponents();
  }

  setTableCard(card: Card, currentColor?: Card['color']) {
    this.tableCard = card;
    this.currentColor = currentColor ?? card.color;
    this.renderTableArea();
  }

  getTableCard(): Card | undefined {
    return this.tableCard;
  }

  getCurrentColor(): Card['color'] | undefined {
    return this.currentColor;
  }

  private renderTableArea() {
    this.elements.forEach((obj) => obj.destroy());
    this.elements = [];
    this.placeholderContainer = undefined;

    const metrics = this.getMetrics();
    const centerY = this.scene.scale.height * 0.42;
    const cardWidth = clamp(146 * (this.options.tableCardScale ?? 1), 104, 152);
    const cardHeight = cardWidth * 1.44;

    const tableGlow = this.scene.add.ellipse(
      metrics.stageX,
      centerY + 16,
      cardWidth * 2.5,
      cardHeight * 1.2,
      phaserTheme.colors.action.primary.base,
      0.13,
    );
    this.elements.push(tableGlow);

    if (!this.tableCard) {
      const container = this.scene.add.container(metrics.stageX, centerY);
      const shadow = this.scene.add.rectangle(4, 6, cardWidth, cardHeight, 0x000000, 0.35).setOrigin(0.5);
      const card = this.scene.add
        .rectangle(0, 0, cardWidth, cardHeight, phaserTheme.colors.card.wild, 0.96)
        .setOrigin(0.5)
        .setStrokeStyle(2, phaserTheme.colors.surface.disabled, 0.5);
      const text = this.scene.add
        .text(0, 0, 'UNO', {
          fontFamily: this.options.fontFamily,
          fontSize: `${Math.round(clamp(36 * (this.options.fontScale ?? 1), 24, 38))}px`,
          color: theme.colors.text.primary,
          fontStyle: '700',
        })
        .setOrigin(0.5)
        .setResolution(this.options.textResolution);

      container.add([shadow, card, text]);
      this.placeholderContainer = container;
      this.elements.push(container);
    } else {
      const resolvedColor =
        this.tableCard.color === 'wild' && this.currentColor && this.currentColor !== 'wild'
          ? this.currentColor
          : this.tableCard.color;

      const container = this.scene.add.container(metrics.stageX, centerY);
      const shadow = this.scene.add.rectangle(5, 7, cardWidth, cardHeight, 0x000000, 0.38).setOrigin(0.5);
      const card = this.scene.add
        .rectangle(0, 0, cardWidth, cardHeight, CARD_COLOR_HEX[resolvedColor] ?? phaserTheme.colors.surface.disabled)
        .setOrigin(0.5)
        .setStrokeStyle(3, 0xffffff, 0.9);
      const innerHighlight = this.scene.add.ellipse(0, -cardHeight * 0.2, cardWidth * 0.74, cardHeight * 0.28, 0xffffff, 0.15);
      const text = this.scene.add
        .text(0, 0, this.tableCard.value, {
          fontFamily: this.options.fontFamily,
          fontSize: `${Math.round(clamp(52 * (this.options.fontScale ?? 1), 30, 56))}px`,
          color: theme.colors.text.inverse,
          fontStyle: '800',
        })
        .setOrigin(0.5)
        .setResolution(this.options.textResolution);

      container.add([shadow, card, innerHighlight, text]);
      container.setScale(0.9);
      this.scene.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        alpha: { from: 0, to: 1 },
        y: { from: centerY + 16, to: centerY },
        duration: 280,
        ease: 'Cubic.easeOut',
      });

      this.elements.push(container);
    }

    const nicknameText = this.scene.add
      .text(metrics.stageX, centerY + cardHeight / 2 + 24, this.playerNickname ? `Você: ${this.playerNickname}` : 'Aguardando conexão...', {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(16 * (this.options.fontScale ?? 1), 12, 18))}px`,
        color: theme.colors.text.muted,
      })
      .setOrigin(0.5)
      .setResolution(this.options.textResolution);
    this.elements.push(nicknameText);
  }

  private renderHand() {
    this.handElements.forEach((obj) => obj.destroy());
    this.handElements = [];

    if (!this.handCards.length) {
      return;
    }

    const metrics = this.getMetrics();
    const baseY = this.scene.scale.height - (this.options.handBottomOffset ?? 92);
    const isCompact = Boolean(this.options.compact);
    const cardWidth = clamp(74 * (this.options.tableCardScale ?? 1), isCompact ? 48 : 54, 90);
    const cardHeight = cardWidth * 1.42;
    const cardGap = clamp(10 * (this.options.tableCardScale ?? 1), 6, 14);
    const maxVisible = clamp(Math.floor(metrics.stageWidth / (cardWidth + cardGap)), 4, 11);

    const cards = this.handCards.slice(0, maxVisible);
    const totalWidth = cards.length * cardWidth + Math.max(0, cards.length - 1) * cardGap;
    const startX = metrics.stageX - totalWidth / 2 + cardWidth / 2;

    cards.forEach((card, index) => {
      const x = startX + index * (cardWidth + cardGap);
      const container = this.scene.add.container(x, baseY);

      const shadow = this.scene.add.rectangle(2, 4, cardWidth, cardHeight, 0x000000, 0.34).setOrigin(0.5);
      const base = this.scene.add
        .rectangle(0, 0, cardWidth, cardHeight, CARD_COLOR_HEX[card.color] ?? phaserTheme.colors.surface.disabled)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0xffffff, 0.9);
      const highlight = this.scene.add.ellipse(0, -cardHeight * 0.24, cardWidth * 0.7, cardHeight * 0.28, 0xffffff, 0.14);
      const value = this.scene.add
        .text(0, 0, card.value, {
          fontFamily: this.options.fontFamily,
          fontSize: `${Math.round(clamp(cardWidth * 0.32, 13, 24))}px`,
          color: theme.colors.text.inverse,
          fontStyle: '800',
        })
        .setOrigin(0.5)
        .setResolution(this.options.textResolution);

      container.add([shadow, base, highlight, value]);
      container.setSize(cardWidth, cardHeight);
      container.setInteractive({ useHandCursor: true });

      container.setAlpha(0);
      container.y += 14;
      this.scene.tweens.add({
        targets: container,
        alpha: 1,
        y: baseY,
        delay: index * 35,
        duration: 220,
        ease: 'Quad.easeOut',
      });

      container.on('pointerover', () => {
        this.scene.tweens.add({ targets: container, y: baseY - 16, scaleX: 1.03, scaleY: 1.03, duration: 180, ease: 'Quad.easeOut' });
        base.setStrokeStyle(3, 0xffffff, 1);
      });

      container.on('pointerout', () => {
        this.scene.tweens.add({ targets: container, y: baseY, scaleX: 1, scaleY: 1, duration: 180, ease: 'Quad.easeOut' });
        base.setStrokeStyle(2, 0xffffff, 0.9);
      });

      container.on('pointerdown', () => {
        this.scene.tweens.add({ targets: container, scaleX: 0.97, scaleY: 0.97, duration: 100, ease: 'Quad.easeInOut' });
      });

      container.on('pointerup', () => {
        this.scene.tweens.add({ targets: container, scaleX: 1.04, scaleY: 1.04, duration: 100, yoyo: true, ease: 'Back.easeOut' });
        this.onCardSelected?.(card, index);
      });

      this.handElements.push(container);
    });
  }

  private renderOpponents() {
    this.opponentElements.forEach((obj) => obj.destroy());
    this.opponentElements = [];

    if (!this.opponents.length) return;

    const metrics = this.getMetrics();
    const topY = clamp(this.scene.scale.height * 0.15, 60, 130);
    const sideY = clamp(this.scene.scale.height * 0.42, 170, this.scene.scale.height * 0.52);
    const leftX = metrics.stageLeft + clamp(metrics.stageWidth * 0.12, 28, 64);
    const rightX = metrics.stageRight - clamp(metrics.stageWidth * 0.12, 28, 64);

    const seats = [
      { x: metrics.stageX, y: topY },
      { x: leftX, y: sideY },
      { x: rightX, y: sideY },
    ];

    this.opponents.slice(0, 3).forEach((opponent, idx) => {
      const seat = seats[idx];
      if (!seat) return;

      const container = this.scene.add.container(seat.x, seat.y);
      const badge = this.scene.add
        .rectangle(0, 0, 124, 58, phaserTheme.colors.surface.card, 0.9)
        .setOrigin(0.5)
        .setStrokeStyle(
          1,
          opponent.isTurn ? phaserTheme.colors.status.success : phaserTheme.colors.surface.panelBorder,
          opponent.isTurn ? 1 : 0.8,
        );
      const name = this.scene.add
        .text(0, -10, opponent.nickname, {
          fontFamily: this.options.fontFamily,
          fontSize: `${Math.round(clamp(13 * (this.options.fontScale ?? 1), 11, 14))}px`,
          color: opponent.isTurn ? theme.colors.status.success : theme.colors.text.primary,
          fontStyle: opponent.isTurn ? '700' : '500',
        })
        .setOrigin(0.5)
        .setResolution(this.options.textResolution);
      const count = this.scene.add
        .text(0, 13, `🃏 ${opponent.cardCount}`, {
          fontFamily: this.options.fontFamily,
          fontSize: `${Math.round(clamp(12 * (this.options.fontScale ?? 1), 10, 13))}px`,
          color: theme.colors.text.muted,
        })
        .setOrigin(0.5)
        .setResolution(this.options.textResolution);

      container.add([badge, name, count]);
      container.setAlpha(0);
      container.y -= 10;
      this.scene.tweens.add({
        targets: container,
        alpha: 1,
        y: seat.y,
        duration: 260,
        delay: idx * 60,
        ease: 'Sine.easeOut',
      });

      this.opponentElements.push(container);
    });
  }

  private getMetrics(): StageMetrics {
    const width = this.scene.scale.width;
    const stageLeft = this.options.hudMargin + this.options.hudWidth + this.options.hudMargin;
    const stageRight = width - this.options.hudMargin;
    const stageWidth = Math.max(200, stageRight - stageLeft);
    return {
      stageLeft,
      stageRight,
      stageWidth,
      stageX: stageLeft + stageWidth / 2,
    };
  }

  private clearStageObjects() {
    this.elements.forEach((obj) => obj.destroy());
    this.handElements.forEach((obj) => obj.destroy());
    this.opponentElements.forEach((obj) => obj.destroy());
    this.elements = [];
    this.handElements = [];
    this.opponentElements = [];
  }

  destroy() {
    this.clearStageObjects();
  }
}
