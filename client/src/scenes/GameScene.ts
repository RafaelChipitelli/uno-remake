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

  constructor() {
    super('GameScene');
  }

  init(data?: SceneLaunchData) {
    this.pendingAction = data?.autoAction;
    this.pendingNickname = data?.nickname;
    this.pendingRoomCode = data?.roomCode?.trim().toUpperCase();
    this.statusMessage = 'Conectando...';
    this.lastPlayerListMessage = 'Nenhum jogador ainda.';
    this.isLeavingRoom = false;
    this.hasReturnedToLobby = false;

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
      
      // ✅ Atualiza carta que está na mesa para todos verem
      if (this.cardStage) {
        this.cardStage.setTableCard(data.firstCard);
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
      this.pushLog(this.describeEvent(event));
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
        }
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
    });
    this.cardStage.build();
    this.registerKeyboardShortcuts();

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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

  private handlePlayCard() {
    if (!this.player || !this.roomId) {
      this.pushLog('Entre ou crie uma sala antes de jogar cartas.');
      return;
    }

    if (!this.player.hand || this.player.hand.length === 0) {
      this.pushLog('Você não tem cartas para jogar!');
      return;
    }

    // ✅ PEGA A PRIMEIRA CARTA DA MÃO DO JOGADOR (TEMPORÁRIO ATÉ IMPLEMENTAR SELEÇÃO)
    const selectedCard = this.player.hand[0];

    // Remove carta da mão local
    this.player.hand.shift();

    this.socket.emit('card:play', {
      playerId: this.player.id,
      card: selectedCard,
    });

    this.pushLog(`Você jogou ${selectedCard.color} ${selectedCard.value}`);
    
    // Atualiza visualização
    if (this.cardStage) {
      this.cardStage.setHandCards(this.player.hand);
      this.cardStage.setTableCard(selectedCard);
    }
  }

  private handleDrawCard() {
    if (!this.player || !this.roomId) {
      this.pushLog('Entre ou crie uma sala antes de comprar cartas.');
      return;
    }

    this.socket.emit('card:draw', {
      playerId: this.player.id,
    });
  }

  private describeEvent(event: CardActionEvent) {
    const actor = event.playerId === this.player?.id ? 'Você' : event.nickname;
    const actionVerb = event.action === 'play' ? 'jogou' : 'comprou';
    const cardLabel = event.card ? `${event.card.color} ${event.card.value}` : 'uma carta';
    return `${actor} ${actionVerb} ${cardLabel}`;
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
