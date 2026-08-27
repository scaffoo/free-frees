import type { Card, DeclarativeGameDefinition, LegalMove, RoomView } from "@free-frees/shared";
import type { DragEvent, ReactNode } from "react";
import { useState } from "react";
import { CardView } from "./CardView";

type TableProps = {
  definition: DeclarativeGameDefinition;
  room: RoomView;
  onMove: (moveId: string) => void;
};

type ZoneView = {
  label: string;
  attributes: Record<string, unknown>;
  cards: Card[];
};

type DragSource = {
  zone: string;
  count: number;
};

function stateZones(room: RoomView): Record<string, ZoneView> {
  const state = room.state as { zones?: Record<string, ZoneView> };
  return state?.zones ?? {};
}

function movePayload(move: LegalMove) {
  return move.payload as { from?: string; to?: string; count?: number };
}

function readDrag(event: DragEvent): DragSource | undefined {
  const raw = event.dataTransfer.getData("application/free-frees-card");
  return raw ? JSON.parse(raw) as DragSource : undefined;
}

function startDrag(event: DragEvent, source: DragSource) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/free-frees-card", JSON.stringify(source));
}

function movesFrom(moves: LegalMove[], source: DragSource) {
  return moves.filter((move) => {
    const payload = movePayload(move);
    return payload.from === source.zone && payload.count === source.count;
  });
}

function moveForDrop(moves: LegalMove[], source: DragSource, target: string) {
  return movesFrom(moves, source).find((move) => movePayload(move).to === target);
}

function sourceKey(source: DragSource) {
  return `${source.zone}:${source.count}`;
}

function zoneType(zone: ZoneView) {
  return String(zone.attributes.type ?? "Zone");
}

function zoneVisibility(zone: ZoneView) {
  return String(zone.attributes.visibility ?? "Public");
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const group = key(item);
    groups[group] = [...(groups[group] ?? []), item];
    return groups;
  }, {});
}

function DropTarget({ target, moves, onMove, children, className = "" }: { target: string; moves: LegalMove[]; onMove: (moveId: string) => void; children: ReactNode; className?: string }) {
  return (
    <button
      className={`rounded focus:outline-none focus:ring-2 focus:ring-white ${className}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const source = readDrag(event);
        const move = source ? moveForDrop(moves, source, target) : undefined;
        if (move) onMove(move.id);
      }}
      onClick={() => {
        const move = moves.find((candidate) => movePayload(candidate).to === target);
        if (move) onMove(move.id);
      }}
    >
      {children}
    </button>
  );
}

function StackCard({ card, source, moves, onSourceMove, offset }: { card: Card; source: DragSource; moves: LegalMove[]; onSourceMove: (source: DragSource, moves: LegalMove[]) => void; offset: boolean }) {
  return (
    <button
      className="block rounded focus:outline-none focus:ring-2 focus:ring-white disabled:cursor-default"
      style={{ marginTop: offset ? -48 : 0 }}
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

function Pile({ zone, moves, onMove, onSourceMove }: { zone: ZoneView; moves: LegalMove[]; onMove: (moveId: string) => void; onSourceMove: (source: DragSource, moves: LegalMove[]) => void }) {
  const top = zone.cards[zone.cards.length - 1];
  const source = { zone: zone.label, count: 1 };
  const available = top ? movesFrom(moves, source) : [];
  return (
    <DropTarget target={zone.label} moves={moves} onMove={onMove}>
      {top ? (
        <span draggable={available.length > 0} onDragStart={(event) => startDrag(event, source)} onClick={() => onSourceMove(source, available)}>
          <CardView card={top} />
        </span>
      ) : (
        <CardView />
      )}
    </DropTarget>
  );
}

function TableauColumns({ zones, moves, onMove, onSourceMove }: { zones: ZoneView[]; moves: LegalMove[]; onMove: (moveId: string) => void; onSourceMove: (source: DragSource, moves: LegalMove[]) => void }) {
  const byColumn = groupBy(zones, (zone) => String(zone.attributes.column ?? zone.label));
  return (
    <div className="grid grid-cols-7 gap-2 md:gap-4">
      {Object.entries(byColumn).sort(([a], [b]) => Number(a) - Number(b)).map(([column, columnZones]) => {
        const hidden = columnZones.find((zone) => zoneVisibility(zone) === "Hidden");
        const visible = columnZones.find((zone) => zoneVisibility(zone) !== "Hidden") ?? columnZones[0];
        return (
          <DropTarget key={column} target={visible.label} moves={moves} onMove={onMove} className="min-h-64 p-1 text-left transition-colors hover:bg-white/5">
            <div>
              {(hidden?.cards ?? []).map((card, index) => <div key={card.id} style={{ marginTop: index === 0 ? 0 : -48 }}><CardView card={card} /></div>)}
              {visible.cards.map((card, index) => {
                const count = visible.cards.length - index;
                const source = { zone: visible.label, count };
                return <StackCard key={card.id} card={card} source={source} moves={movesFrom(moves, source)} onSourceMove={onSourceMove} offset={(hidden?.cards.length ?? 0) > 0 || index > 0} />;
              })}
              {visible.cards.length === 0 && (hidden?.cards.length ?? 0) === 0 ? <CardView /> : null}
            </div>
          </DropTarget>
        );
      })}
    </div>
  );
}

function PlayerPanels({ zones }: { zones: ZoneView[] }) {
  const byPlayer = groupBy(zones.filter((zone) => zone.attributes.player !== undefined), (zone) => String(zone.attributes.player));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Object.entries(byPlayer).map(([player, playerZones]) => (
        <section key={player} className="rounded-lg bg-black/20 p-4">
          <h2 className="mb-3 font-bold">Player {player}</h2>
          {playerZones.map((zone) => (
            <div key={zone.label} className="mb-3">
              <div className="mb-2 text-sm text-white/70">{zone.label}</div>
              <div className="flex min-h-16 flex-wrap gap-2">
                {zone.cards.map((card) => <CardView key={card.id} card={card} compact />)}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function CommunicationActions({ moves, onMove }: { moves: LegalMove[]; onMove: (moveId: string) => void }) {
  const communicationMoves = moves.filter((move) => move.type === "communicate");
  if (communicationMoves.length === 0) return null;
  return (
    <section className="rounded-lg bg-black/20 p-4">
      <div className="flex flex-wrap gap-2">
        {communicationMoves.map((move) => <button key={move.id} className="rounded bg-white px-3 py-2 text-sm font-semibold text-ink" onClick={() => onMove(move.id)}>{move.label}</button>)}
      </div>
    </section>
  );
}

export function Table({ definition: _definition, room, onMove }: TableProps) {
  const [clickCycle, setClickCycle] = useState<Record<string, number>>({});
  const zones = Object.values(stateZones(room));
  const onSourceMove = (source: DragSource, moves: LegalMove[]) => {
    if (moves.length === 0) return;
    const key = sourceKey(source);
    const index = clickCycle[key] ?? 0;
    onMove(moves[index % moves.length].id);
    setClickCycle((current) => ({ ...current, [key]: index + 1 }));
  };

  const drawZones = zones.filter((zone) => zoneType(zone) === "Draw");
  const discardZones = zones.filter((zone) => zoneType(zone) === "Discard");
  const foundationZones = zones.filter((zone) => zoneType(zone) === "Foundation");
  const tableauZones = zones.filter((zone) => zoneType(zone) === "Tableau");
  const playerZones = zones.filter((zone) => ["Hand", "Book", "Meld"].includes(zoneType(zone)));
  const otherZones = zones.filter((zone) => !["Draw", "Discard", "Foundation", "Tableau", "Hand", "Book", "Meld"].includes(zoneType(zone)));

  return (
    <div className="min-h-[calc(100vh-72px)] bg-felt p-4 text-white">
      <div className="mx-auto grid max-w-7xl gap-5">
        {playerZones.length > 0 ? <PlayerPanels zones={playerZones} /> : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            {[...drawZones, ...discardZones, ...otherZones].map((zone) => <Pile key={zone.label} zone={zone} moves={room.legalMoves} onMove={onMove} onSourceMove={onSourceMove} />)}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {foundationZones.map((zone) => <Pile key={zone.label} zone={zone} moves={room.legalMoves} onMove={onMove} onSourceMove={onSourceMove} />)}
          </div>
        </div>
        {tableauZones.length > 0 ? <TableauColumns zones={tableauZones} moves={room.legalMoves} onMove={onMove} onSourceMove={onSourceMove} /> : null}
        <CommunicationActions moves={room.legalMoves} onMove={onMove} />
      </div>
    </div>
  );
}
