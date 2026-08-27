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
  state: GenericCardGameState;
  events: EngineEvent[];
  createdAt: string;
  winnerPlayerIds?: string[];
};

export type RuntimeGame = {
  id: EngineGameId;
  minPlayers: number;
  maxPlayers: number;
  createInitialState(players: Player[], seed: number): GenericCardGameState;
  legalMoves(room: EngineRoom, viewerPlayerId?: string): LegalMove[];
  applyMove(room: EngineRoom, moveId: string, actorPlayerId?: string): EngineRoom;
  toView(room: EngineRoom, viewerPlayerId?: string): RoomView;
};

export type GenericZoneState = {
  label: string;
  attributes: Record<string, unknown>;
  cards: Card[];
};

export type GenericCardGameState = {
  kind: "generic-card-game";
  stateType: string;
  variables: Record<string, unknown>;
  actor: number;
  zones: Record<string, GenericZoneState>;
  communications: Array<{ source: number; destination: number; verb: string; value?: unknown }>;
};
