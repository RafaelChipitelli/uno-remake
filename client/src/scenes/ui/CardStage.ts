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

type HandCardView = {
  id: string;
  container: Phaser.GameObjects.Container;
  base: Phaser.GameObjects.Rectangle;
  value: Phaser.GameObjects.Text;
  homeX: number;
  homeY: number;
  isHovered: boolean;
};

type OpponentView = {
  container: Phaser.GameObjects.Container;
  badge: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default class CardStage {
  private static readonly CARD_HOVER_OFFSET_Y = 16;
  private static readonly HAND_SCROLL_STEP = 1;

  private scene: Phaser.Scene;
  private options: CardStageOptions;
  private onCardSelected?: (card: Card, index: number) => void;

  private handCards: Card[] = [];
  private opponents: OpponentHandSnapshot[] = [];
  private playerNickname?: string;
  private tableCard?: Card;
  private currentColor?: Card['color'];

  private allObjects: Phaser.GameObjects.GameObject[] = [];
  private handViews = new Map<string, HandCardView>();
  private visibleHandIds: string[] = [];
  private handWindowStart = 0;

  private tableGlow?: Phaser.GameObjects.Ellipse;
  private placeholderContainer?: Phaser.GameObjects.Container;
  private tableContainer?: Phaser.GameObjects.Container;
  private tableCardRect?: Phaser.GameObjects.Rectangle;
  private tableCardText?: Phaser.GameObjects.Text;
  private nicknameText?: Phaser.GameObjects.Text;
  private handNavLeft?: Phaser.GameObjects.Text;
  private handNavRight?: Phaser.GameObjects.Text;

  private opponentViews: OpponentView[] = [];
  private wheelListenerRegistered = false;

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
    this.createStaticObjects();
    this.ensureWheelNavigationListener();
    this.syncTableArea(true);
    this.syncOpponents(true);
    this.syncHand(true);
  }

  resize() {
    this.build();
  }

  setPlayerNickname(nickname?: string) {
    this.playerNickname = nickname;
    this.syncTableArea();
  }

  pulsePlaceholder() {
    if (!this.placeholderContainer || !this.placeholderContainer.visible) return;
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
    this.syncHand();
  }

  shiftHandWindow(delta: number): void {
    if (delta === 0) return;

    const { maxVisible } = this.getHandLayout(this.getMetrics());
    const maxStart = Math.max(0, this.handCards.length - maxVisible);
    if (maxStart <= 0) {
      this.handWindowStart = 0;
      return;
    }

    const nextStart = clamp(this.handWindowStart + delta, 0, maxStart);
    if (nextStart === this.handWindowStart) {
      return;
    }

    this.handWindowStart = nextStart;
    this.syncHand();
  }

  setOpponents(opponents: OpponentHandSnapshot[]) {
    this.opponents = [...opponents];
    this.syncOpponents();
  }

  setTableCard(card: Card, currentColor?: Card['color']) {
    this.tableCard = card;
    this.currentColor = currentColor ?? card.color;
    this.syncTableArea();
  }

  getTableCard(): Card | undefined {
    return this.tableCard;
  }

  getCurrentColor(): Card['color'] | undefined {
    return this.currentColor;
  }

  private createStaticObjects(): void {
    const metrics = this.getMetrics();
    const centerY = this.scene.scale.height * 0.42;
    const cardWidth = clamp(146 * (this.options.tableCardScale ?? 1), 104, 152);
    const cardHeight = cardWidth * 1.44;

    this.tableGlow = this.scene.add.ellipse(
      metrics.stageX,
      centerY + 16,
      cardWidth * 2.5,
      cardHeight * 1.2,
      phaserTheme.colors.action.primary.base,
      0.13,
    );
    this.allObjects.push(this.tableGlow);

    this.placeholderContainer = this.scene.add.container(metrics.stageX, centerY);
    const placeholderShadow = this.scene.add
      .rectangle(4, 6, cardWidth, cardHeight, phaserTheme.colors.decor.overlay, 0.35)
      .setOrigin(0.5);
    const placeholderCard = this.scene.add
      .rectangle(0, 0, cardWidth, cardHeight, phaserTheme.colors.card.wild, 0.96)
      .setOrigin(0.5)
      .setStrokeStyle(2, phaserTheme.colors.surface.disabled, 0.5);
    const placeholderText = this.scene.add
      .text(0, 0, 'UNO', {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(36 * (this.options.fontScale ?? 1), 24, 38))}px`,
        color: theme.colors.text.primary,
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setResolution(this.options.textResolution);
    this.placeholderContainer.add([placeholderShadow, placeholderCard, placeholderText]);
    this.allObjects.push(this.placeholderContainer);

    this.tableContainer = this.scene.add.container(metrics.stageX, centerY);
    const tableShadow = this.scene.add
      .rectangle(5, 7, cardWidth, cardHeight, phaserTheme.colors.decor.overlay, 0.38)
      .setOrigin(0.5);
    this.tableCardRect = this.scene.add
      .rectangle(0, 0, cardWidth, cardHeight, phaserTheme.colors.surface.disabled)
      .setOrigin(0.5)
      .setStrokeStyle(3, phaserTheme.colors.text.inverse, 0.9);
    const tableHighlight = this.scene.add.ellipse(
      0,
      -cardHeight * 0.2,
      cardWidth * 0.74,
      cardHeight * 0.28,
      phaserTheme.colors.text.inverse,
      0.15,
    );
    this.tableCardText = this.scene.add
      .text(0, 0, '', {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(52 * (this.options.fontScale ?? 1), 30, 56))}px`,
        color: theme.colors.text.inverse,
        fontStyle: '800',
      })
      .setOrigin(0.5)
      .setResolution(this.options.textResolution);
    this.tableContainer.add([tableShadow, this.tableCardRect, tableHighlight, this.tableCardText]);
    this.allObjects.push(this.tableContainer);

    this.nicknameText = this.scene.add
      .text(metrics.stageX, centerY + cardHeight / 2 + 24, 'Aguardando conexão...', {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(16 * (this.options.fontScale ?? 1), 12, 18))}px`,
        color: theme.colors.text.muted,
      })
      .setOrigin(0.5)
      .setResolution(this.options.textResolution);
    this.allObjects.push(this.nicknameText);

    this.handNavLeft = this.scene.add
      .text(0, 0, '<', {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(28 * (this.options.fontScale ?? 1), 20, 34))}px`,
        color: theme.colors.text.primary,
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setResolution(this.options.textResolution)
      .setInteractive({ useHandCursor: true });

    this.handNavRight = this.scene.add
      .text(0, 0, '>', {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(28 * (this.options.fontScale ?? 1), 20, 34))}px`,
        color: theme.colors.text.primary,
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setResolution(this.options.textResolution)
      .setInteractive({ useHandCursor: true });

    this.handNavLeft.on('pointerup', () => this.shiftHandWindow(-1));
    this.handNavRight.on('pointerup', () => this.shiftHandWindow(1));

    this.allObjects.push(this.handNavLeft, this.handNavRight);

    this.createOpponentSlots();
  }

  private createOpponentSlots(): void {
    const seats = this.getOpponentSeats();
    this.opponentViews = seats.map((seat) => {
      const container = this.scene.add.container(seat.x, seat.y);
      const badge = this.scene.add
        .rectangle(0, 0, 124, 58, phaserTheme.colors.surface.card, 0.9)
        .setOrigin(0.5)
        .setStrokeStyle(1, phaserTheme.colors.surface.panelBorder, 0.8);
      const name = this.scene.add
        .text(0, -10, '', {
          fontFamily: this.options.fontFamily,
          fontSize: `${Math.round(clamp(13 * (this.options.fontScale ?? 1), 11, 14))}px`,
          color: theme.colors.text.primary,
          fontStyle: '500',
        })
        .setOrigin(0.5)
        .setResolution(this.options.textResolution);
      const count = this.scene.add
        .text(0, 13, '', {
          fontFamily: this.options.fontFamily,
          fontSize: `${Math.round(clamp(12 * (this.options.fontScale ?? 1), 10, 13))}px`,
          color: theme.colors.text.muted,
        })
        .setOrigin(0.5)
        .setResolution(this.options.textResolution);

      container.add([badge, name, count]);
      container.setVisible(false);
      this.allObjects.push(container);

      return { container, badge, name, count };
    });
  }

  private syncTableArea(withIntroAnimation = false): void {
    if (!this.tableContainer || !this.placeholderContainer || !this.tableCardRect || !this.tableCardText || !this.nicknameText) {
      return;
    }

    const metrics = this.getMetrics();
    const centerY = this.scene.scale.height * 0.42;
    const cardWidth = clamp(146 * (this.options.tableCardScale ?? 1), 104, 152);
    const cardHeight = cardWidth * 1.44;

    this.tableGlow?.setPosition(metrics.stageX, centerY + 16).setSize(cardWidth * 2.5, cardHeight * 1.2);
    this.placeholderContainer.setPosition(metrics.stageX, centerY);
    this.tableContainer.setPosition(metrics.stageX, centerY);
    this.nicknameText
      .setPosition(metrics.stageX, centerY + cardHeight / 2 + 24)
      .setText(this.playerNickname ? `Você: ${this.playerNickname}` : 'Aguardando conexão...');

    if (!this.tableCard) {
      this.placeholderContainer.setVisible(true);
      this.tableContainer.setVisible(false);
      return;
    }

    const resolvedColor =
      this.tableCard.color === 'wild' && this.currentColor && this.currentColor !== 'wild'
        ? this.currentColor
        : this.tableCard.color;

    this.placeholderContainer.setVisible(false);
    this.tableContainer.setVisible(true);
    this.tableCardRect.setFillStyle(CARD_COLOR_HEX[resolvedColor] ?? phaserTheme.colors.surface.disabled);
    this.tableCardText.setText(this.tableCard.value);

    if (withIntroAnimation) {
      this.tableContainer.setScale(0.9).setAlpha(0);
      this.scene.tweens.add({
        targets: this.tableContainer,
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
        duration: 220,
        ease: 'Quad.easeOut',
      });
    }
  }

  private syncHand(withIntroAnimation = false): void {
    const metrics = this.getMetrics();
    const { baseY, cardWidth, cardHeight, cardGap, maxVisible } = this.getHandLayout(metrics);
    const maxStart = Math.max(0, this.handCards.length - maxVisible);
    this.handWindowStart = clamp(this.handWindowStart, 0, maxStart);

    const cards = this.handCards.slice(this.handWindowStart, this.handWindowStart + maxVisible);
    const visibleIds = new Set(cards.map((card) => card.id));

    this.visibleHandIds
      .filter((id) => !visibleIds.has(id))
      .forEach((id) => {
        const view = this.handViews.get(id);
        if (!view) return;
        view.container.destroy();
        this.handViews.delete(id);
      });

    const totalWidth = cards.length * cardWidth + Math.max(0, cards.length - 1) * cardGap;
    const startX = metrics.stageX - totalWidth / 2 + cardWidth / 2;

    cards.forEach((card, index) => {
      let view = this.handViews.get(card.id);
      const isNewCard = !view;
      if (!view) {
        view = this.createHandCardView(card, cardWidth, cardHeight);
        this.handViews.set(card.id, view);
        this.allObjects.push(view.container);
      }

      view.base.setFillStyle(CARD_COLOR_HEX[card.color] ?? phaserTheme.colors.surface.disabled);
      view.value.setText(card.value);

      const targetX = startX + index * (cardWidth + cardGap);
      view.homeX = targetX;
      view.homeY = baseY;
      const targetY = view.isHovered ? baseY - CardStage.CARD_HOVER_OFFSET_Y : baseY;

      if (withIntroAnimation) {
        view.container.setPosition(targetX, targetY + 12).setAlpha(0);
        this.scene.tweens.add({
          targets: view.container,
          alpha: 1,
          y: targetY,
          duration: 200,
          ease: 'Quad.easeOut',
        });
      } else if (isNewCard) {
        view.container.setPosition(targetX, targetY).setAlpha(1);
      } else {
        this.scene.tweens.killTweensOf(view.container);
        this.scene.tweens.add({
          targets: view.container,
          x: targetX,
          y: targetY,
          duration: 100,
          ease: 'Quad.easeOut',
        });
      }
    });

    this.visibleHandIds = cards.map((card) => card.id);
    this.syncHandNavigationUi(metrics, baseY, cardWidth, cardHeight, totalWidth, maxStart);
  }

  private syncHandNavigationUi(
    metrics: StageMetrics,
    baseY: number,
    cardWidth: number,
    cardHeight: number,
    totalWidth: number,
    maxStart: number,
  ): void {
    if (!this.handNavLeft || !this.handNavRight) {
      return;
    }

    const hasOverflow = maxStart > 0;
    if (!hasOverflow) {
      this.handNavLeft.setVisible(false).disableInteractive();
      this.handNavRight.setVisible(false).disableInteractive();
      return;
    }

    const leftEdge = metrics.stageX - totalWidth / 2;
    const rightEdge = metrics.stageX + totalWidth / 2;
    const y = baseY;
    const offset = cardWidth * 0.75;

    this.handNavLeft.setPosition(leftEdge - offset, y).setVisible(true);
    this.handNavRight.setPosition(rightEdge + offset, y).setVisible(true);

    const canGoLeft = this.handWindowStart > 0;
    const canGoRight = this.handWindowStart < maxStart;

    if (canGoLeft) {
      this.handNavLeft.setAlpha(1).setInteractive({ useHandCursor: true });
    } else {
      this.handNavLeft.setAlpha(0.35).disableInteractive();
    }

    if (canGoRight) {
      this.handNavRight.setAlpha(1).setInteractive({ useHandCursor: true });
    } else {
      this.handNavRight.setAlpha(0.35).disableInteractive();
    }

    this.handNavLeft.setScale(1);
    this.handNavRight.setScale(1);
    this.handNavLeft.setY(y - cardHeight * 0.05);
    this.handNavRight.setY(y - cardHeight * 0.05);
  }

  private getHandLayout(metrics: StageMetrics): {
    baseY: number;
    cardWidth: number;
    cardHeight: number;
    cardGap: number;
    maxVisible: number;
  } {
    const baseY = this.scene.scale.height - (this.options.handBottomOffset ?? 92);
    const isCompact = Boolean(this.options.compact);
    const cardWidth = clamp(74 * (this.options.tableCardScale ?? 1), isCompact ? 48 : 54, 90);
    const cardHeight = cardWidth * 1.42;
    const cardGap = clamp(10 * (this.options.tableCardScale ?? 1), 6, 14);
    const maxVisible = clamp(Math.floor(metrics.stageWidth / (cardWidth + cardGap)), 4, 11);

    return { baseY, cardWidth, cardHeight, cardGap, maxVisible };
  }

  private ensureWheelNavigationListener(): void {
    if (this.wheelListenerRegistered) {
      return;
    }

    this.scene.input.on('wheel', this.handleMouseWheel, this);
    this.wheelListenerRegistered = true;
  }

  private handleMouseWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
  ): void {
    const metrics = this.getMetrics();
    const { baseY, cardHeight, maxVisible } = this.getHandLayout(metrics);
    const hasOverflow = this.handCards.length > maxVisible;
    if (!hasOverflow) {
      return;
    }

    const pointerY = pointer.worldY ?? pointer.y;
    const isOverHandBand = pointerY >= baseY - cardHeight * 1.2 && pointerY <= baseY + cardHeight * 0.9;
    if (!isOverHandBand) {
      return;
    }

    const dominantDelta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
    if (dominantDelta > 0) {
      this.shiftHandWindow(CardStage.HAND_SCROLL_STEP);
    } else if (dominantDelta < 0) {
      this.shiftHandWindow(-CardStage.HAND_SCROLL_STEP);
    }
  }

  private createHandCardView(card: Card, cardWidth: number, cardHeight: number): HandCardView {
    const container = this.scene.add.container(0, 0);
    const shadow = this.scene.add
      .rectangle(2, 4, cardWidth, cardHeight, phaserTheme.colors.decor.overlay, 0.34)
      .setOrigin(0.5);
    const base = this.scene.add
      .rectangle(0, 0, cardWidth, cardHeight, CARD_COLOR_HEX[card.color] ?? phaserTheme.colors.surface.disabled)
      .setOrigin(0.5)
      .setStrokeStyle(2, phaserTheme.colors.text.inverse, 0.9);
    const highlight = this.scene.add.ellipse(
      0,
      -cardHeight * 0.24,
      cardWidth * 0.7,
      cardHeight * 0.28,
      phaserTheme.colors.text.inverse,
      0.14,
    );
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

    const view: HandCardView = { id: card.id, container, base, value, homeX: 0, homeY: 0, isHovered: false };

    container.on('pointerover', () => {
      view.isHovered = true;
      this.scene.tweens.killTweensOf(container);
      this.scene.tweens.add({
        targets: container,
        y: view.homeY - CardStage.CARD_HOVER_OFFSET_Y,
        scaleX: 1.03,
        scaleY: 1.03,
        duration: 160,
        ease: 'Quad.easeOut',
      });
      base.setStrokeStyle(3, phaserTheme.colors.text.inverse, 1);
    });

    container.on('pointerout', () => {
      view.isHovered = false;
      this.scene.tweens.killTweensOf(container);
      this.scene.tweens.add({
        targets: container,
        x: view.homeX,
        y: view.homeY,
        scaleX: 1,
        scaleY: 1,
        duration: 160,
        ease: 'Quad.easeOut',
      });
      base.setStrokeStyle(2, phaserTheme.colors.text.inverse, 0.9);
    });

    container.on('pointerdown', () => {
      this.scene.tweens.add({ targets: container, scaleX: 0.97, scaleY: 0.97, duration: 90, ease: 'Quad.easeInOut' });
    });

    container.on('pointerup', () => {
      this.scene.tweens.add({ targets: container, scaleX: 1.04, scaleY: 1.04, duration: 90, yoyo: true, ease: 'Back.easeOut' });
      const index = this.handCards.findIndex((handCard) => handCard.id === card.id);
      if (index !== -1) {
        this.onCardSelected?.(this.handCards[index], index);
      }
    });

    return view;
  }

  private syncOpponents(withIntroAnimation = false): void {
    const seats = this.getOpponentSeats();

    this.opponentViews.forEach((view, idx) => {
      const seat = seats[idx];
      if (seat) {
        view.container.setPosition(seat.x, seat.y);
      }

      const opponent = this.opponents[idx];
      if (!opponent) {
        view.container.setVisible(false);
        return;
      }

      view.container.setVisible(true);
      view.name.setText(opponent.nickname);
      view.count.setText(`🃏 ${opponent.cardCount}`);
      view.badge.setStrokeStyle(
        1,
        opponent.isTurn ? phaserTheme.colors.status.success : phaserTheme.colors.surface.panelBorder,
        opponent.isTurn ? 1 : 0.8,
      );
      view.name.setColor(opponent.isTurn ? theme.colors.status.success : theme.colors.text.primary);
      view.name.setFontStyle(opponent.isTurn ? '700' : '500');

      if (withIntroAnimation) {
        view.container.setAlpha(0);
        this.scene.tweens.add({
          targets: view.container,
          alpha: 1,
          duration: 180,
          delay: idx * 40,
          ease: 'Sine.easeOut',
        });
      }
    });
  }

  private getOpponentSeats(): Array<{ x: number; y: number }> {
    const metrics = this.getMetrics();
    const topY = clamp(this.scene.scale.height * 0.15, 60, 130);
    const sideY = clamp(this.scene.scale.height * 0.42, 170, this.scene.scale.height * 0.52);
    const leftX = metrics.stageLeft + clamp(metrics.stageWidth * 0.12, 28, 64);
    const rightX = metrics.stageRight - clamp(metrics.stageWidth * 0.12, 28, 64);

    return [
      { x: metrics.stageX, y: topY },
      { x: leftX, y: sideY },
      { x: rightX, y: sideY },
    ];
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
    this.allObjects.forEach((obj) => obj.destroy());
    this.allObjects = [];
    this.handViews.clear();
    this.visibleHandIds = [];
    this.opponentViews = [];
    this.tableGlow = undefined;
    this.placeholderContainer = undefined;
    this.tableContainer = undefined;
    this.tableCardRect = undefined;
    this.tableCardText = undefined;
    this.nicknameText = undefined;
    this.handNavLeft = undefined;
    this.handNavRight = undefined;
  }

  private unregisterWheelNavigationListener(): void {
    if (!this.wheelListenerRegistered) {
      return;
    }

    this.scene.input.off('wheel', this.handleMouseWheel, this);
    this.wheelListenerRegistered = false;
  }

  destroy() {
    this.unregisterWheelNavigationListener();
    this.clearStageObjects();
  }
}
