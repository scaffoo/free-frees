import { nanoid } from "nanoid";
import type { LegalMove, Player } from "@free-frees/shared";
import { compileDefinitions } from "./definitions/index.js";
import { createGenericRuntime } from "./games/genericCardGame.js";
import type { EngineGameId, EngineRoom, RuntimeGame } from "./games/types.js";
export type { EngineEvent, EngineRoom, GenericCardGameState, GenericZoneState } from "./games/types.js";
export { compileDefinitions };

export function getRuntime(gameId: string): RuntimeGame {
  const definition = compileDefinitions().find((candidate) => candidate.id === gameId);
  if (!definition) throw new Error(`Unknown game: ${gameId}`);
  return createGenericRuntime(definition);
}

export function createRoom(input: { gameId: EngineGameId; name: string; players: Player[]; seed?: number }): EngineRoom {
  const runtime = getRuntime(input.gameId);
  const seed = input.seed ?? Math.floor(Math.random() * 2_147_483_647);
  return {
    id: nanoid(),
    gameId: input.gameId,
    name: input.name,
    status: input.players.length >= runtime.minPlayers ? "active" : "waiting",
    seed,
    players: input.players,
    state: runtime.createInitialState(input.players, seed),
    events: [],
    createdAt: new Date().toISOString()
  };
}

export function legalMoves(room: EngineRoom, viewerPlayerId?: string): LegalMove[] {
  return getRuntime(room.gameId).legalMoves(room, viewerPlayerId);
}

export function submitMove(room: EngineRoom, moveId: string, actorPlayerId?: string): EngineRoom {
  const updated = getRuntime(room.gameId).applyMove(room, moveId, actorPlayerId);
  return {
    ...updated,
    events: [
      ...room.events,
      { id: nanoid(), roomId: room.id, playerId: actorPlayerId, type: "move", payload: { moveId }, createdAt: new Date().toISOString() }
    ]
  };
}

export function toRoomView(room: EngineRoom, viewerPlayerId?: string) {
  return getRuntime(room.gameId).toView(room, viewerPlayerId);
}

export function chooseRandomBotMove(room: EngineRoom, botPlayerId: string): LegalMove | undefined {
  const moves = legalMoves(room, botPlayerId);
  return moves.length ? moves[Math.floor(Math.random() * moves.length)] : undefined;
}
