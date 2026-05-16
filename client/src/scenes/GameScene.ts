import Phaser from 'phaser';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_SERVER_URL } from '../config/network';
import { getCardDisplayParts } from '../game/cardDisplay';
import { getColorLabel, getColorLabels, type SelectableColor } from '../game/colors';
import {
  canStackOverPendingDraw,
  getFirstPlayableCardIndex,
  isCustomDrawReactionCard,
  isStackDrawCard,
  isValidCardPlay,
} from '../game/rules';
import type {
  Card,
  CardActionEvent,
  CreateRoomPayload,
  DrawDecisionPayload,
  GameEndedPayload,
  GameStatus,
  Player,
  QuickPlayPayload,
  Room,
  RoomErrorPayload,
} from '../types';
import {
  FONT_FAMILY,
  getEmptyPlayerListMessage,
  getInitialStatusMessage,
  getInitialTurnMessage,
  getInstructionText,
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
import { askChoice, askConfirmation } from '../ui/modal';
import { t } from '../i18n';

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
  private statusMessage = getInitialStatusMessage();
  private lastPlayerListMessage = getEmptyPlayerListMessage();

  private pendingAction?: 'quick_play' | 'create_private' | 'join';
  private pendingNickname?: string;
  private pendingRoomCode?: string;

  private isLeavingRoom = false;
  private hasReturnedToLobby = false;
  private isColorSelectionOpen = false;
  private pendingDrawDecisionCardId?: string;
  private pendingStackDrawForMe?: {
    amount: number;
    topCardValue: '+2' | '+4';
  };
  private isDrawDecisionPromptOpen = false;
  private isDrawDecisionSubmitting = false;
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
    this.statusMessage = getInitialStatusMessage();
    this.lastPlayerListMessage = getEmptyPlayerListMessage();
    this.roomId = undefined;
    this.roomHostId = undefined;
    this.roomGameStatus = 'waiting';
    this.isLeavingRoom = false;
    this.hasReturnedToLobby = false;
    this.hasRecordedCurrentRoundResult = false;
    this.isRecordingCurrentRoundResult = false;
    this.clearPendingDrawDecisionState();
    this.clearPendingStackDrawState();
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
      onUnoCalled: ({ playerId, nickname }) =>
        this.pushLog(
          playerId === this.player?.id
            ? t('game.uno.youDeclared')
            : t('game.uno.declared', { nickname }),
        ),
      onUnoPenalty: ({ nickname, cards }) => this.pushLog(t('game.uno.penalty', { nickname, cards })),
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
        hudMode: this.responsiveLayout.hudMode,
        compact: this.responsiveLayout.compact,
        fontScale: this.responsiveLayout.fontScale,
        panelColor: PANEL_COLOR,
        panelBorder: PANEL_BORDER,
        accentColor: PANEL_ACCENT,
        fontFamily: FONT_FAMILY,
        textResolution: TEXT_RESOLUTION,
        instructions: getInstructionText(),
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
      hudMode: this.responsiveLayout.hudMode,
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
    this.clearPendingDrawDecisionState();
    this.clearPendingStackDrawState();
    this.pushLog(payload.message);
    this.pushLog(t('game.log.tableCard', { color: payload.firstCard.color, value: payload.firstCard.value }));
    if (payload.currentPlayerTurn) {
      this.pushLog(t('game.log.turnOf', { nickname: payload.currentPlayerTurn }));
    }

    this.clearColorSelectionModal();

    this.cardStage?.setTableCard(payload.firstCard, payload.currentColor);
    this.setStatus(t('game.status.running'), payload.currentPlayerTurn ?? getInitialTurnMessage());
    this.syncHudActions();

    if (this.player?.hand && this.player.hand.length > 0) {
      this.pushLog(t('game.log.receivedCards', { count: this.player.hand.length }));
      this.player.hand.forEach((card, index) => {
        this.pushLog(t('game.log.receivedCardEntry', { index: index + 1, color: card.color, value: card.value }));
      });
    }
  }

  private handleGameEnded(payload: GameEndedPayload): void {
    this.roomGameStatus = 'finished';
    this.clearPendingDrawDecisionState();
    this.clearPendingStackDrawState();
    this.clearColorSelectionModal();

    this.pushLog(payload.message);
    this.pushLog(t('game.log.waitingNextRound'));
    this.setStatus(payload.message, t('game.status.ended'));
    this.syncHudActions();

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
        t('game.log.statsUpdated', {
          gamesPlayed: profile.stats.gamesPlayed,
          gamesWon: profile.stats.gamesWon,
        }),
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

    if (event.playerId === this.player?.id) {
      this.clearPendingDrawDecisionState();
    }

    this.pushLog(this.describeEvent(event));

    if (event.card) {
      this.cardStage?.setTableCard(event.card, event.currentColor);
    }
  }

  private handleCardDrawn(event: CardActionEvent): void {
    this.pushLog(this.describeEvent(event));

    if (!this.player || event.playerId !== this.player.id) {
      return;
    }

    if (event.drawReason === 'stack_penalty') {
      this.clearPendingStackDrawState();
    }

    if (event.drawDecisionPending && event.drawnCardPlayable && event.card) {
      this.pendingDrawDecisionCardId = event.card.id;
      this.pushLog(t('game.log.drawnPlayableDecision'));
      void this.promptDrawDecision(event.card);
      return;
    }

    if (event.drawDecisionPending === false) {
      this.clearPendingDrawDecisionState();
    }
  }

  private handleRoomCreated(roomId: string): void {
    this.roomId = roomId;
    if (this.player) {
      this.player.roomId = roomId;
    }

    this.pushLog(t('game.log.roomCreated', { roomId }));
    this.setStatus(t('game.status.roomCreated', { roomId }));
    this.updateRoomDetails();
  }

  private handleRoomJoined(roomId: string): void {
    this.roomId = roomId;
    if (this.player) {
      this.player.roomId = roomId;
    }

    this.pushLog(t('game.log.roomJoined', { roomId }));
    this.setStatus(t('game.status.roomJoined', { roomId }));
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

      const pendingForMe = room.pendingDrawDecision?.playerId === me.id ? room.pendingDrawDecision.cardId : undefined;
      this.pendingDrawDecisionCardId = pendingForMe;
      if (!pendingForMe) {
        this.isDrawDecisionSubmitting = false;
      }

      this.pendingStackDrawForMe =
        room.pendingStackDraw?.targetPlayerId === me.id
          ? {
              amount: room.pendingStackDraw.amount,
              topCardValue: room.pendingStackDraw.topCardValue,
            }
          : undefined;

      if (this.pendingStackDrawForMe && me.isTurn && room.gameStatus === 'in_progress') {
        this.statusMessage = t('game.status.penaltyMustPlayOrDraw', { amount: this.pendingStackDrawForMe.amount });
      }

      if (!me.isTurn && this.isColorSelectionOpen) {
        this.clearColorSelectionModal();
      }

      if (room.gameStatus === 'finished') {
        this.statusMessage = room.winnerNickname
          ? `🏆 O ${room.winnerNickname} ganhou o jogo!`
          : '🏆 Partida encerrada';
      } else if (room.gameStatus === 'waiting') {
        this.statusMessage = t('game.status.waitingHost');
      } else if (this.pendingStackDrawForMe && me.isTurn) {
        this.statusMessage = t('game.status.penaltyMustPlayOrDraw', { amount: this.pendingStackDrawForMe.amount });
      } else {
        this.statusMessage = t('game.status.running');
      }
      this.setStatus(this.statusMessage, currentPlayer?.nickname ?? getInitialTurnMessage());
      this.syncHudActions();
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
          const selfMarker = player.id === this.player?.id ? t('game.players.selfSuffix') : '';
          return `${hostMarker}${player.nickname}${selfMarker}`;
        })
        .join('\n') || t('game.players.roomEmpty');

    this.updateRoomDetails(playerList);
  }

  private handleRoomError(payload: RoomErrorPayload): void {
    this.pushLog(t('game.log.roomError', { message: payload.message }));
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
    this.updateRoomDetails(getEmptyPlayerListMessage());
    this.syncHudActions();
    this.cardStage?.setTurnIndicator({
      phase: 'waiting',
      isMyTurn: false,
      currentTurnNickname: undefined,
    });
    this.cardStage?.setOpponents([]);
    this.goBackToLobby(t('game.log.leftRoom'));
  }

  private handleConnectError(err: Error): void {
    console.error('Socket error', err);
    this.setStatus(t('game.status.connectError'));
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

    this.statusMessage = t('game.status.connectedAs', { nickname });
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
    keyboard.on('keydown-U', this.handleDeclareUno, this);
  }

  private handleDeclareUno(): void {
    this.socket.emit('uno:declare');
  }

  private unregisterKeyboardShortcuts(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    keyboard.off('keydown-P', this.handlePlayCardShortcut, this);
    keyboard.off('keydown-D', this.handleDrawCard, this);
    keyboard.off('keydown-U', this.handleDeclareUno, this);
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
        this.pushLog(t('game.log.roomCodeMissing'));
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
      this.pushLog(t('game.log.mustJoinToPlay'));
      return;
    }

    if (this.isColorSelectionOpen) {
      this.pushLog(t('game.log.chooseWildBeforeContinue'));
      return;
    }

    if (this.hasPendingDrawDecision()) {
      this.pushLog(t('game.log.decideDrawnCardFirst'));
      return;
    }

    const pendingStackForMe = this.pendingStackDrawForMe;
    if (pendingStackForMe) {
      if (!isStackDrawCard(card) && !isCustomDrawReactionCard(card)) {
        this.pushLog(t('game.log.penaltyMustPlayOrDraw', { amount: pendingStackForMe.amount }));
        return;
      }

      if (isStackDrawCard(card) && !canStackOverPendingDraw(card, pendingStackForMe.topCardValue)) {
        this.pushLog(t('game.log.invalidStackPlusTwoOnPlusFour'));
        return;
      }
    }

    if (!this.isRoundInProgress()) {
      this.pushLog(t('game.log.roundFinishedWait'));
      return;
    }

    if (!this.player.hand || this.player.hand.length === 0) {
      this.pushLog(t('game.log.noCardsToPlay'));
      return;
    }

    if (!this.player.isTurn) {
      this.pushLog(t('game.log.notYourTurnToPlay'));
      return;
    }

    const topCard = this.cardStage?.getTableCard();
    const currentColor = this.cardStage?.getCurrentColor();

    if (!pendingStackForMe && topCard && currentColor && !isValidCardPlay(card, topCard, currentColor)) {
      this.pushLog(t('game.log.invalidPlay'));
      return;
    }

    if (card.color === 'wild') {
      this.showColorSelectionModal(card, index, 'play');
      return;
    }

    this.removeCardFromHand(card, index);

    this.socket.emit('card:play', {
      playerId: this.player.id,
      card,
    });

    this.pushLog(t('game.log.playedCard', { color: card.color, value: card.value }));
    this.setStatus(t('game.status.playSent'));
    this.cardStage?.setHandCards(this.player.hand);
    this.cardStage?.setTableCard(card);
  }

  private showColorSelectionModal(card: Card, index: number, mode: 'play' | 'draw_decision' = 'play'): void {
    if (this.isColorSelectionOpen) {
      return;
    }

    this.pushLog(t('game.log.chooseWildColor'));
    this.clearColorSelectionModal();
    this.isColorSelectionOpen = true;

    this.wildColorModal = createWildColorModal(this, {
      fontFamily: FONT_FAMILY,
      textResolution: TEXT_RESOLUTION,
      onColorSelected: (selectedColor) => this.handleWildCardSelection(card, index, selectedColor, mode),
      onClose: () => {
        this.wildColorModal = undefined;
        this.isColorSelectionOpen = false;
      },
    });
  }

  private handleWildCardSelection(
    card: Card,
    index: number,
    selectedColor: SelectableColor,
    mode: 'play' | 'draw_decision' = 'play',
  ): void {
    if (mode === 'draw_decision') {
      if (!this.player || !this.pendingDrawDecisionCardId || this.pendingDrawDecisionCardId !== card.id) {
        this.clearColorSelectionModal();
        return;
      }

      const payload: DrawDecisionPayload = {
        playerId: this.player.id,
        choice: 'play',
        selectedColor,
      };

      this.isDrawDecisionSubmitting = true;
      this.socket.emit('card:draw-decision', payload);
      this.pushLog(t('game.log.drawDecisionPlayedWithColor', { color: getColorLabel(selectedColor) }));
      this.setStatus(t('game.status.colorChosen', { color: getColorLabel(selectedColor) }));
      return;
    }

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

    this.pushLog(t('game.log.colorChosen', { color: getColorLabel(selectedColor) }));
    this.setStatus(t('game.status.colorChosen', { color: getColorLabel(selectedColor) }));
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
      this.pushLog(t('game.log.mustJoinToPlay'));
      return;
    }

    if (this.isColorSelectionOpen) {
      this.pushLog(t('game.log.chooseWildBeforeContinue'));
      return;
    }

    if (this.hasPendingDrawDecision()) {
      this.pushLog(t('game.log.decideDrawnCardFirst'));
      return;
    }

    if (!this.isRoundInProgress()) {
      this.pushLog(t('game.log.roundFinishedWait'));
      return;
    }

    if (!this.player.hand || this.player.hand.length === 0) {
      this.pushLog(t('game.log.noCardsToPlay'));
      return;
    }

    if (!this.player.isTurn) {
      this.pushLog(t('game.log.notYourTurnToPlay'));
      return;
    }

    const playableIndex = getFirstPlayableCardIndex(
      this.player.hand,
      this.cardStage?.getTableCard(),
      this.cardStage?.getCurrentColor(),
      this.pendingStackDrawForMe?.topCardValue,
    );

    if (playableIndex === -1) {
      if (this.pendingStackDrawForMe) {
        this.pushLog(t('game.log.noPlayablePenaltyDrawing', { amount: this.pendingStackDrawForMe.amount }));
      } else {
        this.pushLog(t('game.log.noPlayableAutoDraw'));
      }
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
      this.pushLog(t('game.log.mustJoinToDraw'));
      return;
    }

    if (this.isColorSelectionOpen) {
      this.pushLog(t('game.log.chooseWildBeforeDraw'));
      return;
    }

    if (this.hasPendingDrawDecision()) {
      this.pushLog(t('game.log.decideDrawnCardBeforeDraw'));
      return;
    }

    const pendingStackForMe = this.pendingStackDrawForMe;
    if (pendingStackForMe) {
      this.socket.emit('card:draw-penalty', {
        playerId: this.player.id,
      });

      this.setStatus(t('game.status.drawPenalty', { amount: pendingStackForMe.amount }));
      return;
    }

    if (!this.isRoundInProgress()) {
      this.pushLog(t('game.log.roundFinishedWait'));
      return;
    }

    if (!this.player.isTurn) {
      this.pushLog(t('game.log.notYourTurnToDraw'));
      return;
    }

    this.socket.emit('card:draw', {
      playerId: this.player.id,
    });

    this.setStatus(t('game.status.drawCard'));
  }

  private setStatus(status: string, currentTurn?: string): void {
    this.statusMessage = status;
    this.hud?.update({
      status: this.statusMessage,
      ...(currentTurn ? { currentTurn } : {}),
    });
  }

  private syncHudActions(): void {
    this.hud?.update({
      leaveEnabled: this.canLeaveRoom(),
      startEnabled: this.canStartGame(),
      drawEnabled: this.canDrawCard(),
      roundInProgress: this.isRoundInProgress(),
    });
  }

  private describeEvent(event: CardActionEvent): string {
    return describeCardActionEvent(event, this.player?.id, getColorLabels());
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
    return (
      Boolean(this.roomId && this.player?.isTurn) &&
      this.isRoundInProgress() &&
      !this.isColorSelectionOpen &&
      !this.hasPendingDrawDecision()
    );
  }

  private hasPendingDrawDecision(): boolean {
    return Boolean(this.pendingDrawDecisionCardId || this.isDrawDecisionPromptOpen || this.isDrawDecisionSubmitting);
  }

  private clearPendingDrawDecisionState(): void {
    this.pendingDrawDecisionCardId = undefined;
    this.isDrawDecisionPromptOpen = false;
    this.isDrawDecisionSubmitting = false;
  }

  private clearPendingStackDrawState(): void {
    this.pendingStackDrawForMe = undefined;
  }

  private async promptDrawDecision(drawnCard: Card): Promise<void> {
    if (!this.player || !this.roomId || this.isDrawDecisionPromptOpen || this.isDrawDecisionSubmitting) {
      return;
    }

    this.isDrawDecisionPromptOpen = true;

    const choice = await askChoice<'play' | 'keep'>({
      title: t('game.modal.drawDecision.title'),
      message: t('game.modal.drawDecision.message'),
      renderContent: (container) => this.renderDrawDecisionCardPreview(container, drawnCard),
      choices: [
        { label: t('game.modal.drawDecision.playNow'), value: 'play', tone: 'primary' },
        { label: t('game.modal.drawDecision.keepPass'), value: 'keep', tone: 'ghost' },
      ],
    });

    this.isDrawDecisionPromptOpen = false;

    if (!this.player || this.pendingDrawDecisionCardId !== drawnCard.id) {
      return;
    }

    if (choice === 'keep') {
      const payload: DrawDecisionPayload = {
        playerId: this.player.id,
        choice: 'keep',
      };

      this.isDrawDecisionSubmitting = true;
      this.socket.emit('card:draw-decision', payload);
      this.pushLog(t('game.log.keepDrawnCardPass'));
      this.setStatus(t('game.status.choiceSentPassingTurn'));
      return;
    }

    if (drawnCard.color === 'wild') {
      const indexInHand = this.player.hand.findIndex((card) => card.id === drawnCard.id);
      this.showColorSelectionModal(drawnCard, indexInHand, 'draw_decision');
      return;
    }

    const playPayload: DrawDecisionPayload = {
      playerId: this.player.id,
      choice: 'play',
    };

    this.isDrawDecisionSubmitting = true;
    this.socket.emit('card:draw-decision', playPayload);
    this.pushLog(t('game.log.playDrawnCard', { color: drawnCard.color, value: drawnCard.value }));
    this.setStatus(t('game.status.playingDrawnCard'));
  }

  private renderDrawDecisionCardPreview(container: HTMLElement, drawnCard: Card): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'ui-draw-decision-preview';

    const card = document.createElement('div');
    card.className = `ui-draw-decision-card ui-draw-decision-card--${drawnCard.color}`;

    const value = document.createElement('span');
    value.className = 'ui-draw-decision-card-value';
    const cardDisplay = getCardDisplayParts(drawnCard.value);
    value.textContent = cardDisplay.symbol ? `${cardDisplay.label}\n${cardDisplay.symbol}` : cardDisplay.label;

    card.appendChild(value);

    const details = document.createElement('div');
    details.className = 'ui-draw-decision-details';

    const title = document.createElement('p');
    title.className = 'ui-draw-decision-title';
    title.textContent = t('game.modal.drawDecision.cardTitle');

    const description = document.createElement('p');
    description.className = 'ui-draw-decision-description';
    description.textContent = `${getColorLabel(drawnCard.color)} ${drawnCard.value}`;

    details.append(title, description);

    if (drawnCard.color === 'wild') {
      const hint = document.createElement('p');
      hint.className = 'ui-draw-decision-hint';
      hint.textContent = t('game.modal.drawDecision.wildHint');
      details.appendChild(hint);
    }

    wrapper.append(card, details);
    container.appendChild(wrapper);
  }

  private isRoundInProgress(): boolean {
    return this.roomGameStatus === 'in_progress';
  }

  private async promptLeaveRoom(): Promise<void> {
    if (!this.roomId) {
      this.pushLog(t('game.log.noActiveRoomToLeave'));
      return;
    }

    const shouldLeave = await askConfirmation({
      title: t('game.modal.leave.title'),
      message: t('game.modal.leave.message'),
      confirmLabel: t('game.modal.leave.confirm'),
      cancelLabel: t('game.modal.leave.cancel'),
      confirmTone: 'danger',
    });

    if (!shouldLeave) {
      return;
    }

    this.isLeavingRoom = true;
    this.pushLog(t('game.log.leavingRoom'));
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
      hudMode: this.responsiveLayout.hudMode,
      compact: this.responsiveLayout.compact,
      fontScale: this.responsiveLayout.fontScale,
    });
    this.cardStage?.setLayoutMetrics({
      hudWidth: this.responsiveLayout.hudWidth,
      hudMargin: this.responsiveLayout.hudMargin,
      hudMode: this.responsiveLayout.hudMode,
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
      startEnabled: this.canStartGame(),
      drawEnabled: this.canDrawCard(),
      roundInProgress: this.isRoundInProgress(),
      currentTurn: getInitialTurnMessage(),
    };
  }

  private updateRoomDetails(playerListOverride?: string): void {
    if (playerListOverride !== undefined) {
      this.lastPlayerListMessage = playerListOverride;
    }

    this.hud?.update({
      roomLabel: this.getRoomLabel(),
      playerList: this.lastPlayerListMessage,
    });
    this.syncHudActions();
  }

  private canStartGame(): boolean {
    return (
      Boolean(this.roomId) &&
      this.player?.id === this.roomHostId &&
      this.roomGameStatus !== 'in_progress'
    );
  }

  private getRoomLabel(): string {
    return this.roomId ? t('game.room.current', { roomId: this.roomId }) : t('game.room.none');
  }
}






































