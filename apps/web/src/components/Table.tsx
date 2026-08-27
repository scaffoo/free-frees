import type { Card, DeclarativeGameDefinition, LegalMove, RoomView } from "@free-frees/shared";
import type { DragEvent, ReactNode } from "react";
import { useState } from "react";
import { CardView } from "./CardView";

type TableProps = {
  definition: DeclarativeGameDefinition;
  room: RoomView;
  onMove: (moveId: string) => void;
};

type DragSource = {
  zone: string;
  index?: number;
  cardIndex?: number;
  isTop?: boolean;
};

type StateRecord = Record<string, unknown>;

function asRecord(value: unknown): StateRecord {
  return value && typeof value === "object" ? value as StateRecord : {};
}

function cards(value: unknown): Card[] {
  return Array.isArray(value) ? value as Card[] : [];
}

function cardMatrix(value: unknown): Card[][] {
  return Array.isArray(value) ? value as Card[][] : [];
}

function movePayload(move: LegalMove) {
  return move.payload as { from?: string; to?: string; start?: number };
}

function readDrag(event: DragEvent): DragSource | undefined {
  const raw = event.dataTransfer.getData("application/free-frees-card");
  return raw ? JSON.parse(raw) as DragSource : undefined;
}

function startDrag(event: DragEvent, source: DragSource) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/free-frees-card", JSON.stringify(source));
}

function moveForDrop(moves: LegalMove[], source: DragSource, target: string) {
  return moves.find((move) => {
    const payload = movePayload(move);
    if (payload.to !== target) return false;
    if (source.zone === "waste") return payload.from === "waste";
    if (source.zone === "tableau") {
      return (
        payload.from === `tableau-${source.index}` &&
        (payload.start === source.cardIndex || (source.isTop && move.id.startsWith(`tableau-${source.index}-to-foundation-`)))
      );
    }
    return payload.from === source.zone;
  });
}

function sourceKey(source: DragSource) {
  return `${source.zone}:${source.index ?? ""}:${source.cardIndex ?? ""}`;
}

function sourceMoves(moves: LegalMove[], source: DragSource) {
  return moves.filter((move) => {
    const payload = movePayload(move);
    if (source.zone === "waste") return payload.from === "waste";
    if (source.zone === "tableau") {
      return (
        move.id.startsWith(`tableau-${source.index}-${source.cardIndex}-`) ||
        (source.isTop && move.id.startsWith(`tableau-${source.index}-to-foundation-`)) ||
        (payload.from === `tableau-${source.index}` && payload.start === source.cardIndex)
      );
    }
    return payload.from === source.zone;
  });
}

function DropPile({ target, children, onMove, moves }: { target: string; children: ReactNode; onMove: (moveId: string) => void; moves: LegalMove[] }) {
  return (
    <button
      className="rounded focus:outline-none focus:ring-2 focus:ring-white"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const source = readDrag(event);
        const move = source ? moveForDrop(moves, source, target) : undefined;
        if (move) onMove(move.id);
      }}
      onClick={() => {
        const move = moves.find((candidate) => movePayload(candidate).to === target || candidate.id.endsWith(target));
        if (move) onMove(move.id);
      }}
    >
      {children}
    </button>
  );
}

function CardButton({ card, source, moves, onSourceMove, stackOffset = false }: { card: Card; source: DragSource; moves: LegalMove[]; onSourceMove: (source: DragSource, moves: LegalMove[]) => void; stackOffset?: boolean }) {
  return (
    <button
      className="block rounded focus:outline-none focus:ring-2 focus:ring-white disabled:cursor-default"
      style={{ marginTop: stackOffset ? -48 : 0 }}
      draggable={moves.length > 0}
      disabled={moves.length === 0}
      onDragStart={(event) => startDrag(event, source)}
      onClick={() => onSourceMove(source, moves)}
      title={moves.length > 1 ? `${moves.length} legal destinations` : moves[0]?.label}
    >
      <CardView card={card} />
    </button>
  );
}

function PileZone({ id, pile, moves, onMove }: { id: string; pile: Card[]; moves: LegalMove[]; onMove: (moveId: string) => void }) {
  const top = pile[pile.length - 1];
  const source = { zone: id };
  const availableMoves = top ? sourceMoves(moves, source) : [];
  return (
    <DropPile target={id} moves={moves} onMove={onMove}>
      {top ? (
        <span draggable={availableMoves.length > 0} onDragStart={(event) => startDrag(event, source)}>
          <CardView card={top} />
        </span>
      ) : (
        <CardView />
      )}
    </DropPile>
  );
}

function TableauZone({ columns, moves, onMove, onSourceMove }: { columns: Card[][]; moves: LegalMove[]; onMove: (moveId: string) => void; onSourceMove: (source: DragSource, moves: LegalMove[]) => void }) {
  return (
    <div className="grid grid-cols-7 gap-2 md:gap-4">
      {columns.map((column, columnIndex) => (
        <div
          key={columnIndex}
          className="min-h-64 rounded-md p-1 transition-colors hover:bg-white/5"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const source = readDrag(event);
            const move = source ? moveForDrop(moves, source, `tableau-${columnIndex}`) : undefined;
            if (move) onMove(move.id);
          }}
        >
          {column.map((card, cardIndex) => {
            const source = { zone: "tableau", index: columnIndex, cardIndex, isTop: cardIndex === column.length - 1 };
            return <CardButton key={card.id} card={card} source={source} moves={sourceMoves(moves, source)} onSourceMove={onSourceMove} stackOffset={cardIndex > 0} />;
          })}
        </div>
      ))}
    </div>
  );
}

function PlayerZones({ room, state, onMove }: { room: RoomView; state: StateRecord; onMove: (moveId: string) => void }) {
  const hands = asRecord(state.hands);
  const books = asRecord(state.books);
  const currentPlayerId = typeof state.currentPlayerId === "string" ? state.currentPlayerId : undefined;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {room.players.map((player) => (
        <section key={player.id} className="rounded-lg bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{player.name}{player.id === currentPlayerId ? " · Turn" : ""}</h2>
            <div className="text-sm">{Array.isArray(books[player.id]) ? (books[player.id] as string[]).length : 0} books</div>
          </div>
          <div className="mb-4 flex min-h-20 flex-wrap gap-2">
            {cards(hands[player.id]).map((card) => <CardView key={card.id} card={card} compact />)}
          </div>
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(books[player.id]) ? books[player.id] as string[] : []).map((rank) => (
              <span key={rank} className="rounded bg-white px-2 py-1 text-sm font-bold text-ink">{rank} book</span>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ActionBar({ moves, onMove }: { moves: LegalMove[]; onMove: (moveId: string) => void }) {
  const actions = moves.filter((move) => !movePayload(move).from && !movePayload(move).to);
  return (
    <section className="rounded-lg bg-black/20 p-4">
      <div className="flex flex-wrap gap-2">
        {moves.length === 0 && <span className="text-sm text-white/70">Waiting for an available action.</span>}
        {actions.map((move) => (
          <button key={move.id} className="rounded bg-white px-3 py-2 text-sm font-semibold text-ink" onClick={() => onMove(move.id)}>{move.label}</button>
        ))}
        {actions.length === 0 && moves.map((move) => (
          <button key={move.id} className="rounded bg-white px-3 py-2 text-sm font-semibold text-ink" onClick={() => onMove(move.id)}>{move.label}</button>
        ))}
      </div>
    </section>
  );
}

export function Table({ definition, room, onMove }: TableProps) {
  const [clickCycle, setClickCycle] = useState<Record<string, number>>({});
  const state = asRecord(room.state);
  const hasHands = Boolean(state.hands);
  const stock = cards(state.stock);
  const waste = cards(state.waste);
  const foundations = asRecord(state.foundations);
  const tableau = cardMatrix(state.tableau);
  const foundationZone = definition.zones.find((zone) => zone.kind === "foundation");
  const foundationLabels = foundationZone?.labels ?? Object.keys(foundations);
  const stockAction = room.legalMoves.find((move) => move.id === "draw-stock" || move.id === "recycle-waste");
  const wasteTop = waste[waste.length - 1];
  const onSourceMove = (source: DragSource, moves: LegalMove[]) => {
    if (moves.length === 0) return;
    const key = sourceKey(source);
    const index = clickCycle[key] ?? 0;
    onMove(moves[index % moves.length].id);
    setClickCycle((current) => ({ ...current, [key]: index + 1 }));
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-felt p-4 text-white">
      <div className="mx-auto grid max-w-7xl gap-5">
        {hasHands ? <PlayerZones room={room} state={state} onMove={onMove} /> : null}

        <div className="flex flex-wrap items-start justify-between gap-4">
          {definition.zones.some((zone) => zone.kind === "stock" || zone.kind === "waste") && (
            <div className="flex gap-3">
              <button className="rounded focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50" disabled={!stockAction} onClick={() => stockAction && onMove(stockAction.id)} title={stockAction?.label ?? "No stock action"}>
                <CardView card={stock.length ? { id: "stock", rank: "?", suit: "hidden", value: 0, faceUp: false } : undefined} />
              </button>
              <div className="flex -space-x-8">
                {waste.slice(-3).map((card) => {
                  const source = { zone: "waste", isTop: card.id === wasteTop?.id };
                  return <CardButton key={card.id} card={card} source={source} moves={card.id === wasteTop?.id ? sourceMoves(room.legalMoves, source) : []} onSourceMove={onSourceMove} />;
                })}
              </div>
            </div>
          )}

          {foundationLabels.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {foundationLabels.map((label) => <PileZone key={label} id={`foundation-${label}`} pile={cards(foundations[label])} moves={room.legalMoves} onMove={onMove} />)}
            </div>
          )}
        </div>

        {tableau.length > 0 && <TableauZone columns={tableau} moves={room.legalMoves} onMove={onMove} onSourceMove={onSourceMove} />}
        <ActionBar moves={room.legalMoves} onMove={onMove} />
      </div>
    </div>
  );
}
