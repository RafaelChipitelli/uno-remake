import Phaser from 'phaser';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_SERVER_URL } from '../config/network';
import { COLOR_LABELS, type SelectableColor } from '../game/colors';
import { getFirstPlayableCardIndex, isValidCardPlay } from '../game/rules';
import type {
  Card,
  CardActionEvent,
  CreateRoomPayload,
  GameEndedPayload,
  GameStatus,
  Player,
  QuickPlayPayload,
  Room,
  RoomErrorPayload,
} from '../types';
import {
  EMPTY_PLAYER_LIST_MESSAGE,
  FONT_FAMILY,
  INITIAL_STATUS_MESSAGE,
  INITIAL_TURN_MESSAGE,
  INSTRUCTION_TEXT,
  PANEL_ACCENT,
  PANEL_BORDER,
  PANEL_COLOR,
  SCENE_KEYS,
  TEXT_RESOLUTION,
  type GameStartedPayload,
  type SceneLaunchData,
} from './game/constants';
import { getResponsiveGameLayout, type ResponsiveGameLayout } from './game/responsiveLayout';
import {
  describeCardActionEvent,
  registerGameSceneSocketHandlers,
} from './game/socketHandlers';
import { createWildColorModal, type WildColorModalHandle } from './game/wildColorModal';
import CardStage from './ui/CardStage';
import GameHud, { type HudSnapshot } from './ui/GameHud';
import {
  describeFirebasePersistenceError,
  recordCurrentUserMatchResult,
} from '../services/playerAccount';
import { phaserTheme } from '../theme/tokens';
import { askConfirmation } from '../ui/modal';

export default class GameScene extends Phaser.Scene {
  private socket!: Socket;
  private backgroundElements: Phaser.GameObjects.GameObject[] = [];
  private hud?: GameHud;
  private cardStage?: CardStage;
  private responsiveLayout!: ResponsiveGameLayout;

  private player?: Player;
  private roomId?: string;
  private roomHostId?: string;
  private roomGameStatus: GameStatus = 'waiting';

  private logLines: string[] = [];
  private statusMessage = INITIAL_STATUS_MESSAGE;
  private lastPlayerListMessage = EMPTY_PLAYER_LIST_MESSAGE;

  private pendingAction?: 'quick_play' | 'create_private' | 'join';
  private pendingNickname?: string;
  private pendingRoomCode?: string;

  private isLeavingRoom = false;
  private hasReturnedToLobby = false;
  private isColorSelectionOpen = false;
  private wildColorModal?: WildColorModalHandle;
  private hasRecordedCurrentRoundResult = false;
  private isRecordingCurrentRoundResult = false;

  constructor() {
    super(SCENE_KEYS.game);
  }

  init(data?: SceneLaunchData): void {
    this.pendingAction = data?.autoAction;
    this.pendingNickname = data?.nickname;
    this.pendingRoomCode = data?.roomCode?.trim().toUpperCase();

    this.logLines = [];
    this.statusMessage = INITIAL_STATUS_MESSAGE;
    this.lastPlayerListMessage = EMPTY_PLAYER_LIST_MESSAGE;
    this.roomId = undefined;
    this.roomHostId = undefined;
    this.roomGameStatus = 'waiting';
    this.isLeavingRoom = false;
    this.hasReturnedToLobby = false;
    this.hasRecordedCurrentRoundResult = false;
    this.isRecordingCurrentRoundResult = false;
    this.clearColorSelectionModal();

    this.socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket'],
    });

    registerGameSceneSocketHandlers(this.socket, {
      onLobbyWelcome: (player) => this.handleLobbyWelcome(player),
      onGameStarted: (payload) => this.handleGameStarted(payload),
      onCardPlayed: (event) => this.handleCardPlayed(event),
      onCardDrawn: (event) => this.handleCardDrawn(event),
      onGameEnded: (payload) => this.handleGameEnded(payload),
      onRoomCreated: ({ roomId }) => this.handleRoomCreated(roomId),
      onRoomJoined: ({ roomId }) => this.handleRoomJoined(roomId),
      onRoomState: (room) => this.handleRoomState(room),
      onRoomError: (payload) => this.handleRoomError(payload),
      onRoomLeft: () => this.handleRoomLeft(),
      onConnectError: (err) => this.handleConnectError(err),
    });
  }

  create(): void {
    this.responsiveLayout = getResponsiveGameLayout(this.scale.width, this.scale.height);
    this.drawBackdrop();

    this.hud = new GameHud(
      this,
      {
        width: this.responsiveLayout.hudWidth,
        margin: this.responsiveLayout.hudMargin,
        padding: this.responsiveLayout.hudPadding,
        compact: this.responsiveLayout.compact,
        fontScale: this.responsiveLayout.fontScale,
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
        onDrawRequested: () => this.handleDrawCard(),
      },
    );
    this.hud.init(this.composeHudState());

    this.cardStage = new CardStage(this, {
      hudWidth: this.responsiveLayout.hudWidth,
      hudMargin: this.responsiveLayout.hudMargin,
      fontFamily: FONT_FAMILY,
      textResolution: TEXT_RESOLUTION,
      stagePadding: this.responsiveLayout.stagePadding,
      handBottomOffset: this.responsiveLayout.handBottomOffset,
      tableCardScale: this.responsiveLayout.tableCardScale,
      fontScale: this.responsiveLayout.fontScale,
      compact: this.responsiveLayout.compact,
      onCardSelected: (card, index) => this.handleCardClick(card, index),
    });
    this.cardStage.build();

    this.registerKeyboardShortcuts();

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearColorSelectionModal();
      this.unregisterKeyboardShortcuts();
      this.scale.off('resize', this.handleResize, this);

      if (this.socket.connected) {
        this.socket.disconnect();
      }

      this.clearGroup(this.backgroundElements);
      this.hud?.destroy();
      this.cardStage?.destroy();
    });
  }

  private handleLobbyWelcome(player: Player): void {
    this.player = player;
    this.drawPlaceholderCard(player.nickname);
    this.tryAutoAction();
  }

  private handleGameStarted(payload: GameStartedPayload): void {
    this.roomGameStatus = 'in_progress';
    this.hasRecordedCurrentRoundResult = false;
    this.isRecordingCurrentRoundResult = false;
    this.pushLog(payload.message);
    this.pushLog(`🃏 Carta na mesa: ${payload.firstCard.color} ${payload.firstCard.value}`);
    if (payload.currentPlayerTurn) {
      this.pushLog(`⏳ Vez de: ${payload.currentPlayerTurn}`);
    }

    this.clearColorSelectionModal();

    this.cardStage?.setTableCard(payload.firstCard, payload.currentColor);
    this.setStatus('✅ Partida em andamento', payload.currentPlayerTurn ?? INITIAL_TURN_MESSAGE);

    if (this.player?.hand && this.player.hand.length > 0) {
      this.pushLog(`✅ Você recebeu ${this.player.hand.length} cartas!`);
      this.player.hand.forEach((card, index) => {
        this.pushLog(`  ${index + 1}. ${card.color} - ${card.value}`);
      });
    }
  }

  private handleGameEnded(payload: GameEndedPayload): void {
    this.roomGameStatus = 'finished';
    this.clearColorSelectionModal();

    this.pushLog(payload.message);
    this.pushLog('⏸️ Aguardando o dono da sala iniciar a próxima partida...');
    this.setStatus(payload.message, 'Partida encerrada');

    void this.recordAuthenticatedMatchResult(payload);
  }

  private async recordAuthenticatedMatchResult(payload: GameEndedPayload): Promise<void> {
    if (this.hasRecordedCurrentRoundResult || this.isRecordingCurrentRoundResult) {
      return;
    }

    this.isRecordingCurrentRoundResult = true;

    try {
      const didWin = payload.winnerId === this.player?.id;
      const profile = await recordCurrentUserMatchResult(didWin);
      if (!profile) {
        return;
      }

      this.hasRecordedCurrentRoundResult = true;
      this.pushLog(
        `📈 Stats atualizadas: ${profile.stats.gamesPlayed} partidas • ${profile.stats.gamesWon} vitórias`,
      );
    } catch (error) {
      console.error('[firebase] Falha ao salvar estatísticas da partida.', error);
      this.pushLog(`⚠️ ${describeFirebasePersistenceError(error)}`);
    } finally {
      this.isRecordingCurrentRoundResult = false;
    }
  }

  private handleCardPlayed(event: CardActionEvent): void {
    this.clearColorSelectionModal();
    this.pushLog(this.describeEvent(event));

    if (event.card) {
      this.cardStage?.setTableCard(event.card, event.currentColor);
    }
  }

  private handleCardDrawn(event: CardActionEvent): void {
    this.pushLog(this.describeEvent(event));
  }

  private handleRoomCreated(roomId: string): void {
    this.roomId = roomId;
    if (this.player) {
      this.player.roomId = roomId;
    }

    this.pushLog(`Sala ${roomId} criada. Compartilhe o código!`);
    this.setStatus(`🟢 Sala ${roomId} criada. Convide seus amigos.`);
    this.updateRoomDetails();
  }

  private handleRoomJoined(roomId: string): void {
    this.roomId = roomId;
    if (this.player) {
      this.player.roomId = roomId;
    }

    this.pushLog(`Entrou na sala ${roomId}.`);
    this.setStatus(`🟢 Você entrou na sala ${roomId}.`);
    this.updateRoomDetails();
  }

  private handleRoomState(room: Room): void {
    this.roomId = room.id;
    this.roomHostId = room.hostId;
    this.roomGameStatus = room.gameStatus;

    const me = room.players.find((player) => player.id === this.player?.id);
    const opponents = room.players
      .filter((player) => player.id !== this.player?.id)
      .slice(0, 3)
      .map((player) => ({
        id: player.id,
        nickname: player.nickname,
        cardCount: player.handCount ?? player.hand.length,
        isTurn: player.isTurn,
      }));

    this.cardStage?.setOpponents(opponents);

    const currentPlayer = room.players.find((player) => player.isTurn);

    if (me) {
      this.player = me;
      this.cardStage?.setHandCards(me.hand);

      if (!me.isTurn && this.isColorSelectionOpen) {
        this.clearColorSelectionModal();
      }

      if (room.gameStatus === 'finished') {
        this.statusMessage = room.winnerNickname
          ? `🏆 O ${room.winnerNickname} ganhou o jogo!`
          : '🏆 Partida encerrada';
      } else if (room.gameStatus === 'waiting') {
        this.statusMessage = 'Aguardando o dono da sala iniciar a partida';
      } else {
        this.statusMessage = '✅ Partida em andamento';
      }
      this.setStatus(this.statusMessage, currentPlayer?.nickname ?? INITIAL_TURN_MESSAGE);
    }

    this.cardStage?.setTurnIndicator({
      phase: room.gameStatus,
      isMyTurn: Boolean(me?.isTurn),
      currentTurnNickname: currentPlayer?.nickname,
    });

    const topCard = room.discardPile[room.discardPile.length - 1];
    if (topCard) {
      this.cardStage?.setTableCard(topCard, room.currentColor);
    }

    const playerList =
      room.players
        .map((player) => {
          const hostMarker = player.id === room.hostId ? '⭐ ' : '';
          const selfMarker = player.id === this.player?.id ? ' (você)' : '';
          return `${hostMarker}${player.nickname}${selfMarker}`;
        })
        .join('\n') || 'Sala vazia';

    this.updateRoomDetails(playerList);
  }

  private handleRoomError(payload: RoomErrorPayload): void {
    this.pushLog(`Erro: ${payload.message}`);
    this.setStatus(`⚠️ ${payload.message}`);
    this.isLeavingRoom = false;
    this.hud?.update({ leaveEnabled: this.canLeaveRoom() });
  }

  private handleRoomLeft(): void {
    this.roomId = undefined;
    this.roomHostId = undefined;
    this.roomGameStatus = 'waiting';
    this.isLeavingRoom = false;

    this.clearColorSelectionModal();
    this.updateRoomDetails(EMPTY_PLAYER_LIST_MESSAGE);
    this.cardStage?.setTurnIndicator({
      phase: 'waiting',
      isMyTurn: false,
      currentTurnNickname: undefined,
    });
    this.cardStage?.setOpponents([]);
    this.goBackToLobby('Você saiu da sala.');
  }

  private handleConnectError(err: Error): void {
    console.error('Socket error', err);
    this.setStatus('❌ Falha na conexão com o servidor.');
  }

  private drawBackdrop(): void {
    this.clearGroup(this.backgroundElements);

    const { width, height } = this.scale;
    const fullBg = this.add
      .rectangle(width / 2, height / 2, width, height, phaserTheme.colors.bg.canvas, 1)
      .setOrigin(0.5);
    const glowLeft = this.add.ellipse(
      width * 0.14,
      height * 0.2,
      width * 0.56,
      height * 0.6,
      phaserTheme.colors.action.secondary.base,
      0.16,
    );
    const glowRight = this.add.ellipse(
      width * 0.86,
      height * 0.78,
      width * 0.5,
      height * 0.56,
      phaserTheme.colors.action.primary.base,
      0.14,
    );

    this.tweens.add({
      targets: [glowLeft, glowRight],
      alpha: { from: 0.12, to: 0.2 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.backgroundElements.push(fullBg, glowLeft, glowRight);
  }

  private drawPlaceholderCard(nickname: string): void {
    if (!this.hud || !this.cardStage) {
      this.events.once(Phaser.Scenes.Events.CREATE, () => this.drawPlaceholderCard(nickname));
      return;
    }

    this.statusMessage = `Conectado como ${nickname}`;
    this.hud.update({ status: this.statusMessage });
    this.cardStage.pulsePlaceholder();
  }

  private registerKeyboardShortcuts(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    keyboard.on('keydown-P', this.handlePlayCardShortcut, this);
    keyboard.on('keydown-D', this.handleDrawCard, this);
  }

  private unregisterKeyboardShortcuts(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    keyboard.off('keydown-P', this.handlePlayCardShortcut, this);
    keyboard.off('keydown-D', this.handleDrawCard, this);
  }

  private tryAutoAction(): void {
    if (!this.pendingAction || !this.player) {
      return;
    }

    const nickname = this.pendingNickname?.trim() || this.player.nickname;

    if (this.pendingAction === 'quick_play') {
      const payload: QuickPlayPayload = { nickname };
      this.socket.emit('room:quick-play', payload);
    } else if (this.pendingAction === 'create_private') {
      const payload: CreateRoomPayload = { nickname, visibility: 'private' };
      this.socket.emit('room:create', payload);
    } else {
      const roomCode = this.pendingRoomCode;
      if (!roomCode) {
        this.pushLog('Código de sala ausente para entrar automaticamente.');
        this.pendingAction = undefined;
        return;
      }

      this.socket.emit('room:join', { roomId: roomCode, nickname });
    }

    this.pendingAction = undefined;
    this.pendingNickname = undefined;
    this.pendingRoomCode = undefined;
  }

  private handleCardClick(card: Card, index: number): void {
    if (!this.player || !this.roomId) {
      this.pushLog('Entre ou crie uma sala antes de jogar cartas.');
      return;
    }

    if (this.isColorSelectionOpen) {
      this.pushLog('🎨 Escolha uma cor para o curinga antes de continuar.');
      return;
    }

    if (!this.isRoundInProgress()) {
      this.pushLog('⏸️ Rodada encerrada. Aguarde o próximo jogo.');
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

    const topCard = this.cardStage?.getTableCard();
    const currentColor = this.cardStage?.getCurrentColor();

    if (topCard && currentColor && !isValidCardPlay(card, topCard, currentColor)) {
      this.pushLog('❌ Jogada inválida! Essa carta não combina com a mesa.');
      return;
    }

    if (card.color === 'wild') {
      this.showColorSelectionModal(card, index);
      return;
    }

    this.removeCardFromHand(card, index);

    this.socket.emit('card:play', {
      playerId: this.player.id,
      card,
    });

    this.pushLog(`Você jogou ${card.color} ${card.value}`);
    this.setStatus('✅ Jogada enviada. Aguardando atualização da sala...');
    this.cardStage?.setHandCards(this.player.hand);
    this.cardStage?.setTableCard(card);
  }

  private showColorSelectionModal(card: Card, index: number): void {
    if (this.isColorSelectionOpen) {
      return;
    }

    this.pushLog('🎨 Escolha a cor que quer definir:');
    this.clearColorSelectionModal();
    this.isColorSelectionOpen = true;

    this.wildColorModal = createWildColorModal(this, {
      fontFamily: FONT_FAMILY,
      textResolution: TEXT_RESOLUTION,
      onColorSelected: (selectedColor) => this.handleWildCardSelection(card, index, selectedColor),
      onClose: () => {
        this.wildColorModal = undefined;
        this.isColorSelectionOpen = false;
      },
    });
  }

  private handleWildCardSelection(card: Card, index: number, selectedColor: SelectableColor): void {
    if (!this.player?.hand) {
      this.clearColorSelectionModal();
      return;
    }

    this.removeCardFromHand(card, index);

    this.socket.emit('card:play', {
      playerId: this.player.id,
      card,
      selectedColor,
    });

    this.pushLog(`✅ Você definiu a cor ${COLOR_LABELS[selectedColor]}.`);
    this.setStatus(`🎨 Cor escolhida: ${COLOR_LABELS[selectedColor]}.`);
    this.cardStage?.setHandCards(this.player.hand);
    this.cardStage?.setTableCard(card, selectedColor);
  }

  private removeCardFromHand(card: Card, fallbackIndex: number): void {
    if (!this.player?.hand) {
      return;
    }

    const indexInHand = this.player.hand.findIndex((handCard) => handCard.id === card.id);
    const removableIndex = indexInHand !== -1 ? indexInHand : fallbackIndex;

    if (removableIndex >= 0 && removableIndex < this.player.hand.length) {
      this.player.hand.splice(removableIndex, 1);
    }
  }

  private handlePlayCardShortcut(): void {
    if (!this.player || !this.roomId) {
      this.pushLog('Entre ou crie uma sala antes de jogar cartas.');
      return;
    }

    if (this.isColorSelectionOpen) {
      this.pushLog('🎨 Escolha uma cor para o curinga antes de continuar.');
      return;
    }

    if (!this.isRoundInProgress()) {
      this.pushLog('⏸️ Rodada encerrada. Aguarde o próximo jogo.');
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

    const playableIndex = getFirstPlayableCardIndex(
      this.player.hand,
      this.cardStage?.getTableCard(),
      this.cardStage?.getCurrentColor(),
    );

    if (playableIndex === -1) {
      this.pushLog('❌ Nenhuma carta jogável. Comprando uma carta automaticamente...');
      this.handleDrawCard();
      return;
    }

    const playableCard = this.player.hand[playableIndex];
    if (!playableCard) {
      return;
    }

    this.handleCardClick(playableCard, playableIndex);
  }

  private handleDrawCard(): void {
    if (!this.player || !this.roomId) {
      this.pushLog('Entre ou crie uma sala antes de comprar cartas.');
      return;
    }

    if (this.isColorSelectionOpen) {
      this.pushLog('🎨 Escolha uma cor para o curinga antes de comprar.');
      return;
    }

    if (!this.isRoundInProgress()) {
      this.pushLog('⏸️ Rodada encerrada. Aguarde o próximo jogo.');
      return;
    }

    if (!this.player.isTurn) {
      this.pushLog('⏳ Não é a sua vez de comprar carta! Aguarde sua vez.');
      return;
    }

    this.socket.emit('card:draw', {
      playerId: this.player.id,
    });

    this.setStatus('🃏 Comprando carta...');
  }

  private setStatus(status: string, currentTurn?: string): void {
    this.statusMessage = status;
    this.hud?.update({
      status: this.statusMessage,
      ...(currentTurn ? { currentTurn } : {}),
    });
  }

  private describeEvent(event: CardActionEvent): string {
    return describeCardActionEvent(event, this.player?.id, COLOR_LABELS);
  }

  private clearColorSelectionModal(): void {
    if (this.wildColorModal) {
      const modal = this.wildColorModal;
      this.wildColorModal = undefined;
      modal.destroy();
    }

    this.isColorSelectionOpen = false;
  }

  private pushLog(entry: string): void {
    const sanitized = entry.trim();
    if (!sanitized) {
      return;
    }

    this.logLines.unshift(sanitized);
    this.logLines = this.logLines.slice(0, 20);
    this.hud?.update({ logLines: [...this.logLines] });
  }

  private canLeaveRoom(): boolean {
    return Boolean(this.roomId) && !this.isLeavingRoom;
  }

  private canDrawCard(): boolean {
    return Boolean(this.roomId && this.player?.isTurn) && this.isRoundInProgress() && !this.isColorSelectionOpen;
  }

  private isRoundInProgress(): boolean {
    return this.roomGameStatus === 'in_progress';
  }

  private async promptLeaveRoom(): Promise<void> {
    if (!this.roomId) {
      this.pushLog('Nenhuma sala ativa para sair.');
      return;
    }

    const shouldLeave = await askConfirmation({
      title: 'Sair da sala?',
      message: 'Você perderá acesso à partida atual. Deseja continuar?',
      confirmLabel: 'Sair',
      cancelLabel: 'Ficar',
      confirmTone: 'danger',
    });

    if (!shouldLeave) {
      return;
    }

    this.isLeavingRoom = true;
    this.pushLog('Saindo da sala...');
    this.hud?.update({ leaveEnabled: this.canLeaveRoom() });
    this.socket.emit('room:leave');
  }

  private goBackToLobby(message?: string): void {
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

    this.scene.start(SCENE_KEYS.title);
  }

  private handleResize(size: Phaser.Structs.Size): void {
    this.responsiveLayout = getResponsiveGameLayout(size.width, size.height);
    this.cameras.resize(size.width, size.height);
    this.drawBackdrop();
    this.hud?.setLayoutMetrics({
      width: this.responsiveLayout.hudWidth,
      margin: this.responsiveLayout.hudMargin,
      padding: this.responsiveLayout.hudPadding,
      compact: this.responsiveLayout.compact,
      fontScale: this.responsiveLayout.fontScale,
    });
    this.cardStage?.setLayoutMetrics({
      hudWidth: this.responsiveLayout.hudWidth,
      hudMargin: this.responsiveLayout.hudMargin,
      stagePadding: this.responsiveLayout.stagePadding,
      handBottomOffset: this.responsiveLayout.handBottomOffset,
      tableCardScale: this.responsiveLayout.tableCardScale,
      fontScale: this.responsiveLayout.fontScale,
      compact: this.responsiveLayout.compact,
    });
  }

  private clearGroup(group: Phaser.GameObjects.GameObject[]): void {
    group.forEach((object) => object.destroy());
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
      drawEnabled: this.canDrawCard(),
      currentTurn: INITIAL_TURN_MESSAGE,
    };
  }

  private updateRoomDetails(playerListOverride?: string): void {
    if (playerListOverride !== undefined) {
      this.lastPlayerListMessage = playerListOverride;
    }

    this.hud?.update({
      roomLabel: this.getRoomLabel(),
      playerList: this.lastPlayerListMessage,
      leaveEnabled: this.canLeaveRoom(),
      startEnabled: Boolean(this.roomId && this.player?.id === this.roomHostId),
      drawEnabled: this.canDrawCard(),
    });
  }

  private getRoomLabel(): string {
    return this.roomId ? `Sala atual: ${this.roomId}` : 'Nenhuma sala ativa.';
  }
}























