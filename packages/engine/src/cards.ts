import type { Card } from "@free-frees/shared";
import * as prand from "pure-rand";

export const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export const suits = ["clubs", "diamonds", "hearts", "spades"] as const;

export function makeStandardDeck(): Card[] {
  return suits.flatMap((suit) =>
    ranks.map((rank, index) => ({
      id: `${rank}-${suit}`,
      rank,
      suit,
      color: suit === "diamonds" || suit === "hearts" ? "red" : "black",
      value: index + 1,
      faceUp: true
    }))
  );
}

export function shuffle<T>(items: T[], seed: number): T[] {
  const copy = [...items];
  let rng = prand.xoroshiro128plus(seed);
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const next = prand.uniformIntDistribution(0, i, rng);
    const j = next[0];
    rng = next[1];
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function nextSeed(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0;
}
