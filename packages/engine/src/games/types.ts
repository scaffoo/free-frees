import type { Card, LegalMove, Player, RoomView } from "@free-frees/shared";

export type EngineGameId = string;

export type EngineEvent = {
  id: string;
  roomId: string;
  playerId?: string;
  type: string;
  payload: unknown;
  createdAt: string;
};

export type EngineRoom = {
  id: string;
  gameId: EngineGameId;
  name: string;
  status: "waiting" | "active" | "finished";
  seed: number;
  players: Player[];
  state: KlondikeState | GoFishState;
  events: EngineEvent[];
  createdAt: string;
  winnerPlayerIds?: string[];
};

export type RuntimeGame = {
  id: EngineGameId;
  minPlayers: number;
  maxPlayers: number;
  createInitialState(players: Player[], seed: number): KlondikeState | GoFishState;
  legalMoves(room: EngineRoom, viewerPlayerId?: string): LegalMove[];
  applyMove(room: EngineRoom, moveId: string, actorPlayerId?: string): EngineRoom;
  toView(room: EngineRoom, viewerPlayerId?: string): RoomView;
};

export type KlondikeState = {
  kind: "klondike";
  stock: Card[];
  waste: Card[];
  tableau: Card[][];
  foundations: Record<string, Card[]>;
};

export type GoFishState = {
  kind: "go-fish";
  stock: Card[];
  hands: Record<string, Card[]>;
  books: Record<string, string[]>;
  currentPlayerId: string;
};
