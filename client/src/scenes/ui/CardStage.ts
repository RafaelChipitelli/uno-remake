import Phaser from 'phaser';
import { CARD_COLOR_HEX } from '../../game/colors';
import { getCardDisplayParts, getCardDisplayScale, getCardDisplayValue } from '../../game/cardDisplay';
import { phaserTheme, theme } from '../../theme/tokens';
import type { Card } from '../../types';
import { t } from '../../i18n';

type CardStageOptions = {
  hudWidth: number;
  hudMargin: number;
  hudMode?: 'sidebar' | 'overlay';
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
  surface: RoundedSurface;
  value: Phaser.GameObjects.Text;
  homeX: number;
  homeY: number;
  isHovered: boolean;
};

type OpponentView = {
  container: Phaser.GameObjects.Container;
  badge: RoundedSurface;
  name: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
};

type TurnIndicatorPhase = 'waiting' | 'in_progress' | 'finished';

type TurnIndicatorState = {
  phase: TurnIndicatorPhase;
  isMyTurn?: boolean;
  currentTurnNickname?: string;
};

type HandSwipeState = {
  pointerId: number;
  startX: number;
  startY: number;
  lastAppliedX: number;
  isDragging: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type RoundedSurfaceStyle = {
  fill: number;
  fillAlpha?: number;
  stroke?: number;
  strokeAlpha?: number;
  strokeWidth?: number;
  sheen?: number;
};

type RoundedSurface = {
  gfx: Phaser.GameObjects.Graphics;
  redraw: (next?: Partial<RoundedSurfaceStyle>) => void;
  resize: (width: number, height: number) => void;
};

// Soft rounded panel/card drawn with Graphics (Phaser's rectangle GameObject
// can't round corners). Keeps last style so resize() can redraw faithfully.
function createRoundedSurface(
  scene: Phaser.Scene,
  width: number,
  height: number,
  radius: number,
  initial: RoundedSurfaceStyle,
): RoundedSurface {
  const gfx = scene.add.graphics();
  let w = width;
  let h = height;
  let style: RoundedSurfaceStyle = { fillAlpha: 1, strokeAlpha: 1, strokeWidth: 2, sheen: 0, ...initial };

  const draw = () => {
    const r = Math.min(radius, Math.min(w, h) / 2);
    gfx.clear();
    gfx.fillStyle(style.fill, style.fillAlpha ?? 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    if (style.stroke !== undefined) {
      gfx.lineStyle(style.strokeWidth ?? 2, style.stroke, style.strokeAlpha ?? 1);
      gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    }
    if (style.sheen && style.sheen > 0) {
      gfx.fillStyle(0xffffff, style.sheen);
      gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.4, r * 0.7);
    }
  };

  draw();

  return {
    gfx,
    redraw: (next) => {
      if (next) style = { ...style, ...next };
      draw();
    },
    resize: (nextWidth, nextHeight) => {
      w = nextWidth;
      h = nextHeight;
      draw();
    },
  };
}

function addRoundedShadow(
  scene: Phaser.Scene,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  color: number,
  alpha: number,
  radius: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(color, alpha);
  g.fillRoundedRect(-width / 2 + offsetX, -height / 2 + offsetY, width, height, radius);
  return g;
}

export default class CardStage {
  private static readonly CARD_HOVER_OFFSET_Y = 16;
  private static readonly HAND_SCROLL_STEP = 1;
  private static readonly HAND_SWIPE_ACTIVATION_PX = 24;
  private static readonly HAND_SWIPE_STEP_PX = 44;
  private static readonly HAND_SWIPE_TAP_SUPPRESS_MS = 180;
  private static readonly MOBILE_HUD_BUTTON_HEIGHT = 50;
  private static readonly MOBILE_HUD_BOTTOM_INSET = 24;
  private static readonly MOBILE_HAND_SAFE_GAP = 14;

  private scene: Phaser.Scene;
  private options: CardStageOptions;
  private onCardSelected?: (card: Card, index: number) => void;

  private handCards: Card[] = [];
  private opponents: OpponentHandSnapshot[] = [];
  private tableCard?: Card;
  private currentColor?: Card['color'];

  private allObjects: Phaser.GameObjects.GameObject[] = [];
  private handViews = new Map<string, HandCardView>();
  private visibleHandIds: string[] = [];
  private handWindowStart = 0;

  private tableGlow?: Phaser.GameObjects.Ellipse;
  private placeholderContainer?: Phaser.GameObjects.Container;
  private tableContainer?: Phaser.GameObjects.Container;
  private tableCardSurface?: RoundedSurface;
  private tableCardText?: Phaser.GameObjects.Text;
  private turnIndicatorContainer?: Phaser.GameObjects.Container;
  private turnIndicatorBg?: RoundedSurface;
  private turnIndicatorText?: Phaser.GameObjects.Text;
  private turnIndicatorPulseTween?: Phaser.Tweens.Tween;
  private handNavLeftBg?: Phaser.GameObjects.Ellipse;
  private handNavRightBg?: Phaser.GameObjects.Ellipse;
  private handNavLeft?: Phaser.GameObjects.Text;
  private handNavRight?: Phaser.GameObjects.Text;
  private handHiddenLeftCount?: Phaser.GameObjects.Text;
  private handHiddenRightCount?: Phaser.GameObjects.Text;
  private handSwipeHint?: Phaser.GameObjects.Text;

  private opponentViews: OpponentView[] = [];
  private wheelListenerRegistered = false;
  private touchSwipeListenersRegistered = false;
  private handSwipeState?: HandSwipeState;
  private suppressCardTapUntil = 0;
  private turnIndicatorPhase: TurnIndicatorPhase = 'waiting';
  private isMyTurn = false;
  private currentTurnNickname?: string;

  constructor(scene: Phaser.Scene, options: CardStageOptions) {
    this.scene = scene;
    this.options = options;
    this.onCardSelected = options.onCardSelected;
  }

  setLayoutMetrics(
    partial: Pick<
      CardStageOptions,
      | 'hudWidth'
      | 'hudMargin'
      | 'hudMode'
      | 'stagePadding'
      | 'handBottomOffset'
      | 'tableCardScale'
      | 'fontScale'
      | 'compact'
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

  setTurnIndicator(state: TurnIndicatorState) {
    this.turnIndicatorPhase = state.phase;
    this.isMyTurn = Boolean(state.isMyTurn);
    this.currentTurnNickname = state.currentTurnNickname;
    this.syncTurnIndicator();
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

    const tableRadius = clamp(cardWidth * 0.13, 10, 20);

    this.placeholderContainer = this.scene.add.container(metrics.stageX, centerY);
    const placeholderShadow = addRoundedShadow(this.scene, cardWidth, cardHeight, 4, 6, phaserTheme.colors.decor.overlay, 0.35, tableRadius);
    const placeholderCard = createRoundedSurface(this.scene, cardWidth, cardHeight, tableRadius, {
      fill: phaserTheme.colors.card.wild,
      fillAlpha: 0.96,
      stroke: phaserTheme.colors.surface.disabled,
      strokeAlpha: 0.5,
      strokeWidth: 2,
    }).gfx;
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
    const tableShadow = addRoundedShadow(this.scene, cardWidth, cardHeight, 5, 7, phaserTheme.colors.decor.overlay, 0.38, tableRadius);
    this.tableCardSurface = createRoundedSurface(this.scene, cardWidth, cardHeight, tableRadius, {
      fill: phaserTheme.colors.surface.disabled,
      fillAlpha: 1,
      stroke: phaserTheme.colors.text.inverse,
      strokeAlpha: 0.9,
      strokeWidth: 3,
      sheen: 0.15,
    });
    this.tableCardText = this.scene.add
      .text(0, 0, '', {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(52 * (this.options.fontScale ?? 1), 30, 56))}px`,
        color: theme.colors.text.inverse,
        fontStyle: '800',
        align: 'center',
      })
      .setOrigin(0.5)
      .setResolution(this.options.textResolution);
    this.tableContainer.add([tableShadow, this.tableCardSurface.gfx, this.tableCardText]);
    this.allObjects.push(this.tableContainer);

    const indicatorWidth = clamp(metrics.stageWidth * 0.42, 210, 360);
    const indicatorHeight = this.options.compact ? 38 : 44;
    const indicatorY = centerY + cardHeight / 2 + (this.options.compact ? 54 : 62);

    this.turnIndicatorContainer = this.scene.add.container(metrics.stageX, indicatorY);
    this.turnIndicatorBg = createRoundedSurface(this.scene, indicatorWidth, indicatorHeight, indicatorHeight / 2, {
      fill: phaserTheme.colors.surface.card,
      fillAlpha: 0.9,
      stroke: phaserTheme.colors.surface.panelBorder,
      strokeAlpha: 0.9,
      strokeWidth: 1,
    });
    this.turnIndicatorText = this.scene.add
      .text(0, 0, t('game.stage.turn.waiting'), {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp((this.options.compact ? 15 : 17) * (this.options.fontScale ?? 1), 12, 20))}px`,
        color: theme.colors.text.muted,
        fontStyle: '600',
      })
      .setOrigin(0.5)
      .setResolution(this.options.textResolution);
    this.turnIndicatorContainer.add([this.turnIndicatorBg.gfx, this.turnIndicatorText]);
    this.allObjects.push(this.turnIndicatorContainer);
    this.syncTurnIndicator();

    this.handNavLeftBg = this.scene.add
      .ellipse(0, 0, 42, 42, phaserTheme.colors.decor.overlay, 0.74)
      .setStrokeStyle(2, phaserTheme.colors.text.inverse, 0.72)
      .setDepth(20)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    this.handNavRightBg = this.scene.add
      .ellipse(0, 0, 42, 42, phaserTheme.colors.decor.overlay, 0.74)
      .setStrokeStyle(2, phaserTheme.colors.text.inverse, 0.72)
      .setDepth(20)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    this.handNavLeft = this.scene.add
      .text(0, 0, '‹', {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(36 * (this.options.fontScale ?? 1), 28, 42))}px`,
        color: theme.colors.text.primary,
        fontStyle: '800',
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setResolution(this.options.textResolution)
      .setInteractive({ useHandCursor: true });

    this.handNavRight = this.scene.add
      .text(0, 0, '›', {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(36 * (this.options.fontScale ?? 1), 28, 42))}px`,
        color: theme.colors.text.primary,
        fontStyle: '800',
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setResolution(this.options.textResolution)
      .setInteractive({ useHandCursor: true });

    this.handNavLeftBg.on('pointerup', () => this.shiftHandWindow(-1));
    this.handNavRightBg.on('pointerup', () => this.shiftHandWindow(1));
    this.handNavLeft.on('pointerup', () => this.shiftHandWindow(-1));
    this.handNavRight.on('pointerup', () => this.shiftHandWindow(1));

    this.handHiddenLeftCount = this.scene.add
      .text(0, 0, '0', {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(13 * (this.options.fontScale ?? 1), 11, 15))}px`,
        color: theme.colors.text.primary,
        fontStyle: '800',
      })
      .setOrigin(0.5)
      .setAlpha(0.95)
      .setDepth(22)
      .setPadding(6, 2, 6, 2)
      .setBackgroundColor('rgba(7, 10, 20, 0.86)')
      .setResolution(this.options.textResolution)
      .setVisible(false);

    this.handHiddenRightCount = this.scene.add
      .text(0, 0, '0', {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(13 * (this.options.fontScale ?? 1), 11, 15))}px`,
        color: theme.colors.text.primary,
        fontStyle: '800',
      })
      .setOrigin(0.5)
      .setAlpha(0.95)
      .setDepth(22)
      .setPadding(6, 2, 6, 2)
      .setBackgroundColor('rgba(7, 10, 20, 0.86)')
      .setResolution(this.options.textResolution)
      .setVisible(false);

    this.handSwipeHint = this.scene.add
      .text(0, 0, t('game.stage.hand.swipeHint'), {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(12 * (this.options.fontScale ?? 1), 10, 14))}px`,
        color: theme.colors.text.muted,
        fontStyle: '600',
      })
      .setOrigin(0.5)
      .setDepth(19)
      .setAlpha(0.92)
      .setResolution(this.options.textResolution)
      .setVisible(false);

    this.allObjects.push(
      this.handNavLeftBg,
      this.handNavRightBg,
      this.handNavLeft,
      this.handNavRight,
      this.handHiddenLeftCount,
      this.handHiddenRightCount,
      this.handSwipeHint,
    );

    this.createOpponentSlots();
  }

  private createOpponentSlots(): void {
    const seats = this.getOpponentSeats();
    this.opponentViews = seats.map((seat) => {
      const container = this.scene.add.container(seat.x, seat.y);
      const badge = createRoundedSurface(this.scene, 124, 58, 14, {
        fill: phaserTheme.colors.surface.card,
        fillAlpha: 0.9,
        stroke: phaserTheme.colors.surface.panelBorder,
        strokeAlpha: 0.8,
        strokeWidth: 1,
      });
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

      container.add([badge.gfx, name, count]);
      container.setVisible(false);
      this.allObjects.push(container);

      return { container, badge, name, count };
    });
  }

  private syncTableArea(withIntroAnimation = false): void {
    if (!this.tableContainer || !this.placeholderContainer || !this.tableCardSurface || !this.tableCardText) {
      return;
    }

    const metrics = this.getMetrics();
    const centerY = this.scene.scale.height * 0.42;
    const cardWidth = clamp(146 * (this.options.tableCardScale ?? 1), 104, 152);
    const cardHeight = cardWidth * 1.44;

    this.tableGlow?.setPosition(metrics.stageX, centerY + 16).setSize(cardWidth * 2.5, cardHeight * 1.2);
    this.placeholderContainer.setPosition(metrics.stageX, centerY);
    this.tableContainer.setPosition(metrics.stageX, centerY);

    const indicatorWidth = clamp(metrics.stageWidth * 0.42, 210, 360);
    const indicatorHeight = this.options.compact ? 38 : 44;
    this.turnIndicatorContainer?.setPosition(metrics.stageX, centerY + cardHeight / 2 + (this.options.compact ? 54 : 62));
    this.turnIndicatorBg?.resize(indicatorWidth, indicatorHeight);
    this.syncTurnIndicator();

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
    this.tableCardSurface.redraw({ fill: CARD_COLOR_HEX[resolvedColor] ?? phaserTheme.colors.surface.disabled });
    const tableLabel = getCardDisplayValue(this.tableCard.value);
    const tableSymbol = getCardDisplayParts(this.tableCard.value).symbol;
    const tableLabelScale = getCardDisplayScale(this.tableCard.value);
    this.tableCardText
      .setText(tableSymbol ? `${tableLabel}\n${tableSymbol}` : tableLabel)
      .setFontSize(Math.round(clamp(52 * (this.options.fontScale ?? 1) * tableLabelScale, 18, 56)))
      .setLineSpacing(tableSymbol ? -8 : 0);

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

  private syncTurnIndicator(): void {
    if (!this.turnIndicatorContainer || !this.turnIndicatorBg || !this.turnIndicatorText) {
      return;
    }

    if (this.turnIndicatorPhase === 'in_progress' && this.isMyTurn) {
      this.turnIndicatorText
        .setText(t('game.stage.turn.myTurn'))
        .setColor(theme.colors.status.success)
        .setFontStyle('700');
      this.turnIndicatorBg.redraw({
        fill: phaserTheme.colors.status.success,
        fillAlpha: 0.2,
        stroke: phaserTheme.colors.status.success,
        strokeAlpha: 1,
        strokeWidth: 2,
      });

      if (!this.turnIndicatorPulseTween) {
        this.turnIndicatorPulseTween = this.scene.tweens.add({
          targets: this.turnIndicatorContainer,
          alpha: { from: 0.86, to: 1 },
          scaleX: { from: 1, to: 1.03 },
          scaleY: { from: 1, to: 1.03 },
          duration: 520,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
      return;
    }

    if (this.turnIndicatorPhase === 'waiting') {
      const waitingText = t('game.stage.turn.waitingHost');

      this.turnIndicatorText
        .setText(waitingText)
        .setColor(theme.colors.text.muted)
        .setFontStyle('600');
      this.turnIndicatorBg.redraw({
        fill: phaserTheme.colors.surface.card,
        fillAlpha: 0.9,
        stroke: phaserTheme.colors.surface.panelBorder,
        strokeAlpha: 0.9,
        strokeWidth: 1,
      });

      if (this.turnIndicatorPulseTween) {
        this.turnIndicatorPulseTween.stop();
        this.turnIndicatorPulseTween.remove();
        this.turnIndicatorPulseTween = undefined;
      }

      this.turnIndicatorContainer.setAlpha(1).setScale(1);
      return;
    }

    if (this.turnIndicatorPhase === 'finished') {
      this.turnIndicatorText
        .setText(t('game.stage.turn.finished'))
        .setColor(theme.colors.text.muted)
        .setFontStyle('600');
      this.turnIndicatorBg.redraw({
        fill: phaserTheme.colors.surface.card,
        fillAlpha: 0.9,
        stroke: phaserTheme.colors.surface.panelBorder,
        strokeAlpha: 0.9,
        strokeWidth: 1,
      });

      if (this.turnIndicatorPulseTween) {
        this.turnIndicatorPulseTween.stop();
        this.turnIndicatorPulseTween.remove();
        this.turnIndicatorPulseTween = undefined;
      }

      this.turnIndicatorContainer.setAlpha(1).setScale(1);
      return;
    }

    const waitingText = this.currentTurnNickname
      ? t('game.stage.turn.of', { nickname: this.currentTurnNickname })
      : t('game.stage.turn.waiting');
    this.turnIndicatorText
      .setText(waitingText)
      .setColor(theme.colors.text.muted)
      .setFontStyle('600');
    this.turnIndicatorBg.redraw({
      fill: phaserTheme.colors.surface.card,
      fillAlpha: 0.9,
      stroke: phaserTheme.colors.surface.panelBorder,
      strokeAlpha: 0.9,
      strokeWidth: 1,
    });

    if (this.turnIndicatorPulseTween) {
      this.turnIndicatorPulseTween.stop();
      this.turnIndicatorPulseTween.remove();
      this.turnIndicatorPulseTween = undefined;
    }

    this.turnIndicatorContainer.setAlpha(1).setScale(1);
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

      view.surface.redraw({ fill: CARD_COLOR_HEX[card.color] ?? phaserTheme.colors.surface.disabled });
      const displayLabel = getCardDisplayValue(card.value);
      const displaySymbol = getCardDisplayParts(card.value).symbol;
      const labelScale = getCardDisplayScale(card.value);
      view.value
        .setText(displaySymbol ? `${displayLabel}\n${displaySymbol}` : displayLabel)
        .setFontSize(Math.round(clamp(cardWidth * 0.32 * labelScale, 10, 24)))
        .setLineSpacing(displaySymbol ? -6 : 0);

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
    if (
      !this.handNavLeftBg ||
      !this.handNavRightBg ||
      !this.handNavLeft ||
      !this.handNavRight ||
      !this.handHiddenLeftCount ||
      !this.handHiddenRightCount ||
      !this.handSwipeHint
    ) {
      return;
    }

    const hasOverflow = maxStart > 0;
    if (!hasOverflow) {
      this.handNavLeftBg.setVisible(false).disableInteractive();
      this.handNavRightBg.setVisible(false).disableInteractive();
      this.handNavLeft.setVisible(false).disableInteractive();
      this.handNavRight.setVisible(false).disableInteractive();
      this.handHiddenLeftCount.setVisible(false);
      this.handHiddenRightCount.setVisible(false);
      this.handSwipeHint.setVisible(false);
      return;
    }

    const leftEdge = metrics.stageX - totalWidth / 2;
    const rightEdge = metrics.stageX + totalWidth / 2;
    const y = baseY - cardHeight * 0.05;
    const offset = cardWidth * 0.75;
    const isCompact = Boolean(this.options.compact) || this.options.hudMode === 'overlay';
    const navSize = isCompact ? 46 : 42;
    const safeInset = navSize / 2 + 8;
    const leftRawX = isCompact ? leftEdge + navSize * 0.35 : leftEdge - offset;
    const rightRawX = isCompact ? rightEdge - navSize * 0.35 : rightEdge + offset;
    const leftX = clamp(leftRawX, metrics.stageLeft + safeInset, metrics.stageRight - safeInset);
    const rightX = clamp(rightRawX, metrics.stageLeft + safeInset, metrics.stageRight - safeInset);

    this.handNavLeftBg.setPosition(leftX, y).setSize(navSize, navSize).setVisible(true);
    this.handNavRightBg.setPosition(rightX, y).setSize(navSize, navSize).setVisible(true);
    this.handNavLeft.setPosition(leftX, y - 2).setVisible(true);
    this.handNavRight.setPosition(rightX, y - 2).setVisible(true);

    const canGoLeft = this.handWindowStart > 0;
    const canGoRight = this.handWindowStart < maxStart;
    const hiddenLeftCount = this.handWindowStart;
    const hiddenRightCount = maxStart - this.handWindowStart;

    if (canGoLeft) {
      this.handNavLeftBg.setAlpha(0.92).setInteractive({ useHandCursor: true });
      this.handNavLeft.setAlpha(1).setInteractive({ useHandCursor: true });
    } else {
      this.handNavLeftBg.setAlpha(0.26).disableInteractive();
      this.handNavLeft.setAlpha(0.35).disableInteractive();
    }

    if (canGoRight) {
      this.handNavRightBg.setAlpha(0.92).setInteractive({ useHandCursor: true });
      this.handNavRight.setAlpha(1).setInteractive({ useHandCursor: true });
    } else {
      this.handNavRightBg.setAlpha(0.26).disableInteractive();
      this.handNavRight.setAlpha(0.35).disableInteractive();
    }

    this.handNavLeft.setScale(1);
    this.handNavRight.setScale(1);

    const countOffsetY = cardHeight * 0.32;
    this.handHiddenLeftCount
      .setPosition(this.handNavLeft.x, this.handNavLeft.y + countOffsetY)
      .setText(`+${hiddenLeftCount}`)
      .setVisible(hiddenLeftCount > 0);
    this.handHiddenRightCount
      .setPosition(this.handNavRight.x, this.handNavRight.y + countOffsetY)
      .setText(`+${hiddenRightCount}`)
      .setVisible(hiddenRightCount > 0);

    this.handSwipeHint
      .setPosition(metrics.stageX, baseY - cardHeight * 0.72)
      .setVisible(isCompact);
  }

  private getHandLayout(metrics: StageMetrics): {
    baseY: number;
    cardWidth: number;
    cardHeight: number;
    cardGap: number;
    maxVisible: number;
  } {
    const viewportHeight = this.scene.scale.height;
    const baseYRaw = viewportHeight - (this.options.handBottomOffset ?? 92);
    const isCompact = Boolean(this.options.compact);
    const cardWidth = clamp(74 * (this.options.tableCardScale ?? 1), isCompact ? 48 : 54, 90);
    const cardHeight = cardWidth * 1.42;
    const cardGap = clamp(10 * (this.options.tableCardScale ?? 1), 6, 14);
    const maxVisible = clamp(Math.floor(metrics.stageWidth / (cardWidth + cardGap)), 4, 11);

    let baseY = baseYRaw;
    if (this.options.hudMode === 'overlay') {
      const overlayButtonsTopY =
        viewportHeight -
        this.options.hudMargin -
        CardStage.MOBILE_HUD_BOTTOM_INSET -
        CardStage.MOBILE_HUD_BUTTON_HEIGHT / 2;
      const maxSafeBaseY =
        overlayButtonsTopY -
        CardStage.MOBILE_HAND_SAFE_GAP -
        cardHeight / 2;
      baseY = Math.min(baseYRaw, maxSafeBaseY);
    }

    return { baseY, cardWidth, cardHeight, cardGap, maxVisible };
  }

  private ensureWheelNavigationListener(): void {
    if (this.wheelListenerRegistered) {
      return;
    }

    this.scene.input.on('wheel', this.handleMouseWheel, this);
    this.wheelListenerRegistered = true;
    this.ensureTouchSwipeNavigationListeners();
  }

  private ensureTouchSwipeNavigationListeners(): void {
    if (this.touchSwipeListenersRegistered) {
      return;
    }

    this.scene.input.on('pointerdown', this.handlePointerDownForHandSwipe, this);
    this.scene.input.on('pointermove', this.handlePointerMoveForHandSwipe, this);
    this.scene.input.on('pointerup', this.handlePointerUpForHandSwipe, this);
    this.scene.input.on('pointerupoutside', this.handlePointerUpForHandSwipe, this);
    this.touchSwipeListenersRegistered = true;
  }

  private handleMouseWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
  ): void {
    const metrics = this.getMetrics();
    const handContext = this.getHandInteractionContext(metrics);
    const { baseY, cardHeight, hasOverflow } = handContext;
    if (!hasOverflow) {
      return;
    }

    const pointerY = pointer.worldY ?? pointer.y;
    const isOverHandBand = this.isPointerOverHandBand(pointerY, baseY, cardHeight);
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

  private handlePointerDownForHandSwipe(pointer: Phaser.Input.Pointer): void {
    if (!this.isTouchSwipeEnabled(pointer)) {
      return;
    }

    const metrics = this.getMetrics();
    const { baseY, cardHeight, hasOverflow } = this.getHandInteractionContext(metrics);
    if (!hasOverflow) {
      this.handSwipeState = undefined;
      return;
    }

    const pointerY = pointer.worldY ?? pointer.y;
    if (!this.isPointerOverHandBand(pointerY, baseY, cardHeight)) {
      this.handSwipeState = undefined;
      return;
    }

    const pointerX = pointer.worldX ?? pointer.x;
    this.handSwipeState = {
      pointerId: pointer.id,
      startX: pointerX,
      startY: pointerY,
      lastAppliedX: pointerX,
      isDragging: false,
    };
  }

  private handlePointerMoveForHandSwipe(pointer: Phaser.Input.Pointer): void {
    const state = this.handSwipeState;
    if (!state || pointer.id !== state.pointerId || !this.isTouchSwipeEnabled(pointer)) {
      return;
    }

    const pointerX = pointer.worldX ?? pointer.x;
    const pointerY = pointer.worldY ?? pointer.y;
    const deltaX = pointerX - state.startX;
    const deltaY = pointerY - state.startY;

    if (!state.isDragging) {
      const horizontalDistance = Math.abs(deltaX);
      const verticalDistance = Math.abs(deltaY);
      if (horizontalDistance < CardStage.HAND_SWIPE_ACTIVATION_PX || horizontalDistance <= verticalDistance) {
        return;
      }
      state.isDragging = true;
    }

    let deltaSinceLastStep = pointerX - state.lastAppliedX;
    while (Math.abs(deltaSinceLastStep) >= CardStage.HAND_SWIPE_STEP_PX) {
      const direction = deltaSinceLastStep < 0 ? CardStage.HAND_SCROLL_STEP : -CardStage.HAND_SCROLL_STEP;
      this.shiftHandWindow(direction);
      state.lastAppliedX += Math.sign(deltaSinceLastStep) * CardStage.HAND_SWIPE_STEP_PX;
      deltaSinceLastStep = pointerX - state.lastAppliedX;
    }
  }

  private handlePointerUpForHandSwipe(pointer: Phaser.Input.Pointer): void {
    const state = this.handSwipeState;
    if (!state || pointer.id !== state.pointerId) {
      return;
    }

    if (state.isDragging) {
      this.suppressCardTapUntil = Date.now() + CardStage.HAND_SWIPE_TAP_SUPPRESS_MS;
    }

    this.handSwipeState = undefined;
  }

  private isPointerOverHandBand(pointerY: number, baseY: number, cardHeight: number): boolean {
    return pointerY >= baseY - cardHeight * 1.2 && pointerY <= baseY + cardHeight * 0.9;
  }

  private isTouchSwipeEnabled(pointer: Phaser.Input.Pointer): boolean {
    if (this.options.hudMode !== 'overlay') {
      return false;
    }

    const nativeEvent = pointer.event as PointerEvent | TouchEvent | MouseEvent | undefined;
    if (!nativeEvent) {
      return false;
    }

    if ('pointerType' in nativeEvent) {
      return nativeEvent.pointerType === 'touch';
    }

    if (typeof TouchEvent !== 'undefined' && nativeEvent instanceof TouchEvent) {
      return true;
    }

    return nativeEvent.type.startsWith('touch');
  }

  private getHandInteractionContext(metrics: StageMetrics): {
    baseY: number;
    cardHeight: number;
    hasOverflow: boolean;
  } {
    const { baseY, cardHeight, maxVisible } = this.getHandLayout(metrics);
    const hasOverflow = this.handCards.length > maxVisible;
    return { baseY, cardHeight, hasOverflow };
  }

  private createHandCardView(card: Card, cardWidth: number, cardHeight: number): HandCardView {
    const container = this.scene.add.container(0, 0);
    const cardRadius = clamp(cardWidth * 0.14, 6, 14);
    const shadow = addRoundedShadow(this.scene, cardWidth, cardHeight, 2, 4, phaserTheme.colors.decor.overlay, 0.34, cardRadius);
    const surface = createRoundedSurface(this.scene, cardWidth, cardHeight, cardRadius, {
      fill: CARD_COLOR_HEX[card.color] ?? phaserTheme.colors.surface.disabled,
      fillAlpha: 1,
      stroke: phaserTheme.colors.text.inverse,
      strokeAlpha: 0.9,
      strokeWidth: 2,
      sheen: 0.14,
    });
    const cardDisplay = getCardDisplayParts(card.value);
    const value = this.scene.add
      .text(0, 0, cardDisplay.symbol ? `${cardDisplay.label}\n${cardDisplay.symbol}` : cardDisplay.label, {
        fontFamily: this.options.fontFamily,
        fontSize: `${Math.round(clamp(cardWidth * 0.32 * getCardDisplayScale(card.value), 10, 24))}px`,
        color: theme.colors.text.inverse,
        fontStyle: '800',
        align: 'center',
      })
      .setOrigin(0.5)
      .setLineSpacing(cardDisplay.symbol ? -6 : 0)
      .setResolution(this.options.textResolution);

    container.add([shadow, surface.gfx, value]);
    container.setSize(cardWidth, cardHeight);
    container.setInteractive({ useHandCursor: true });

    const view: HandCardView = { id: card.id, container, surface, value, homeX: 0, homeY: 0, isHovered: false };

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
      view.surface.redraw({ strokeWidth: 3, strokeAlpha: 1 });
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
      view.surface.redraw({ strokeWidth: 2, strokeAlpha: 0.9 });
    });

    container.on('pointerdown', () => {
      this.scene.tweens.add({ targets: container, scaleX: 0.97, scaleY: 0.97, duration: 90, ease: 'Quad.easeInOut' });
    });

    container.on('pointerup', () => {
      if (Date.now() < this.suppressCardTapUntil) {
        return;
      }

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
      view.badge.redraw({
        stroke: opponent.isTurn ? phaserTheme.colors.status.success : phaserTheme.colors.surface.panelBorder,
        strokeAlpha: opponent.isTurn ? 1 : 0.8,
        strokeWidth: 1,
      });
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
    const topY =
      this.options.hudMode === 'overlay'
        ? clamp(this.scene.scale.height * 0.18, 86, 140)
        : clamp(this.scene.scale.height * 0.15, 60, 130);
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
    const stageLeft =
      this.options.hudMode === 'overlay'
        ? this.options.hudMargin
        : this.options.hudMargin + this.options.hudWidth + this.options.hudMargin;
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
    if (this.turnIndicatorPulseTween) {
      this.turnIndicatorPulseTween.stop();
      this.turnIndicatorPulseTween.remove();
      this.turnIndicatorPulseTween = undefined;
    }

    this.allObjects.forEach((obj) => obj.destroy());
    this.allObjects = [];
    this.handViews.clear();
    this.visibleHandIds = [];
    this.opponentViews = [];
    this.tableGlow = undefined;
    this.placeholderContainer = undefined;
    this.tableContainer = undefined;
    this.tableCardSurface = undefined;
    this.tableCardText = undefined;
    this.turnIndicatorContainer = undefined;
    this.turnIndicatorBg = undefined;
    this.turnIndicatorText = undefined;
    this.handNavLeft = undefined;
    this.handNavRight = undefined;
    this.handNavLeftBg = undefined;
    this.handNavRightBg = undefined;
    this.handHiddenLeftCount = undefined;
    this.handHiddenRightCount = undefined;
    this.handSwipeHint = undefined;
  }

  private unregisterWheelNavigationListener(): void {
    if (!this.wheelListenerRegistered) {
      return;
    }

    this.scene.input.off('wheel', this.handleMouseWheel, this);
    this.wheelListenerRegistered = false;
  }

  private unregisterTouchSwipeNavigationListeners(): void {
    if (!this.touchSwipeListenersRegistered) {
      return;
    }

    this.scene.input.off('pointerdown', this.handlePointerDownForHandSwipe, this);
    this.scene.input.off('pointermove', this.handlePointerMoveForHandSwipe, this);
    this.scene.input.off('pointerup', this.handlePointerUpForHandSwipe, this);
    this.scene.input.off('pointerupoutside', this.handlePointerUpForHandSwipe, this);
    this.touchSwipeListenersRegistered = false;
    this.handSwipeState = undefined;
  }

  destroy() {
    this.unregisterWheelNavigationListener();
    this.unregisterTouchSwipeNavigationListeners();
    this.clearStageObjects();
  }
}
