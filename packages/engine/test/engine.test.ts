import { describe, expect, it } from "vitest";
import { compileDefinitions, createRoom, legalMoves, submitMove } from "../src/index.js";

describe("Definitions", () => {
  it("loads game definitions from JSON files", () => {
    const definitions = compileDefinitions();
    expect(definitions.map((definition) => definition.id).sort()).toEqual(["go-fish-2p", "klondike-draw-3"]);
    expect(definitions.every((definition) => definition.engine.languageVersion === "0.1")).toBe(true);
  });
});

describe("Klondike", () => {
  it("deals traditional draw-3 layout and draws from stock", () => {
    const room = createRoom({ gameId: "klondike-draw-3", name: "Solo", seed: 42, players: [{ id: "p1", name: "A", seat: 0, isBot: false }] });
    const state = room.state;
    expect(state.kind).toBe("klondike");
    if (state.kind !== "klondike") return;
    expect(state.tableau.map((col) => col.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(state.stock).toHaveLength(24);
    const updated = submitMove(room, "draw-stock", "p1");
    if (updated.state.kind !== "klondike") return;
    expect(updated.state.waste).toHaveLength(3);
    expect(updated.state.stock).toHaveLength(21);
  });
});

describe("Go Fish", () => {
  it("generates ask-rank legal moves only from current player's hand", () => {
    const room = createRoom({
      gameId: "go-fish-2p",
      name: "Fish",
      seed: 7,
      players: [
        { id: "p1", name: "A", seat: 0, isBot: false },
        { id: "p2", name: "B", seat: 1, isBot: true }
      ]
    });
    const moves = legalMoves(room, "p1");
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((move) => move.type === "gofish.askRank")).toBe(true);
    expect(legalMoves(room, "p2")).toHaveLength(0);
  });
});
