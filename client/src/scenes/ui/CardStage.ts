import Phaser from 'phaser';
import type { Card } from '../../types';

type CardStageOptions = {
  hudWidth: number;
  hudMargin: number;
  fontFamily: string;
  textResolution: number;
  stagePadding?: number;
  onCardSelected?: (card: Card, index: number) => void;
};

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

  build() {
    const previousTableCard = this.currentTableCard;
    const previousTableColor = this.currentTableColor;

    this.destroy();

    const availableWidth =
      this.scene.scale.width - this.options.hudWidth - this.options.hudMargin * 3;
    const stageWidth = Math.min(420, availableWidth);
    const stageX = this.scene.scale.width - stageWidth / 2 - this.options.hudMargin;
    const stageHeight = this.scene.scale.height - (this.options.stagePadding ?? 120);
    const stageY = this.scene.scale.height / 2;

    const stagePanel = this.scene.add
      .rectangle(stageX, stageY, stageWidth, stageHeight, 0x101a33, 0.55)
      .setOrigin(0.5);
    stagePanel.setStrokeStyle(2, 0x1f2a44, 0.7);

    this.cardShadow = this.scene.add
      .rectangle(stageX + 10, stageY + 12, 150, 210, 0x000000, 0.25)
      .setOrigin(0.5);

    this.cardBase = this.scene.add.rectangle(stageX, stageY, 150, 210, 0xff5c63).setOrigin(0.5);

    this.cardLabel = this.scene.add
      .text(stageX, stageY, 'UNO', {
        fontFamily: this.options.fontFamily,
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setResolution(this.options.textResolution);

    this.playerBadge = this.scene.add
      .text(stageX, stageY + 150, 'Aguardando conexão...', {
        fontFamily: this.options.fontFamily,
        fontSize: '18px',
        color: '#fcd34d',
      })
      .setOrigin(0.5)
      .setResolution(this.options.textResolution);

    this.elements.push(stagePanel, this.cardShadow, this.cardBase, this.cardLabel, this.playerBadge);
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
    // Limpa carta anterior
    if (this.tableCardShape) this.tableCardShape.destroy();
    if (this.tableCardText) this.tableCardText.destroy();
    if (this.tableCardShadow) this.tableCardShadow.destroy();

    const displayColor =
      card.color === 'wild' && currentColor && currentColor !== 'wild' ? currentColor : card.color;

    this.currentTableCard = card;
    this.currentTableColor = currentColor ?? card.color;

    const colorMap: Record<string, number> = {
      red: 0xdc2626,
      green: 0x16a34a,
      blue: 0x2563eb,
      yellow: 0xeab308,
      wild: 0x1f2937
    };

    const stageX = this.scene.scale.width / 2 + this.options.hudWidth / 2;
    const stageY = this.scene.scale.height / 2;

    this.tableCardShadow = this.scene.add
      .rectangle(stageX + 6, stageY + 8, 150, 210, 0x000000, 0.25)
      .setOrigin(0.5);

    this.tableCardShape = this.scene.add
      .rectangle(stageX, stageY, 150, 210, colorMap[displayColor] || 0x333333)
      .setOrigin(0.5)
      .setStrokeStyle(3, 0xffffff);

    this.tableCardText = this.scene.add.text(stageX, stageY, card.value, {
      fontFamily: this.options.fontFamily,
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5).setResolution(this.options.textResolution);
  }

  private renderHandCards() {
    // Limpa cartas antigas
    this.handElements.forEach(obj => obj.destroy());
    this.handElements = [];

    if (this.handCards.length === 0) return;

    const cardWidth = 90;
    const cardHeight = 130;
    const spacing = 20;
    const totalWidth = this.handCards.length * (cardWidth + spacing) - spacing;
    const startX = this.scene.scale.width / 2 - totalWidth / 2;
    const baseY = this.scene.scale.height - 100;

    const colorMap: Record<string, number> = {
      red: 0xdc2626,
      green: 0x16a34a,
      blue: 0x2563eb,
      yellow: 0xeab308,
      wild: 0x1f2937
    };

    this.handCards.forEach((card, index) => {
      const x = startX + index * (cardWidth + spacing) + cardWidth / 2;
      
      const bg = this.scene.add.rectangle(x, baseY, cardWidth, cardHeight, colorMap[card.color] || 0x333333)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0xffffff);

      const valueText = this.scene.add.text(x, baseY, card.value, {
        fontFamily: this.options.fontFamily,
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffffff'
      }).setOrigin(0.5).setResolution(this.options.textResolution);

      // Habilita interação
      bg.setInteractive({ useHandCursor: true });
      
      // Efeito hover
      bg.on('pointerover', () => {
        this.scene.tweens.add({
          targets: [bg, valueText],
          y: baseY - 15,
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
