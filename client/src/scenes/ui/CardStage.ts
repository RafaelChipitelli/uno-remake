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
    this.renderHandCards();
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

    if (this.handCards.length === 0) return;

    const metrics = this.getStageMetrics();
    const cardsCount = this.handCards.length;
    const handPadding = clamp(metrics.stageWidth * 0.05, 8, 24);
    const availableWidth = Math.max(120, metrics.stageRight - metrics.stageLeft - handPadding * 2);

    const scale = this.options.tableCardScale ?? 1;
    const minCardWidth = 34;
    let cardWidth = clamp(88 * scale, 58, 92);
    let spacing = clamp(18 * scale, 4, 20);

    const desiredWidth = cardsCount * cardWidth + (cardsCount - 1) * spacing;
    if (desiredWidth > availableWidth) {
      if (cardsCount > 1) {
        spacing = clamp((availableWidth - cardsCount * cardWidth) / (cardsCount - 1), 3, spacing);
      }

      const remainingWidth = availableWidth - (cardsCount - 1) * spacing;
      if (remainingWidth / cardsCount < cardWidth) {
        cardWidth = Math.max(minCardWidth, remainingWidth / cardsCount);
      }
    }

    const cardHeight = cardWidth * 1.45;
    const totalWidth = cardsCount * cardWidth + (cardsCount - 1) * spacing;
    const startX = metrics.stageX - totalWidth / 2;
    const baseY = clamp(
      this.scene.scale.height - (this.options.handBottomOffset ?? 96),
      cardHeight / 2 + 16,
      this.scene.scale.height - cardHeight / 2 - 8,
    );
    const hoverOffset = clamp(cardHeight * 0.12, 6, 16);
    const valueFontSize = `${Math.round(clamp(cardWidth * 0.28, 12, 24))}px`;

    this.handCards.forEach((card, index) => {
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
          this.onCardSelected(card, index);
        }
      });

      this.handElements.push(bg, valueText);
    });
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
    this.handElements.forEach((obj) => obj.destroy());
    this.handElements = [];
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
