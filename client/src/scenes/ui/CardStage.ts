import Phaser from 'phaser';
import { CARD_COLOR_HEX } from '../../game/colors';
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

type OpponentSeat = {
  x: number;
  y: number;
  side: 'top' | 'left' | 'right';
};

type StageMetrics = {
  stageX: number;
  stageY: number;
  stageWidth: number;
  stageHeight: number;
  stageLeft: number;
  stageRight: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default class CardStage {
  private scene: Phaser.Scene;
  private options: CardStageOptions;
  private elements: Phaser.GameObjects.GameObject[];
  private cardBase?: Phaser.GameObjects.Rectangle;
  private cardShadow?: Phaser.GameObjects.Rectangle;
  private cardLabel?: Phaser.GameObjects.Text;
  private playerBadge?: Phaser.GameObjects.Text;
  private currentNickname?: string;
  private handCards: Card[] = [];
  private handElements: Phaser.GameObjects.GameObject[] = [];
  private tableCardShape?: Phaser.GameObjects.Rectangle;
  private tableCardText?: Phaser.GameObjects.Text;
  private tableCardShadow?: Phaser.GameObjects.Rectangle;
  private currentTableCard?: Card;
  private currentTableColor?: Card['color'];
  private onCardSelected?: (card: Card, index: number) => void;
  private opponents: OpponentHandSnapshot[] = [];
  private opponentElements: Phaser.GameObjects.GameObject[] = [];
  private handOffset = 0;
  private handVisibleCount = 0;
  private handOverflowActive = false;
  private handPageStep = 1;
  private lastHandWheelAt = 0;
  private handWheelHandler?: (pointer: Phaser.Input.Pointer, currentlyOver: unknown, deltaX: number, deltaY: number) => void;

  constructor(scene: Phaser.Scene, options: CardStageOptions) {
    this.scene = scene;
    this.options = options;
    this.elements = [];
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
    const previousTableCard = this.currentTableCard;
    const previousTableColor = this.currentTableColor;

    this.destroy();

    const { stageX, stageY } = this.getStageMetrics();
    const { cardWidth, cardHeight } = this.getPrimaryCardSize();

    this.cardShadow = this.scene.add
      .rectangle(stageX + 8, stageY + 10, cardWidth, cardHeight, 0x000000, 0.25)
      .setOrigin(0.5);

    this.cardBase = this.scene.add.rectangle(stageX, stageY, cardWidth, cardHeight, 0xff5c63).setOrigin(0.5);

    this.cardLabel = this.scene.add
      .text(stageX, stageY, 'UNO', {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(36 * (this.options.fontScale ?? 1), 22, 36))}px`,
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setResolution(this.options.textResolution);

    const badgeY = Math.min(
      stageY + cardHeight / 2 + 22,
      this.scene.scale.height - (this.options.handBottomOffset ?? 96) - cardHeight / 2 - 10,
    );
    this.playerBadge = this.scene.add
      .text(stageX, badgeY, 'Aguardando conexão...', {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(18 * (this.options.fontScale ?? 1), 12, 18))}px`,
        color: '#fcd34d',
      })
      .setOrigin(0.5)
      .setResolution(this.options.textResolution);

    this.cardShadow.setVisible(true);
    this.cardBase.setVisible(true);
    this.cardLabel.setVisible(true);

    this.elements.push(this.cardShadow, this.cardBase, this.cardLabel, this.playerBadge);
    this.applyNickname();
    this.renderOpponentHands();
    this.renderHandCards();

    if (previousTableCard) {
      this.setTableCard(previousTableCard, previousTableColor);
    }
  }

  resize() {
    this.build();
  }

  setPlayerNickname(nickname?: string) {
    this.currentNickname = nickname;
    this.applyNickname();
  }

  pulsePlaceholder() {
    if (!this.cardBase || !this.cardShadow || !this.cardLabel) {
      return;
    }

    const targets = [this.cardBase, this.cardShadow, this.cardLabel];

    this.scene.tweens.add({
      targets,
      scaleX: 1.04,
      scaleY: 1.04,
      yoyo: true,
      duration: 200,
      ease: 'Sine.easeOut',
    });
  }

  setHandCards(cards: Card[]) {
    this.handCards = cards;
    if (this.handOffset > Math.max(0, cards.length - 1)) {
      this.handOffset = 0;
    }
    this.renderHandCards();
  }

  setOpponents(opponents: OpponentHandSnapshot[]) {
    this.opponents = [...opponents];
    this.renderOpponentHands();
  }

  setTableCard(card: Card, currentColor?: Card['color']) {
    const displayColor =
      card.color === 'wild' && currentColor && currentColor !== 'wild' ? currentColor : card.color;

    this.currentTableCard = card;
    this.currentTableColor = currentColor ?? card.color;

    this.cardShadow?.setVisible(false);
    this.cardBase?.setVisible(false);
    this.cardLabel?.setVisible(false);

    this.renderTableCard(displayColor);
  }

  private renderTableCard(displayColor?: Card['color']) {
    if (this.tableCardShape) this.tableCardShape.destroy();
    if (this.tableCardText) this.tableCardText.destroy();
    if (this.tableCardShadow) this.tableCardShadow.destroy();

    if (!this.currentTableCard) {
      return;
    }

    const resolvedColor =
      displayColor ??
      (this.currentTableCard.color === 'wild' && this.currentTableColor && this.currentTableColor !== 'wild'
        ? this.currentTableColor
        : this.currentTableCard.color);

    const metrics = this.getStageMetrics();
    const { cardWidth, cardHeight } = this.getPrimaryCardSize();
    const tableY = clamp(
      this.scene.scale.height * 0.4,
      cardHeight / 2 + 22,
      this.scene.scale.height - (this.options.handBottomOffset ?? 96) - cardHeight / 2 - 18,
    );

    const stageX = metrics.stageX;
    const stageY = tableY;

    this.tableCardShadow = this.scene.add
      .rectangle(stageX + 6, stageY + 8, cardWidth, cardHeight, 0x000000, 0.25)
      .setOrigin(0.5);

    this.tableCardShape = this.scene.add
      .rectangle(stageX, stageY, cardWidth, cardHeight, CARD_COLOR_HEX[resolvedColor] ?? 0x333333)
      .setOrigin(0.5)
      .setStrokeStyle(3, 0xffffff);

    this.tableCardText = this.scene.add.text(stageX, stageY, this.currentTableCard.value, {
      fontFamily: this.options.fontFamily,
      fontSize: `${Math.round(clamp(48 * (this.options.fontScale ?? 1), 28, 48))}px`,
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5).setResolution(this.options.textResolution);
  }

  private renderHandCards() {
    this.handElements.forEach((obj) => obj.destroy());
    this.handElements = [];
    this.teardownHandWheelInteraction();

    if (this.handCards.length === 0) return;

    const metrics = this.getStageMetrics();
    const cardsCount = this.handCards.length;
    const handPadding = clamp(metrics.stageWidth * 0.05, 8, 24);
    const availableWidth = Math.max(120, metrics.stageRight - metrics.stageLeft - handPadding * 2);
    const handViewportWidth = clamp(
      availableWidth * (this.options.compact ? 0.94 : 0.9),
      240,
      availableWidth,
    );

    const scale = this.options.tableCardScale ?? 1;
    const isMobileViewport = this.scene.scale.width < 640;
    const idealCardWidth = clamp(74 * scale, isMobileViewport ? 48 : 54, 90);
    const idealSpacing = clamp(12 * scale, isMobileViewport ? 5 : 7, 16);
    const minVisibleCards = isMobileViewport ? 5 : this.options.compact ? 4 : 5;
    const idealVisibleCount = Math.max(
      minVisibleCards,
      Math.floor((handViewportWidth + idealSpacing) / (idealCardWidth + idealSpacing)),
    );

    this.handOverflowActive = cardsCount > idealVisibleCount;

    let visibleOffset = 0;
    let visibleCount = cardsCount;
    let cardWidth = idealCardWidth;
    let spacing = idealSpacing;

    if (this.handOverflowActive) {
      visibleCount = Math.max(minVisibleCards, idealVisibleCount);
      const maxOffset = Math.max(0, cardsCount - visibleCount);
      this.handOffset = clamp(this.handOffset, 0, maxOffset);
      visibleOffset = this.handOffset;
      this.handVisibleCount = visibleCount;

      if (visibleCount > 1) {
        spacing = clamp((handViewportWidth - visibleCount * cardWidth) / (visibleCount - 1), 6, idealSpacing);
      }

      this.handPageStep = Math.max(2, Math.floor(visibleCount * 0.55));
    } else {
      this.handOffset = 0;
      this.handVisibleCount = cardsCount;
      this.handPageStep = 1;

      if (cardsCount > 1) {
        const fitSpacing = (handViewportWidth - cardsCount * cardWidth) / (cardsCount - 1);
        spacing = clamp(fitSpacing, idealSpacing, 22);
      }

      const requiredWidth = cardsCount * cardWidth + (cardsCount - 1) * spacing;
      if (requiredWidth < handViewportWidth) {
        const extraPerCard = (handViewportWidth - requiredWidth) / cardsCount;
        cardWidth = clamp(cardWidth + extraPerCard, idealCardWidth, 102);
      }
    }

    const cardHeight = cardWidth * 1.45;
    const totalWidth = visibleCount * cardWidth + (visibleCount - 1) * spacing;
    const startX = metrics.stageX - totalWidth / 2;
    const baseY = clamp(
      this.scene.scale.height - (this.options.handBottomOffset ?? 96),
      cardHeight / 2 + 16,
      this.scene.scale.height - cardHeight / 2 - 8,
    );
    const hoverOffset = clamp(cardHeight * 0.12, 6, 16);
    const valueFontSize = `${Math.round(clamp(cardWidth * 0.28, 12, 24))}px`;

    const cardsToRender = this.handCards.slice(visibleOffset, visibleOffset + visibleCount);

    cardsToRender.forEach((card, index) => {
      const globalIndex = visibleOffset + index;
      const x = startX + index * (cardWidth + spacing) + cardWidth / 2;
      
      const bg = this.scene.add
        .rectangle(x, baseY, cardWidth, cardHeight, CARD_COLOR_HEX[card.color] ?? 0x333333)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0xffffff);

      const valueText = this.scene.add.text(x, baseY, card.value, {
        fontFamily: this.options.fontFamily,
        fontSize: valueFontSize,
        fontStyle: 'bold',
        color: '#ffffff'
      }).setOrigin(0.5).setResolution(this.options.textResolution);

      // Habilita interação
      bg.setInteractive({ useHandCursor: true });
      
      // Efeito hover
      bg.on('pointerover', () => {
        this.scene.tweens.add({
          targets: [bg, valueText],
          y: baseY - hoverOffset,
          duration: 150,
          ease: 'Power1'
        });
        bg.setStrokeStyle(3, 0xfcd34d);
      });

      bg.on('pointerout', () => {
        this.scene.tweens.add({
          targets: [bg, valueText],
          y: baseY,
          duration: 150,
          ease: 'Power1'
        });
        bg.setStrokeStyle(2, 0xffffff);
      });

      // Evento de clique
      bg.on('pointerdown', () => {
        if (this.onCardSelected) {
          this.onCardSelected(card, globalIndex);
        }
      });

      this.handElements.push(bg, valueText);
    });

    if (this.handOverflowActive) {
      const maxOffset = Math.max(0, this.handCards.length - visibleCount);
      this.renderOverflowControls(metrics, baseY, cardHeight, maxOffset, totalWidth);
      this.setupHandWheelInteraction(maxOffset);
    }
  }

  private renderOpponentHands() {
    this.opponentElements.forEach((obj) => obj.destroy());
    this.opponentElements = [];

    if (!this.opponents.length) {
      return;
    }

    const metrics = this.getStageMetrics();
    const seats = this.getOpponentSeats(this.opponents.length, metrics);

    this.opponents.forEach((opponent, index) => {
      const seat = seats[index];
      if (!seat) return;

      const container = this.scene.add.container(seat.x, seat.y);
      const scale = (this.options.tableCardScale ?? 1) * (this.options.compact ? 0.86 : 0.94);
      const cardWidth = clamp(56 * scale, 42, 62);
      const cardHeight = cardWidth * 1.45;
      const maxVisibleCards = 8;
      const visibleCards = Math.min(maxVisibleCards, Math.max(0, opponent.cardCount));
      const spread = this.options.compact ? cardWidth * 0.15 : cardWidth * 0.18;
      const maxRotation = this.options.compact ? 12 : 16;

      if (visibleCards > 0) {
        for (let i = 0; i < visibleCards; i += 1) {
          const t = visibleCards === 1 ? 0 : i / (visibleCards - 1) - 0.5;
          const x = (i - (visibleCards - 1) / 2) * spread;
          const y = Math.abs(t) * 10;
          const angle = t * maxRotation * 2;

          const shadow = this.scene.add
            .rectangle(x + 2, y + 3, cardWidth, cardHeight, 0x000000, 0.25)
            .setOrigin(0.5)
            .setAngle(angle);

          const back = this.scene.add
            .rectangle(x, y, cardWidth, cardHeight, 0x111827, 1)
            .setOrigin(0.5)
            .setStrokeStyle(2, opponent.isTurn ? 0xfcd34d : 0xe5e7eb, opponent.isTurn ? 1 : 0.85)
            .setAngle(angle);

          const stripe = this.scene.add
            .ellipse(x, y, cardWidth * 0.7, cardHeight * 0.34, 0xef4444, 0.95)
            .setAngle(angle - 12);

          container.add([shadow, back, stripe]);
        }
      }

      const fanWidth = Math.max(cardWidth, visibleCards * spread + cardWidth * 0.72);
      const highlight = this.scene.add
        .rectangle(0, cardHeight * 0.08, fanWidth + 18, cardHeight + 20, 0xfcd34d, opponent.isTurn ? 0.14 : 0)
        .setStrokeStyle(opponent.isTurn ? 2 : 0, 0xfcd34d, opponent.isTurn ? 0.75 : 0)
        .setOrigin(0.5);
      container.addAt(highlight, 0);

      const nickname = this.scene.add
        .text(0, cardHeight / 2 + 18, opponent.nickname, {
          fontFamily: this.options.fontFamily,
          fontSize: `${Math.round(clamp(15 * (this.options.fontScale ?? 1), 11, 16))}px`,
          color: opponent.isTurn ? '#fde68a' : '#e5e7eb',
          fontStyle: opponent.isTurn ? 'bold' : 'normal',
        })
        .setOrigin(0.5)
        .setResolution(this.options.textResolution);
      container.add(nickname);

      if (visibleCards === 0) {
        const noCardsHint = this.scene.add
          .text(0, 0, 'sem cartas visíveis', {
            fontFamily: this.options.fontFamily,
            fontSize: `${Math.round(clamp(11 * (this.options.fontScale ?? 1), 9, 12))}px`,
            color: '#94a3b8',
          })
          .setOrigin(0.5)
          .setResolution(this.options.textResolution);
        container.add(noCardsHint);
      }

      const countLabel = this.scene.add
        .text(fanWidth / 2, -cardHeight / 2 - 6, `x${opponent.cardCount}`, {
          fontFamily: this.options.fontFamily,
          fontSize: `${Math.round(clamp(13 * (this.options.fontScale ?? 1), 10, 14))}px`,
          color: '#ffffff',
          fontStyle: 'bold',
          backgroundColor: opponent.isTurn ? '#7c2d12' : '#0f172a',
          padding: { left: 7, right: 7, top: 3, bottom: 3 },
        })
        .setOrigin(0.5)
        .setResolution(this.options.textResolution);
      container.add(countLabel);

      if (seat.side !== 'top') {
        container.setScale(0.94);
      }

      this.opponentElements.push(container);
    });
  }

  private getOpponentSeats(count: number, metrics: StageMetrics): OpponentSeat[] {
    const topY = clamp(this.scene.scale.height * 0.16, 56, 136);
    const sideY = clamp(this.scene.scale.height * 0.42, 170, this.scene.scale.height * 0.5);
    const sidePadding = clamp(metrics.stageWidth * 0.08, 26, 56);
    const leftX = metrics.stageLeft + sidePadding;
    const rightX = metrics.stageRight - sidePadding;
    const topX = metrics.stageX;

    if (count <= 1) {
      return [{ x: topX, y: topY, side: 'top' }];
    }

    if (count === 2) {
      return [
        { x: topX, y: topY, side: 'top' },
        { x: rightX, y: sideY, side: 'right' },
      ];
    }

    return [
      { x: leftX, y: sideY, side: 'left' },
      { x: topX, y: topY, side: 'top' },
      { x: rightX, y: sideY, side: 'right' },
    ];
  }

  private renderOverflowControls(
    metrics: StageMetrics,
    baseY: number,
    cardHeight: number,
    maxOffset: number,
    totalWidth: number,
  ) {
    const buttonWidth = 24;
    const buttonHeight = 28;
    const controlsPadding = 24;
    const leftX = Math.max(metrics.stageLeft + 14, metrics.stageX - totalWidth / 2 - controlsPadding);
    const rightX = Math.min(metrics.stageRight - 14, metrics.stageX + totalWidth / 2 + controlsPadding);
    const indicatorY = baseY - cardHeight / 2 - 16;

    const makeButton = (x: number, symbol: string, enabled: boolean, delta: number) => {
      const bg = this.scene.add
        .rectangle(x, baseY, buttonWidth, buttonHeight, enabled ? 0x0f172a : 0x111827, enabled ? 0.85 : 0.45)
        .setOrigin(0.5)
        .setStrokeStyle(1, 0x94a3b8, enabled ? 0.85 : 0.35);

      const label = this.scene.add
        .text(x, baseY, symbol, {
          fontFamily: this.options.fontFamily,
          fontSize: '18px',
          color: enabled ? '#e2e8f0' : '#64748b',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setResolution(this.options.textResolution);

      if (enabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => this.shiftHandOffset(delta * this.handPageStep, maxOffset));
      }

      this.handElements.push(bg, label);
    };

    const canGoLeft = this.handOffset > 0;
    const canGoRight = this.handOffset < maxOffset;
    makeButton(leftX, '‹', canGoLeft, -1);
    makeButton(rightX, '›', canGoRight, 1);

    const start = this.handOffset + 1;
    const end = Math.min(this.handCards.length, this.handOffset + this.handVisibleCount);
    const indicator = this.scene.add
      .text(metrics.stageX, indicatorY, `${start}-${end} / ${this.handCards.length} cartas`, {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(13 * (this.options.fontScale ?? 1), 11, 14))}px`,
        color: '#93c5fd',
      })
      .setOrigin(0.5)
      .setResolution(this.options.textResolution);

    this.handElements.push(indicator);
  }

  private shiftHandOffset(delta: number, maxOffset: number) {
    const next = clamp(this.handOffset + delta, 0, maxOffset);
    if (next === this.handOffset) return;
    this.handOffset = next;
    this.renderHandCards();
  }

  private setupHandWheelInteraction(maxOffset: number) {
    this.handWheelHandler = (_pointer, _currentlyOver, _deltaX, deltaY) => {
      if (!this.handOverflowActive) return;
      if (Math.abs(deltaY) < 0.1) return;
      const now = this.scene.time.now;
      if (now - this.lastHandWheelAt < 80) return;
      this.lastHandWheelAt = now;

      const wheelStep = Math.max(2, Math.floor(this.handVisibleCount * 0.4));
      this.shiftHandOffset(deltaY > 0 ? wheelStep : -wheelStep, maxOffset);
    };

    this.scene.input.on('wheel', this.handWheelHandler);
  }

  private teardownHandWheelInteraction() {
    if (!this.handWheelHandler) return;
    this.scene.input.off('wheel', this.handWheelHandler);
    this.handWheelHandler = undefined;
  }

  private applyNickname() {
    if (!this.playerBadge) {
      return;
    }

    if (this.currentNickname) {
      this.playerBadge.setText(`Você: ${this.currentNickname}`);
    } else {
      this.playerBadge.setText('Aguardando conexão...');
    }
  }

  private getPrimaryCardSize(): { cardWidth: number; cardHeight: number } {
    const scale = this.options.tableCardScale ?? 1;
    const cardWidth = clamp(150 * scale, 100, 150);
    const cardHeight = clamp(210 * scale, 140, 210);

    return { cardWidth, cardHeight };
  }

  private getStageMetrics(): StageMetrics {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const stageLeft = this.options.hudMargin + this.options.hudWidth + this.options.hudMargin;
    const stageRight = width - this.options.hudMargin;
    const availableWidth = Math.max(140, stageRight - stageLeft);

    return {
      stageLeft,
      stageRight,
      stageX: stageLeft + availableWidth / 2,
      stageY: height / 2,
      stageWidth: availableWidth,
      stageHeight: Math.max(220, height - (this.options.stagePadding ?? 120)),
    };
  }

  /**
   * ✅ Retorna a carta atual na mesa
   */
  getTableCard(): Card | undefined {
    return this.currentTableCard;
  }

  /**
   * ✅ Retorna a cor atual da mesa
   */
  getCurrentColor(): Card['color'] | undefined {
    return this.currentTableColor;
  }

  destroy() {
    this.elements.forEach((obj) => obj.destroy());
    this.elements = [];
    this.opponentElements.forEach((obj) => obj.destroy());
    this.opponentElements = [];
    this.handElements.forEach((obj) => obj.destroy());
    this.handElements = [];
    this.teardownHandWheelInteraction();
    this.tableCardShape?.destroy();
    this.tableCardShape = undefined;
    this.tableCardText?.destroy();
    this.tableCardText = undefined;
    this.tableCardShadow?.destroy();
    this.tableCardShadow = undefined;
    this.currentTableCard = undefined;
    this.currentTableColor = undefined;
  }
}
