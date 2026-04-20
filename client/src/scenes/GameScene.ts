import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import type { Card, CardActionEvent, Player, Room, RoomErrorPayload } from '../types';
import CardStage from './ui/CardStage';
import GameHud from './ui/GameHud';
import type { HudSnapshot } from './ui/GameHud';

const HUD_WIDTH = 360;
const HUD_MARGIN = 32;
const HUD_PADDING = 24;
const PANEL_COLOR = 0x111b2f;
const PANEL_BORDER = 0x1f2a44;
const PANEL_ACCENT = '#fcd34d';
const FONT_FAMILY = '"Space Mono", "Fira Code", monospace';
const TEXT_RESOLUTION = Math.min(window.devicePixelRatio || 1, 2);
const INSTRUCTION_TEXT = 'P • jogar carta\nD • comprar carta';
const COLOR_LABELS: Record<Card['color'], string> = {
  red: 'Vermelho',
  green: 'Verde',
  blue: 'Azul',
  yellow: 'Amarelo',
  wild: 'Curinga',
};

type SceneLaunchData = {
  autoAction?: 'create' | 'join';
  nickname?: string;
  roomCode?: string;
};

export default class GameScene extends Phaser.Scene {
  private socket!: Socket;
  private backgroundElements: Phaser.GameObjects.GameObject[] = [];
  private hud?: GameHud;
  private cardStage?: CardStage;
  private player?: Player;
  private roomId?: string;
  private roomHostId?: string;
  private logLines: string[] = [];
  private statusMessage = 'Conectando...';
  private lastPlayerListMessage = 'Nenhum jogador ainda.';
  private pendingAction?: 'create' | 'join';
  private pendingNickname?: string;
  private pendingRoomCode?: string;
  private isLeavingRoom = false;
  private hasReturnedToLobby = false;
  private colorSelectionElements: Phaser.GameObjects.GameObject[] = [];
  private isColorSelectionOpen = false;

  constructor() {
    super('GameScene');
  }

  /**
   * ✅ Valida se uma carta pode ser jogada seguindo as regras oficiais do UNO
   */
  private isValidCardPlay(card: Card, topCard: Card, currentColor: Card['color']): boolean {
    // Curinga e Curinga +4 SEMPRE podem ser jogados
    if (card.color === 'wild') {
      return true;
    }

    // REGRA 1: Cores combinam
    if (card.color === currentColor) {
      return true;
    }

    // REGRA 2: Valores/Numero combinam
    if (card.value === topCard.value) {
      return true;
    }

    // Nenhuma condição atendida: JOGADA INVÁLIDA
    return false;
  }

  init(data?: SceneLaunchData) {
    this.pendingAction = data?.autoAction;
    this.pendingNickname = data?.nickname;
    this.pendingRoomCode = data?.roomCode?.trim().toUpperCase();
    this.statusMessage = 'Conectando...';
    this.lastPlayerListMessage = 'Nenhum jogador ainda.';
    this.isLeavingRoom = false;
    this.hasReturnedToLobby = false;
    this.clearColorSelectionModal();

    this.socket = io('http://localhost:3001', {
      transports: ['websocket'],
    });

    this.socket.on('lobby:welcome', (player: Player) => {
      this.player = player;
      this.drawPlaceholderCard(player.nickname);
      this.tryAutoAction();
    });

    this.socket.on('game:started', (data: any) => {
      this.pushLog(data.message);
      this.pushLog(`🃏 Carta na mesa: ${data.firstCard.color} ${data.firstCard.value}`);
      this.pushLog(`⏳ Vez de: ${data.currentPlayerTurn}`);
      this.clearColorSelectionModal();
      
      // ✅ Atualiza carta que está na mesa para todos verem
      if (this.cardStage) {
        this.cardStage.setTableCard(data.firstCard, data.currentColor);
      }

      // ✅ Atualiza HUD com o jogador da vez
      this.hud?.update({
        currentTurn: data.currentPlayerTurn
      });
      
      // Mostra cartas que o jogador recebeu
      if (this.player?.hand && this.player.hand.length > 0) {
        this.pushLog(`✅ Você recebeu ${this.player.hand.length} cartas!`);
        this.player.hand.forEach((card, index) => {
          this.pushLog(`  ${index+1}. ${card.color} - ${card.value}`);
        });
      }
    });

    this.socket.on('card:played', (event: CardActionEvent) => {
      this.clearColorSelectionModal();
      this.pushLog(this.describeEvent(event));
      
      // ✅ Atualiza carta na mesa para TODOS os jogadores
      if (event.card && this.cardStage) {
        this.cardStage.setTableCard(event.card, event.currentColor);
      }
    });

    this.socket.on('card:drawn', (event: CardActionEvent) => {
      this.pushLog(this.describeEvent(event));
    });

    this.socket.on('room:created', ({ roomId }: { roomId: string }) => {
      this.roomId = roomId;
      if (this.player) this.player.roomId = roomId;
      this.pushLog(`Sala ${roomId} criada. Compartilhe o código!`);
      this.updateRoomDetails();
    });

    this.socket.on('room:joined', ({ roomId }: { roomId: string }) => {
      this.roomId = roomId;
      if (this.player) this.player.roomId = roomId;
      this.pushLog(`Entrou na sala ${roomId}.`);
      this.updateRoomDetails();
    });

    this.socket.on('room:state', (room: Room) => {
      this.roomId = room.id;
      this.roomHostId = room.hostId;
      if (this.player) {
        const me = room.players.find((p) => p.id === this.player?.id);
        if (me) {
          this.player = me;
          // Atualiza visualização das cartas na mão
          if (this.cardStage) {
            this.cardStage.setHandCards(me.hand);
          }

          if (!me.isTurn && this.isColorSelectionOpen) {
            this.clearColorSelectionModal();
          }

          // ✅ Mostra quando é a vez do jogador
          if (me.isTurn) {
            this.hud?.update({ status: '✅ É A SUA VEZ!' });
          } else {
            const currentPlayer = room.players.find(p => p.isTurn);
            this.hud?.update({ status: `⏳ Vez de: ${currentPlayer?.nickname}` });
          }
        }
      }

      const topCard = room.discardPile[room.discardPile.length - 1];
      if (topCard) {
        this.cardStage?.setTableCard(topCard, room.currentColor);
      }

      this.cardStage?.setPlayerNickname(this.player?.nickname);
      const list =
        room.players
          .map((p) => {
            const star = p.id === room.hostId ? '⭐ ' : '';
            const self = p.id === this.player?.id ? ' (você)' : '';
            return `${star}${p.nickname}${self}`;
          })
          .join('\n') || 'Sala vazia';
      this.updateRoomDetails(list);
    });

    this.socket.on('room:error', (payload: RoomErrorPayload) => {
      this.pushLog(`Erro: ${payload.message}`);
      this.isLeavingRoom = false;
      this.hud?.update({ leaveEnabled: this.canLeaveRoom() });
    });

    this.socket.on('room:left', () => {
      this.roomId = undefined;
      this.isLeavingRoom = false;
      this.clearColorSelectionModal();
      this.updateRoomDetails('Nenhum jogador ainda.');
      this.cardStage?.setPlayerNickname(undefined);
      this.goBackToLobby('Você saiu da sala.');
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket error', err);
      this.statusMessage = 'Falha na conexão';
      this.hud?.update({ status: this.statusMessage });
    });
  }

  create() {
    this.drawBackdrop();
    this.hud = new GameHud(
      this,
      {
        width: HUD_WIDTH,
        margin: HUD_MARGIN,
        padding: HUD_PADDING,
        panelColor: PANEL_COLOR,
        panelBorder: PANEL_BORDER,
        accentColor: PANEL_ACCENT,
        fontFamily: FONT_FAMILY,
        textResolution: TEXT_RESOLUTION,
        instructions: INSTRUCTION_TEXT,
      },
      {
        onLeaveRequested: () => this.promptLeaveRoom(),
        onStartRequested: () => this.socket?.emit('game:start'),
      }
    );
    this.hud.init(this.composeHudState());

    this.cardStage = new CardStage(this, {
      hudWidth: HUD_WIDTH,
      hudMargin: HUD_MARGIN,
      fontFamily: FONT_FAMILY,
      textResolution: TEXT_RESOLUTION,
      onCardSelected: (card, index) => this.handleCardClick(card, index),
    });
    this.cardStage.build();
    this.registerKeyboardShortcuts();

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearColorSelectionModal();
      this.scale.off('resize', this.handleResize, this);
      if (this.socket.connected) this.socket.disconnect();
      this.clearGroup(this.backgroundElements);
      this.hud?.destroy();
      this.cardStage?.destroy();
    });
  }

  private drawBackdrop() {
    this.clearGroup(this.backgroundElements);
    const { width, height } = this.scale;

    const layerOne = this.add
      .rectangle(width * 0.65, height / 2, width * 0.75, height, 0x0d1628, 0.45)
      .setOrigin(0.5);
    const layerTwo = this.add
      .rectangle(width * 0.78, height / 2, width * 0.4, height, 0x14213d, 0.45)
      .setOrigin(0.5);

    this.backgroundElements.push(layerOne, layerTwo);
  }

  private drawPlaceholderCard(label: string) {
    if (!this.hud || !this.cardStage) {
      this.events.once(Phaser.Scenes.Events.CREATE, () => this.drawPlaceholderCard(label));
      return;
    }

    this.statusMessage = `Conectado como ${label}`;
    this.hud?.update({ status: this.statusMessage });
    this.cardStage?.setPlayerNickname(label);
    this.cardStage?.pulsePlaceholder();
  }

  private registerKeyboardShortcuts() {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    keyboard.on('keydown-P', this.handlePlayCard, this);
    keyboard.on('keydown-D', this.handleDrawCard, this);
  }

  private tryAutoAction() {
    if (!this.pendingAction || !this.player) return;

    const nickname = this.pendingNickname?.trim() || this.player.nickname;

    if (this.pendingAction === 'create') {
      this.socket.emit('room:create', { nickname });
    } else if (this.pendingAction === 'join') {
      const code = this.pendingRoomCode;
      if (!code) {
        this.pushLog('Código de sala ausente para entrar automaticamente.');
        this.pendingAction = undefined;
        return;
      }
      this.socket.emit('room:join', { roomId: code, nickname });
    }

    this.pendingAction = undefined;
    this.pendingNickname = undefined;
    this.pendingRoomCode = undefined;
  }

  private handleCardClick(card: Card, index: number) {
    if (!this.player || !this.roomId) {
      this.pushLog('Entre ou crie uma sala antes de jogar cartas.');
      return;
    }

    if (this.isColorSelectionOpen) {
      this.pushLog('🎨 Escolha uma cor para o curinga antes de continuar.');
      return;
    }

    if (!this.player.hand || this.player.hand.length === 0) {
      this.pushLog('Você não tem cartas para jogar!');
      return;
    }

    if (!this.player.isTurn) {
      this.pushLog('⏳ Não é a sua vez de jogar! Aguarde sua vez.');
      return;
    }

    // ✅ VALIDA LOCALMENTE ANTES DE ENVIAR
    const topCard = this.cardStage?.getTableCard();
    const currentColor = this.cardStage?.getCurrentColor();
    
    if (topCard && currentColor && !this.isValidCardPlay(card, topCard, currentColor)) {
      this.pushLog('❌ Jogada inválida! Essa carta não combina com a mesa.');
      return;
    }

    // ✅ SE FOR CURINGA: ABRE MODAL PARA ESCOLHER COR
    if (card.color === 'wild') {
      this.showColorSelectionModal(card, index);
      return;
    }

    // ✅ SÓ REMOVE CARTA APÓS VALIDAÇÃO PASSAR
    this.player.hand.splice(index, 1);

    this.socket.emit('card:play', {
      playerId: this.player.id,
      card: card,
    });

    this.pushLog(`Você jogou ${card.color} ${card.value}`);
    
    // Atualiza visualização
    if (this.cardStage) {
      this.cardStage.setHandCards(this.player.hand);
      this.cardStage.setTableCard(card);
    }
  }

  /**
   * ✅ Modal para escolher cor quando joga Curinga
   */
  private showColorSelectionModal(card: Card, index: number) {
    if (this.isColorSelectionOpen) {
      return;
    }

    this.pushLog('🎨 Escolha a cor que quer definir:');
    this.clearColorSelectionModal();
    this.isColorSelectionOpen = true;

    const width = this.scale.width;
    const height = this.scale.height;
    const panelWidth = Math.min(620, width - 80);
    const panelHeight = 220;
    const panelX = width / 2;
    const panelY = height / 2;

    const overlay = this.add
      .rectangle(panelX, panelY, width, height, 0x000000, 0.55)
      .setOrigin(0.5)
      .setDepth(2000);

    const panel = this.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x0f172a, 0.96)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setDepth(2001);

    const title = this.add
      .text(panelX, panelY - 70, 'Escolha a cor do curinga', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        color: '#f8fafc',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RESOLUTION)
      .setDepth(2002);

    this.colorSelectionElements.push(overlay, panel, title);

    const buttonSize = 96;
    const buttonSpacing = 120;
    const colorButtons: Array<Exclude<Card['color'], 'wild'>> = ['red', 'green', 'blue', 'yellow'];
    const colorMap: Record<Exclude<Card['color'], 'wild'>, number> = {
      red: 0xdc2626,
      green: 0x16a34a,
      blue: 0x2563eb,
      yellow: 0xeab308,
    };

    colorButtons.forEach((color, buttonIndex) => {
      const x = panelX - ((colorButtons.length - 1) * buttonSpacing) / 2 + buttonIndex * buttonSpacing;
      const y = panelY + 18;

      const button = this.add
        .rectangle(x, y, buttonSize, buttonSize, colorMap[color])
        .setOrigin(0.5)
        .setStrokeStyle(3, 0xffffff)
        .setDepth(2002)
        .setInteractive({ useHandCursor: true });

      const label = this.add
        .text(x, y, COLOR_LABELS[color], {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setResolution(TEXT_RESOLUTION)
        .setDepth(2003);

      button.on('pointerover', () => {
        button.setScale(1.06);
      });

      button.on('pointerout', () => {
        button.setScale(1);
      });

      button.on('pointerdown', () => {
        if (!this.player?.hand) {
          this.clearColorSelectionModal();
          return;
        }

        const currentCardIndex = this.player.hand.findIndex((handCard) => handCard.id === card.id);
        const removableIndex = currentCardIndex !== -1 ? currentCardIndex : index;
        if (removableIndex >= 0) {
          this.player.hand.splice(removableIndex, 1);
        }

        this.socket.emit('card:play', {
          playerId: this.player.id,
          card,
          selectedColor: color,
        });

        this.pushLog(`✅ Você definiu a cor ${COLOR_LABELS[color]}.`);
        this.cardStage?.setHandCards(this.player.hand);
        this.cardStage?.setTableCard(card, color);
        this.clearColorSelectionModal();
      });

      this.colorSelectionElements.push(button, label);
    });
  }

  private handlePlayCard() {
    if (!this.player || !this.roomId) {
      this.pushLog('Entre ou crie uma sala antes de jogar cartas.');
      return;
    }

    if (!this.player.hand || this.player.hand.length === 0) {
      this.pushLog('Você não tem cartas para jogar!');
      return;
    }

    if (!this.player.isTurn) {
      this.pushLog('⏳ Não é a sua vez de jogar! Aguarde sua vez.');
      return;
    }

    // ✅ Atalho P: joga a primeira carta válida para a mesa
    const topCard = this.cardStage?.getTableCard();
    const currentColor = this.cardStage?.getCurrentColor();

    let playableIndex = -1;
    if (!topCard || !currentColor) {
      playableIndex = 0;
    } else {
      playableIndex = this.player.hand.findIndex((card) =>
        this.isValidCardPlay(card, topCard, currentColor),
      );
    }

    if (playableIndex === -1) {
      this.pushLog('❌ Nenhuma carta da sua mão corresponde à mesa.');
      return;
    }

    const playableCard = this.player.hand[playableIndex];
    this.handleCardClick(playableCard, playableIndex);
  }

  private handleDrawCard() {
    if (!this.player || !this.roomId) {
      this.pushLog('Entre ou crie uma sala antes de comprar cartas.');
      return;
    }

    if (this.isColorSelectionOpen) {
      this.pushLog('🎨 Escolha uma cor para o curinga antes de comprar.');
      return;
    }

    if (!this.player.isTurn) {
      this.pushLog('⏳ Não é a sua vez de comprar carta! Aguarde sua vez.');
      return;
    }

    this.socket.emit('card:draw', {
      playerId: this.player.id,
    });
  }

  private describeEvent(event: CardActionEvent) {
    const actor = event.playerId === this.player?.id ? 'Você' : event.nickname;
    const actionVerb = event.action === 'play' ? 'jogou' : 'comprou';
    const cardLabel = event.card ? `${COLOR_LABELS[event.card.color]} ${event.card.value}` : 'uma carta';

    if (event.action === 'play' && event.card?.color === 'wild' && event.currentColor && event.currentColor !== 'wild') {
      return `${actor} ${actionVerb} ${cardLabel} e escolheu ${COLOR_LABELS[event.currentColor]}`;
    }

    return `${actor} ${actionVerb} ${cardLabel}`;
  }

  private clearColorSelectionModal() {
    if (this.colorSelectionElements.length > 0) {
      this.colorSelectionElements.forEach((element) => element.destroy());
      this.colorSelectionElements = [];
    }

    this.isColorSelectionOpen = false;
  }

  private pushLog(entry: string) {
    const sanitized = entry.trim();
    if (!sanitized) return;
    this.logLines.unshift(sanitized);
    this.logLines = this.logLines.slice(0, 5);
    this.hud?.update({ logLines: [...this.logLines] });
  }

  private canLeaveRoom() {
    return Boolean(this.roomId) && !this.isLeavingRoom;
  }

  private promptLeaveRoom() {
    if (!this.roomId) {
      this.pushLog('Nenhuma sala ativa para sair.');
      return;
    }
    if (!window.confirm('Quer realmente sair da sala?')) {
      return;
    }
    this.isLeavingRoom = true;
    this.pushLog('Saindo da sala...');
    this.hud?.update({ leaveEnabled: this.canLeaveRoom() });
    this.socket.emit('room:leave');
  }

  private goBackToLobby(message?: string) {
    if (message) {
      this.pushLog(message);
    }

    if (this.hasReturnedToLobby) {
      return;
    }

    this.hasReturnedToLobby = true;

    if (this.socket.connected) {
      this.socket.disconnect();
    }

    this.scene.start('TitleScene');
  }

  private handleResize(size: Phaser.Structs.Size) {
    this.cameras.resize(size.width, size.height);
    this.drawBackdrop();
    this.hud?.resize();
    this.cardStage?.resize();
  }

  private clearGroup(group: Phaser.GameObjects.GameObject[]) {
    group.forEach((obj) => obj.destroy());
    group.length = 0;
  }

  private composeHudState(): HudSnapshot {
    return {
      status: this.statusMessage,
      roomLabel: this.getRoomLabel(),
      playerList: this.lastPlayerListMessage,
      logLines: [...this.logLines],
      leaveEnabled: this.canLeaveRoom(),
      startEnabled: Boolean(this.roomId && this.player?.id === this.roomHostId),
      currentTurn: 'Aguardando jogo começar'
    };
  }

  private updateRoomDetails(playerListOverride?: string) {
    if (playerListOverride !== undefined) {
      this.lastPlayerListMessage = playerListOverride;
    }
    this.hud?.update({
      roomLabel: this.getRoomLabel(),
      playerList: this.lastPlayerListMessage,
      leaveEnabled: this.canLeaveRoom(),
      startEnabled: Boolean(this.roomId && this.player?.id === this.roomHostId),
    });
  }

  private getRoomLabel() {
    return this.roomId ? `Sala atual: ${this.roomId}` : 'Nenhuma sala ativa.';
  }
}
