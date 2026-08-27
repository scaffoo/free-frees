import { describe, expect, it } from "vitest";
import { compileDefinitions, createRoom, legalMoves, submitMove } from "../src/index.js";

describe("Definitions", () => {
  it("loads game definitions from JSON files", () => {
    const definitions = compileDefinitions();
    expect(definitions.map((definition) => definition.id).sort()).toEqual(["go-fish-2p", "klondike-draw-3"]);
    expect(definitions.every((definition) => definition.engine.runtime === "genericCardGame")).toBe(true);
  });
});

describe("Klondike", () => {
  it("deals traditional draw-3 layout and draws from stock", () => {
    const room = createRoom({ gameId: "klondike-draw-3", name: "Solo", seed: 42, players: [{ id: "1", name: "A", seat: 0, isBot: false }] });
    const state = room.state;
    expect(state.kind).toBe("generic-card-game");
    expect([1, 2, 3, 4, 5, 6, 7].map((column) => state.zones[`T${column}-Up`].cards.length + state.zones[`T${column}-Down`].cards.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(state.zones.D1.cards).toHaveLength(24);
    const draw = legalMoves(room, "1").find((move) => move.payload.from === "D1" && move.payload.to === "C1" && move.payload.count === 3);
    expect(draw).toBeDefined();
    const updated = submitMove(room, draw!.id, "1");
    expect(updated.state.zones.C1.cards).toHaveLength(3);
    expect(updated.state.zones.D1.cards).toHaveLength(21);
  });
});

describe("Go Fish", () => {
  it("generates ask-rank legal moves only from current player's hand", () => {
    const room = createRoom({
      gameId: "go-fish-2p",
      name: "Fish",
      seed: 7,
      players: [
        { id: "1", name: "A", seat: 0, isBot: false },
        { id: "2", name: "B", seat: 1, isBot: true }
      ]
    });
    const moves = legalMoves(room, "1");
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((move) => move.type === "communicate")).toBe(true);
    expect(legalMoves(room, "2")).toHaveLength(0);
  });
});
