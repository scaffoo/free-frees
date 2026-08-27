import type { Card, LegalMove, RoomView } from "@free-frees/shared";
import { makeStandardDeck, shuffle } from "../cards.js";
import type { EngineRoom, KlondikeState, RuntimeGame } from "./types.js";

const foundationSuits = ["clubs", "diamonds", "hearts", "spades"];

function top<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

function canPlaceOnTableau(card: Card, target?: Card): boolean {
  if (!target) return card.rank === "K";
  return target.faceUp && card.color !== target.color && card.value === target.value - 1;
}

function canPlaceOnFoundation(card: Card, pile: Card[]): boolean {
  const target = top(pile);
  if (!target) return card.rank === "A";
  return target.suit === card.suit && card.value === target.value + 1;
}

function cloneState(state: KlondikeState): KlondikeState {
  return {
    kind: "klondike",
    stock: state.stock.map((card) => ({ ...card })),
    waste: state.waste.map((card) => ({ ...card })),
    tableau: state.tableau.map((col) => col.map((card) => ({ ...card }))),
    foundations: Object.fromEntries(Object.entries(state.foundations).map(([suit, cards]) => [suit, cards.map((card) => ({ ...card }))]))
  };
}

function revealUncovered(state: KlondikeState) {
  for (const col of state.tableau) {
    const uncovered = top(col);
    if (uncovered && !uncovered.faceUp) uncovered.faceUp = true;
  }
}

function baseMoves(state: KlondikeState): LegalMove[] {
  const moves: LegalMove[] = [];
  if (state.stock.length > 0) {
    moves.push({ id: "draw-stock", type: "klondike.drawStock", label: "Draw 3", payload: {} });
  } else if (state.waste.length > 0) {
    moves.push({ id: "recycle-waste", type: "klondike.recycleWaste", label: "Recycle waste", payload: {} });
  }

  const wasteTop = top(state.waste);
  if (wasteTop) {
    for (let i = 0; i < state.tableau.length; i += 1) {
      if (canPlaceOnTableau(wasteTop, top(state.tableau[i]))) {
        moves.push({ id: `waste-to-tableau-${i}`, type: "klondike.move", label: `Move ${wasteTop.rank} to tableau`, payload: { from: "waste", to: `tableau-${i}` } });
      }
    }
    if (canPlaceOnFoundation(wasteTop, state.foundations[wasteTop.suit] ?? [])) {
      moves.push({ id: `waste-to-foundation-${wasteTop.suit}`, type: "klondike.move", label: `Move ${wasteTop.rank} to foundation`, payload: { from: "waste", to: `foundation-${wasteTop.suit}` } });
    }
  }

  for (let i = 0; i < state.tableau.length; i += 1) {
    const col = state.tableau[i];
    for (let start = 0; start < col.length; start += 1) {
      const card = col[start];
      if (!card.faceUp) continue;
      const run = col.slice(start);
      for (let target = 0; target < state.tableau.length; target += 1) {
        if (target !== i && canPlaceOnTableau(card, top(state.tableau[target]))) {
          moves.push({ id: `tableau-${i}-${start}-to-tableau-${target}`, type: "klondike.move", label: `Move run to tableau`, payload: { from: `tableau-${i}`, start, to: `tableau-${target}`, count: run.length } });
        }
      }
      if (start === col.length - 1 && canPlaceOnFoundation(card, state.foundations[card.suit] ?? [])) {
        moves.push({ id: `tableau-${i}-to-foundation-${card.suit}`, type: "klondike.move", label: `Move ${card.rank} to foundation`, payload: { from: `tableau-${i}`, to: `foundation-${card.suit}` } });
      }
    }
  }
  return moves;
}

export const klondikeRuntime: RuntimeGame = {
  id: "klondike-draw-3",
  minPlayers: 1,
  maxPlayers: 1,
  createInitialState(_players, seed) {
    const deck = shuffle(makeStandardDeck(), seed).map((card) => ({ ...card, faceUp: false }));
    const tableau: Card[][] = Array.from({ length: 7 }, () => []);
    for (let col = 0; col < 7; col += 1) {
      for (let row = 0; row <= col; row += 1) {
        const card = deck.pop();
        if (card) tableau[col].push({ ...card, faceUp: row === col });
      }
    }
    return {
      kind: "klondike",
      stock: deck,
      waste: [],
      tableau,
      foundations: Object.fromEntries(foundationSuits.map((suit) => [suit, []]))
    };
  },
  legalMoves(room) {
    return baseMoves(room.state as KlondikeState);
  },
  applyMove(room, moveId) {
    const state = cloneState(room.state as KlondikeState);
    const legal = baseMoves(state).find((move) => move.id === moveId);
    if (!legal) throw new Error("Illegal move");
    if (moveId === "draw-stock") {
      state.waste.push(...state.stock.splice(Math.max(0, state.stock.length - 3)).map((card) => ({ ...card, faceUp: true })));
    } else if (moveId === "recycle-waste") {
      state.stock = state.waste.reverse().map((card) => ({ ...card, faceUp: false }));
      state.waste = [];
    } else {
      const payload = legal.payload as { from: string; to: string; start?: number };
      let moving: Card[] = [];
      if (payload.from === "waste") moving = state.waste.splice(-1);
      if (payload.from.startsWith("tableau-")) {
        const fromIndex = Number(payload.from.split("-")[1]);
        moving = state.tableau[fromIndex].splice(payload.start ?? state.tableau[fromIndex].length - 1);
      }
      if (payload.to.startsWith("tableau-")) state.tableau[Number(payload.to.split("-")[1])].push(...moving);
      if (payload.to.startsWith("foundation-")) state.foundations[payload.to.replace("foundation-", "")].push(...moving);
      revealUncovered(state);
    }
    const finished = Object.values(state.foundations).reduce((sum, pile) => sum + pile.length, 0) === 52;
    return { ...room, state, status: finished ? "finished" : "active", winnerPlayerIds: finished ? [room.players[0]?.id].filter(Boolean) : undefined };
  },
  toView(room, viewerPlayerId) {
    return {
      id: room.id,
      gameId: room.gameId,
      name: room.name,
      status: room.status,
      players: room.players,
      createdAt: room.createdAt,
      state: room.state,
      legalMoves: viewerPlayerId ? baseMoves(room.state as KlondikeState) : [],
      winnerPlayerIds: room.winnerPlayerIds
    } satisfies RoomView;
  }
};
