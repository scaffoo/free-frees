import type { Card } from "@free-frees/shared";
import { cn } from "../lib/ui";

const suitSymbols: Record<string, string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
  Clubs: "♣",
  Diamonds: "♦",
  Hearts: "♥",
  Spades: "♠"
};

export function CardView({ card, compact = false }: { card?: Card; compact?: boolean }) {
  if (!card) return <div className={cn("card card-empty", compact ? "w-11" : "w-20")} />;
  const hidden = !card.faceUp || card.rank === "?";
  const suit = suitSymbols[card.suit] ?? "";
  const label = `${card.rank}${suit}`;
  return (
    <div
      className={cn(
        "card",
        compact ? "w-11 text-xs" : "w-20 text-base",
        hidden ? "card-back text-emerald-100" : "card-face",
        card.color === "red" ? "text-red-700" : "text-stone-950"
      )}
      aria-label={hidden ? "Face down card" : label}
    >
      {hidden ? (
        <img className="card-back-image" src="/assets/cards/card-back.svg" alt="" draggable={false} />
      ) : (
        <>
          <span className="card-corner card-corner-top">
            <span>{card.rank}</span>
            <span>{suit}</span>
          </span>
          <span className={cn("card-center", compact ? "text-lg" : "text-4xl")}>{suit}</span>
          <span className="card-corner card-corner-bottom">
            <span>{card.rank}</span>
            <span>{suit}</span>
          </span>
        </>
      )}
    </div>
  );
}
