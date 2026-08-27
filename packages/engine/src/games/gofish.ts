import type { Card, LegalMove, RoomView } from "@free-frees/shared";
import { ranks, makeStandardDeck, shuffle } from "../cards.js";
import type { EngineRoom, GoFishState, RuntimeGame } from "./types.js";

function cloneState(state: GoFishState): GoFishState {
  return {
    kind: "go-fish",
    stock: state.stock.map((card) => ({ ...card })),
    hands: Object.fromEntries(Object.entries(state.hands).map(([id, hand]) => [id, hand.map((card) => ({ ...card }))])),
    books: Object.fromEntries(Object.entries(state.books).map(([id, books]) => [id, [...books]])),
    currentPlayerId: state.currentPlayerId
  };
}

function collectBooks(state: GoFishState, playerId: string) {
  for (const rank of ranks) {
    const cards = state.hands[playerId].filter((card) => card.rank === rank);
    if (cards.length === 4 && !state.books[playerId].includes(rank)) {
      state.books[playerId].push(rank);
      state.hands[playerId] = state.hands[playerId].filter((card) => card.rank !== rank);
    }
  }
}

function nextPlayer(room: EngineRoom, playerId: string) {
  const index = room.players.findIndex((player) => player.id === playerId);
  return room.players[(index + 1) % room.players.length]?.id ?? playerId;
}

function legal(room: EngineRoom, viewerPlayerId?: string): LegalMove[] {
  const state = room.state as GoFishState;
  if (room.status !== "active" || viewerPlayerId !== state.currentPlayerId) return [];
  const hand = state.hands[viewerPlayerId] ?? [];
  const availableRanks = [...new Set(hand.map((card) => card.rank))];
  const targets = room.players.filter((player) => player.id !== viewerPlayerId);
  return availableRanks.flatMap((rank) =>
    targets.map((target) => ({
      id: `ask-${target.id}-${rank}`,
      type: "gofish.askRank",
      label: `Ask ${target.name} for ${rank}s`,
      playerId: viewerPlayerId,
      payload: { targetPlayerId: target.id, rank }
    }))
  );
}

function maskForViewer(state: GoFishState, viewerPlayerId?: string): GoFishState {
  return {
    ...state,
    stock: state.stock.map((card) => ({ ...card, rank: "?", suit: "hidden", color: undefined, value: 0, faceUp: false })),
    hands: Object.fromEntries(
      Object.entries(state.hands).map(([playerId, hand]) => [
        playerId,
        playerId === viewerPlayerId ? hand : hand.map((card) => ({ ...card, rank: "?", suit: "hidden", color: undefined, value: 0, faceUp: false }))
      ])
    )
  };
}

export const goFishRuntime: RuntimeGame = {
  id: "go-fish-2p",
  minPlayers: 2,
  maxPlayers: 2,
  createInitialState(players, seed) {
    const deck = shuffle(makeStandardDeck(), seed);
    const hands: Record<string, Card[]> = Object.fromEntries(players.map((player) => [player.id, []]));
    const books: Record<string, string[]> = Object.fromEntries(players.map((player) => [player.id, []]));
    for (let round = 0; round < 7; round += 1) {
      for (const player of players) {
        const card = deck.pop();
        if (card) hands[player.id].push(card);
      }
    }
    const state: GoFishState = { kind: "go-fish", stock: deck, hands, books, currentPlayerId: players[0]?.id ?? "p1" };
    for (const player of players) collectBooks(state, player.id);
    return state;
  },
  legalMoves: legal,
  applyMove(room, moveId, actorPlayerId) {
    const state = cloneState(room.state as GoFishState);
    const chosen = legal(room, actorPlayerId).find((move) => move.id === moveId);
    if (!chosen || !actorPlayerId) throw new Error("Illegal move");
    const { targetPlayerId, rank } = chosen.payload as { targetPlayerId: string; rank: string };
    const matches = state.hands[targetPlayerId].filter((card) => card.rank === rank);
    if (matches.length > 0) {
      state.hands[targetPlayerId] = state.hands[targetPlayerId].filter((card) => card.rank !== rank);
      state.hands[actorPlayerId].push(...matches);
    } else {
      const drawn = state.stock.pop();
      if (drawn) state.hands[actorPlayerId].push(drawn);
      if (!drawn || drawn.rank !== rank) state.currentPlayerId = nextPlayer(room, actorPlayerId);
    }
    for (const player of room.players) collectBooks(state, player.id);
    const noCardsInHands = Object.values(state.hands).every((hand) => hand.length === 0);
    const finished = Object.values(state.books).reduce((sum, books) => sum + books.length, 0) === 13 || (state.stock.length === 0 && noCardsInHands);
    const maxBooks = Math.max(...Object.values(state.books).map((books) => books.length));
    return {
      ...room,
      state,
      status: finished ? "finished" : "active",
      winnerPlayerIds: finished ? Object.entries(state.books).filter(([, books]) => books.length === maxBooks).map(([playerId]) => playerId) : undefined
    };
  },
  toView(room, viewerPlayerId) {
    return {
      id: room.id,
      gameId: room.gameId,
      name: room.name,
      status: room.status,
      players: room.players,
      createdAt: room.createdAt,
      state: maskForViewer(room.state as GoFishState, viewerPlayerId),
      legalMoves: legal(room, viewerPlayerId),
      winnerPlayerIds: room.winnerPlayerIds
    } satisfies RoomView;
  }
};
