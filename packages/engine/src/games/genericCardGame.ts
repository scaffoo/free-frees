import type { Card, CardPlacement, CardSelection, DeclarativeGameDefinition, GameRule, LegalMove, Player, RoomView } from "@free-frees/shared";
import { shuffle } from "../cards.js";
import type { EngineRoom, GenericCardGameState, GenericZoneState, RuntimeGame } from "./types.js";

type Context = {
  source?: GenericZoneState;
  destination?: GenericZoneState;
  count?: number;
  actor?: number;
  communication?: { source: number; destination: number; verb: string; value?: unknown };
};

const suitColor = (suit: string) => suit === "Hearts" || suit === "Diamonds" ? "red" : "black";

function makeDeck(definition: DeclarativeGameDefinition): Card[] {
  const cards: Card[] = [];
  for (let deck = 1; deck <= definition.cards.decks; deck += 1) {
    for (const suit of definition.cards.suits) {
      for (const value of definition.cards.values) {
        cards.push({
          id: `${deck}-${value.name}-${suit}`,
          rank: value.name,
          suit,
          color: suitColor(suit),
          value: value.value,
          faceUp: true
        });
      }
    }
  }
  return cards;
}

function cloneState(state: GenericCardGameState): GenericCardGameState {
  return {
    kind: "generic-card-game",
    stateType: state.stateType,
    actor: state.actor,
    variables: { ...state.variables },
    communications: state.communications.map((message) => ({ ...message })),
    zones: Object.fromEntries(Object.entries(state.zones).map(([label, zone]) => [label, { label, attributes: { ...zone.attributes }, cards: zone.cards.map((card) => ({ ...card })) }]))
  };
}

function top(zone?: GenericZoneState) {
  return zone?.cards[zone.cards.length - 1];
}

function cardFromTop(zone: GenericZoneState | undefined, count: number) {
  if (!zone || count < 1 || count > zone.cards.length) return undefined;
  return zone.cards[zone.cards.length - count];
}

function playerHand(state: GenericCardGameState, player: number) {
  return Object.values(state.zones).find((zone) => zone.attributes.type === "Hand" && zone.attributes.player === player);
}

function playerZone(state: GenericCardGameState, player: number, type: string) {
  return Object.values(state.zones).find((zone) => zone.attributes.type === type && zone.attributes.player === player);
}

function rankValue(card?: Card) {
  return card?.value;
}

function resolvePath(path: string, state: GenericCardGameState, ctx: Context): unknown {
  const trimmed = path.trim();
  const plusMatch = trimmed.match(/^(.+)\s\+\s(-?\d+)$/);
  if (plusMatch) return Number(resolveValue(plusMatch[1], state, ctx)) + Number(plusMatch[2]);
  const minusMatch = trimmed.match(/^(.+)\s-\s(-?\d+)$/);
  if (minusMatch) return Number(resolveValue(minusMatch[1], state, ctx)) - Number(minusMatch[2]);
  if (trimmed === "count") return ctx.count;
  if (trimmed === "actor") return state.actor;
  if (trimmed === "source" && ctx.communication) return ctx.communication.source;
  if (trimmed === "destination" && ctx.communication) return ctx.communication.destination;
  if (trimmed === "verb" && ctx.communication) return ctx.communication.verb;
  if (trimmed === "value" && ctx.communication) return ctx.communication.value;
  if (trimmed === "source.hand.count" && ctx.communication) return playerHand(state, ctx.communication.source)?.cards.length ?? 0;
  if (trimmed === "source.hand.ranks" && ctx.communication) return [...new Set(playerHand(state, ctx.communication.source)?.cards.map((card) => card.rank) ?? [])];
  if (trimmed === "destination.hand.count" && ctx.communication) return playerHand(state, ctx.communication.destination)?.cards.length ?? 0;
  if (trimmed === "destination.hand.ranks" && ctx.communication) return [...new Set(playerHand(state, ctx.communication.destination)?.cards.map((card) => card.rank) ?? [])];
  if (trimmed === "source.count") return ctx.source?.cards.length ?? 0;
  if (trimmed === "destination.count") return ctx.destination?.cards.length ?? 0;
  if (trimmed.startsWith("source.")) return resolveZonePath(ctx.source, trimmed.replace("source.", ""), state, ctx);
  if (trimmed.startsWith("destination.")) return resolveZonePath(ctx.destination, trimmed.replace("destination.", ""), state, ctx);
  const labeled = trimmed.match(/^([A-Za-z0-9-]+)\.(.+)$/);
  if (labeled && state.zones[labeled[1]]) return resolveZonePath(state.zones[labeled[1]], labeled[2], state, ctx);
  return trimmed;
}

function resolveZonePath(zone: GenericZoneState | undefined, path: string, state: GenericCardGameState, ctx: Context): unknown {
  if (!zone) return undefined;
  if (path === "label") return zone.label;
  if (path === "count") return zone.cards.length;
  if (path === "top.rank") return rankValue(top(zone));
  if (path === "top.value") return top(zone)?.value;
  if (path === "top.suit") return top(zone)?.suit;
  if (path === "top.color") return top(zone)?.color;
  if (path === "hand.count") return playerHand(state, Number(resolveValue(path.split(".")[0], state, ctx)))?.cards.length ?? 0;
  if (path === "hand.ranks") return [];
  const cardFromTopMatch = path.match(/^cardFromTop\((.+)\)\.(rank|value|suit|color)$/);
  if (cardFromTopMatch) {
    const card = cardFromTop(zone, Number(resolveValue(cardFromTopMatch[1], state, ctx)));
    if (cardFromTopMatch[2] === "rank") return rankValue(card);
    return card?.[cardFromTopMatch[2] as "value" | "suit" | "color"];
  }
  return zone.attributes[path];
}

function resolveValue(value: unknown, state: GenericCardGameState, ctx: Context): unknown {
  if (typeof value === "string") return resolvePath(value, state, ctx);
  return value;
}

function evalPredicate(predicate: unknown, state: GenericCardGameState, ctx: Context): boolean {
  if (!predicate || typeof predicate !== "object") return false;
  const p = predicate as Record<string, unknown>;
  if (Array.isArray(p.all)) return p.all.every((child) => evalPredicate(child, state, ctx));
  if (Array.isArray(p.any)) return p.any.some((child) => evalPredicate(child, state, ctx));
  if (p.not) return !evalPredicate(p.not, state, ctx);
  if (Array.isArray(p.equals)) return resolveValue(p.equals[0], state, ctx) === resolveValue(p.equals[1], state, ctx);
  if (Array.isArray(p.notEquals)) return resolveValue(p.notEquals[0], state, ctx) !== resolveValue(p.notEquals[1], state, ctx);
  if (Array.isArray(p.greaterThan)) return Number(resolveValue(p.greaterThan[0], state, ctx)) > Number(resolveValue(p.greaterThan[1], state, ctx));
  if (Array.isArray(p.greaterThanOrEqual)) return Number(resolveValue(p.greaterThanOrEqual[0], state, ctx)) >= Number(resolveValue(p.greaterThanOrEqual[1], state, ctx));
  if (Array.isArray(p.lessThan)) return Number(resolveValue(p.lessThan[0], state, ctx)) < Number(resolveValue(p.lessThan[1], state, ctx));
  if (Array.isArray(p.lessThanOrEqual)) return Number(resolveValue(p.lessThanOrEqual[0], state, ctx)) <= Number(resolveValue(p.lessThanOrEqual[1], state, ctx));
  if (Array.isArray(p.in)) {
    const haystack = resolveValue(p.in[1], state, ctx);
    return Array.isArray(haystack) && haystack.includes(resolveValue(p.in[0], state, ctx));
  }
  return false;
}

function selectionCount(selection: CardSelection, state: GenericCardGameState, ctx: Context) {
  if ("top" in selection) return Number(resolveValue(selection.top, state, ctx));
  if ("bottom" in selection) return Number(resolveValue(selection.bottom, state, ctx));
  if ("index" in selection) return 1;
  if ("range" in selection) return Number(resolveValue(selection.range[1], state, ctx)) - Number(resolveValue(selection.range[0], state, ctx)) + 1;
  return 0;
}

function selectionOrder(selection: CardSelection) {
  return "order" in selection ? selection.order : "Preserve";
}

function transfer(state: GenericCardGameState, sourceLabel: string, destinationLabel: string, selection: CardSelection, placement: CardPlacement, ctx: Context) {
  const source = state.zones[sourceLabel];
  const destination = state.zones[destinationLabel];
  const count = selectionCount(selection, state, ctx);
  if (!source || !destination || count < 1 || source.cards.length < count) throw new Error("Illegal transfer");
  let start = source.cards.length - count;
  if ("bottom" in selection) start = 0;
  if ("index" in selection) start = Number(resolveValue(selection.index, state, ctx));
  if ("range" in selection) start = Number(resolveValue(selection.range[0], state, ctx));
  const moving = source.cards.splice(start, count);
  if (selectionOrder(selection) === "Reverse") moving.reverse();
  if (placement === "Bottom") destination.cards.unshift(...moving);
  else if (typeof placement === "object" && "index" in placement) destination.cards.splice(Number(resolveValue(placement.index, state, ctx)), 0, ...moving);
  else destination.cards.push(...moving);
}

function actionCount(rule: GameRule, state: GenericCardGameState, ctx: Context) {
  if (!("zoneTransfer" in rule.action)) return 0;
  return selectionCount(rule.action.zoneTransfer.selection, state, ctx);
}

function ruleMove(rule: GameRule, source: GenericZoneState, destination: GenericZoneState, count: number): LegalMove {
  return {
    id: `zt|${rule.name}|${source.label}|${destination.label}|${count}`,
    type: "zoneTransfer",
    label: `${rule.name}: ${source.label} -> ${destination.label}`,
    payload: { from: source.label, to: destination.label, count, selection: { top: count }, placement: "Top", rule: rule.name }
  };
}

function communicateMove(rule: GameRule, source: number, destination: number, verb: string, value: unknown): LegalMove {
  return {
    id: `cm|${rule.name}|${source}|${destination}|${verb}|${value}`,
    type: "communicate",
    playerId: String(source),
    label: `${verb} ${value} to P${destination}`,
    payload: { source, destination, verb, value, rule: rule.name }
  };
}

function legalZoneTransfers(definition: DeclarativeGameDefinition, state: GenericCardGameState, includeAutomatic = false): LegalMove[] {
  const zones = Object.values(state.zones);
  const moves: LegalMove[] = [];
  for (const rule of definition.rules.filter((rule) => "zoneTransfer" in rule.action && (includeAutomatic || !rule.automatic))) {
    for (const source of zones) {
      for (const destination of zones) {
        if (source.label === destination.label) continue;
        for (let count = 1; count <= source.cards.length; count += 1) {
          const ctx = { source, destination, count, actor: state.actor };
          if (actionCount(rule, state, ctx) === count && evalPredicate(rule.predicate, state, ctx)) moves.push(ruleMove(rule, source, destination, count));
        }
      }
    }
  }
  return moves;
}

function legalCommunications(definition: DeclarativeGameDefinition, state: GenericCardGameState, viewerPlayerId?: string): LegalMove[] {
  const actor = state.actor;
  if (viewerPlayerId && Number(viewerPlayerId) !== actor) return [];
  const ranks = [...new Set(playerHand(state, actor)?.cards.map((card) => card.rank) ?? [])];
  const destinations = definition.players.players.filter((player) => player.id !== 0 && player.id !== actor).map((player) => player.id);
  const moves: LegalMove[] = [];
  for (const rule of definition.rules.filter((rule) => "communicate" in rule.action && !rule.automatic)) {
    if (!("communicate" in rule.action)) continue;
    for (const destination of destinations) {
      for (const value of ranks) {
        const communication = { source: actor, destination, verb: rule.action.communicate.verb, value };
        if (evalPredicate(rule.predicate, state, { communication })) moves.push(communicateMove(rule, actor, destination, communication.verb, value));
      }
    }
  }
  return moves;
}

function runEffects(definition: DeclarativeGameDefinition, state: GenericCardGameState, rule: GameRule, payload: Record<string, unknown>) {
  for (const effect of rule.effects) {
    if (effect.op === "sets.collectBooks") collectBooks(state, Number(effect.args.rankCount ?? 4));
    if (effect.op === "communicate.transferMatchingValueOrDraw") resolveRankRequest(definition, state, payload);
    if (effect.op === "state.evaluateCompletion") evaluateCompletion(definition, state);
  }
}

function runAutomaticRules(definition: DeclarativeGameDefinition, state: GenericCardGameState) {
  let changed = true;
  let guard = 0;
  while (changed && guard < 50) {
    changed = false;
    guard += 1;
    for (const rule of definition.rules.filter((rule) => rule.automatic && "zoneTransfer" in rule.action)) {
      const before = JSON.stringify(Object.fromEntries(Object.entries(state.zones).map(([label, zone]) => [label, zone.cards.map((card) => card.id)])));
      const move = legalZoneTransfers({ ...definition, rules: [rule] }, state, true)[0];
      if (move) applyZoneMove(definition, state, move);
      changed ||= before !== JSON.stringify(Object.fromEntries(Object.entries(state.zones).map(([label, zone]) => [label, zone.cards.map((card) => card.id)])));
    }
  }
}

function collectBooks(state: GenericCardGameState, rankCount: number) {
  for (const hand of Object.values(state.zones).filter((zone) => zone.attributes.type === "Hand")) {
    const player = Number(hand.attributes.player);
    const book = playerZone(state, player, "Book");
    if (!book) continue;
    const ranks = [...new Set(hand.cards.map((card) => card.rank))];
    for (const rank of ranks) {
      const matches = hand.cards.filter((card) => card.rank === rank);
      if (matches.length === rankCount) {
        hand.cards = hand.cards.filter((card) => card.rank !== rank);
        book.cards.push(...matches);
      }
    }
  }
}

function nextActor(definition: DeclarativeGameDefinition, actor: number) {
  const players = definition.players.players.filter((player) => player.id !== 0).map((player) => player.id);
  return players[(players.indexOf(actor) + 1) % players.length] ?? actor;
}

function resolveRankRequest(definition: DeclarativeGameDefinition, state: GenericCardGameState, payload: Record<string, unknown>) {
  const source = Number(payload.source);
  const destination = Number(payload.destination);
  const rank = String(payload.value);
  const sourceHand = playerHand(state, source);
  const destinationHand = playerHand(state, destination);
  if (!sourceHand || !destinationHand) return;
  const matches = destinationHand.cards.filter((card) => card.rank === rank);
  if (matches.length > 0) {
    destinationHand.cards = destinationHand.cards.filter((card) => card.rank !== rank);
    sourceHand.cards.push(...matches);
    state.actor = source;
    return;
  }
  const draw = Object.values(state.zones).find((zone) => zone.attributes.type === "Draw");
  const drawn = draw?.cards.pop();
  if (drawn) sourceHand.cards.push(drawn);
  state.actor = drawn?.rank === rank ? source : nextActor(definition, source);
}

function evaluateCompletion(definition: DeclarativeGameDefinition, state: GenericCardGameState) {
  const completion = definition.stateTypes.Completion?.predicate;
  if (completion && evalPredicate(completion, state, {})) state.stateType = "Completion";
}

function applyZoneMove(definition: DeclarativeGameDefinition, state: GenericCardGameState, move: LegalMove) {
  const payload = move.payload as { from: string; to: string; count: number; rule: string };
  const rule = definition.rules.find((candidate) => candidate.name === payload.rule);
  if (!rule || !("zoneTransfer" in rule.action)) throw new Error("Illegal move");
  const ctx = { source: state.zones[payload.from], destination: state.zones[payload.to], count: payload.count, actor: state.actor };
  transfer(state, payload.from, payload.to, rule.action.zoneTransfer.selection, rule.action.zoneTransfer.placement, ctx);
  runEffects(definition, state, rule, payload);
  runAutomaticRules(definition, state);
  evaluateCompletion(definition, state);
}

function applyCommunicateMove(definition: DeclarativeGameDefinition, state: GenericCardGameState, move: LegalMove) {
  const payload = move.payload as { source: number; destination: number; verb: string; value: unknown; rule: string };
  const rule = definition.rules.find((candidate) => candidate.name === payload.rule);
  if (!rule || !("communicate" in rule.action)) throw new Error("Illegal move");
  if (!evalPredicate(rule.predicate, state, { communication: payload })) throw new Error("Illegal move");
  state.communications.push({ source: payload.source, destination: payload.destination, verb: payload.verb, value: payload.value });
  runEffects(definition, state, rule, payload);
}

function toCompatibilityState(state: GenericCardGameState) {
  const tableauColumns = Object.values(state.zones)
    .filter((zone) => zone.attributes.type === "Tableau" && zone.attributes.visibility === "Public")
    .sort((a, b) => Number(a.attributes.column) - Number(b.attributes.column))
    .map((zone) => zone.cards);
  return {
    ...state,
    stock: Object.values(state.zones).find((zone) => zone.attributes.type === "Draw")?.cards ?? [],
    waste: Object.values(state.zones).find((zone) => zone.attributes.type === "Discard")?.cards ?? [],
    tableau: tableauColumns,
    foundations: Object.fromEntries(Object.values(state.zones).filter((zone) => zone.attributes.type === "Foundation").map((zone) => [String(zone.attributes.suit), zone.cards])),
    hands: Object.fromEntries(Object.values(state.zones).filter((zone) => zone.attributes.type === "Hand").map((zone) => [String(zone.attributes.player), zone.cards])),
    books: Object.fromEntries(Object.values(state.zones).filter((zone) => zone.attributes.type === "Book").map((zone) => [String(zone.attributes.player), [...new Set(zone.cards.map((card) => card.rank))]])),
    currentPlayerId: String(state.actor)
  };
}

function maskState(state: GenericCardGameState, viewerPlayerId?: string) {
  const masked = cloneState(state);
  for (const zone of Object.values(masked.zones)) {
    const visibility = zone.attributes.visibility;
    const owner = zone.attributes.player;
    if (visibility === "Hidden" || (visibility === "Player" && String(owner) !== viewerPlayerId)) {
      zone.cards = zone.cards.map((card) => ({ ...card, rank: "?", suit: "Hidden", color: undefined, value: 0, faceUp: false }));
    }
  }
  return masked;
}

export function createGenericRuntime(definition: DeclarativeGameDefinition): RuntimeGame {
  return {
    id: definition.id,
    minPlayers: definition.players.count,
    maxPlayers: definition.players.count,
    createInitialState(_players: Player[], seed: number) {
      const deck = shuffle(makeDeck(definition), seed);
      const zones: Record<string, GenericZoneState> = Object.fromEntries(definition.zones.map((zone) => [zone.label, { label: zone.label, attributes: zone.attributes, cards: [] }]));
      for (const [label, count] of Object.entries(definition.initialState.zones)) {
        zones[label].cards.push(...deck.splice(deck.length - count, count));
      }
      const state: GenericCardGameState = { kind: "generic-card-game", stateType: "InPlay", variables: definition.initialState.variables, actor: definition.initialState.actor, zones, communications: [] };
      collectBooks(state, 4);
      evaluateCompletion(definition, state);
      return state;
    },
    legalMoves(room, viewerPlayerId) {
      const state = room.state as GenericCardGameState;
      if (state.stateType === "Completion") return [];
      return [...legalZoneTransfers(definition, state), ...legalCommunications(definition, state, viewerPlayerId)];
    },
    applyMove(room, moveId) {
      const state = cloneState(room.state as GenericCardGameState);
      const move = [...legalZoneTransfers(definition, state), ...legalCommunications(definition, state)].find((candidate) => candidate.id === moveId);
      if (!move) throw new Error("Illegal move");
      if (move.type === "zoneTransfer") applyZoneMove(definition, state, move);
      if (move.type === "communicate") applyCommunicateMove(definition, state, move);
      return { ...room, state, status: state.stateType === "Completion" ? "finished" : "active" };
    },
    toView(room, viewerPlayerId) {
      const state = maskState(room.state as GenericCardGameState, viewerPlayerId);
      return {
        id: room.id,
        gameId: room.gameId,
        name: room.name,
        status: room.status,
        players: room.players,
        createdAt: room.createdAt,
        state: toCompatibilityState(state),
        legalMoves: viewerPlayerId ? this.legalMoves(room, viewerPlayerId) : [],
        winnerPlayerIds: room.winnerPlayerIds
      } satisfies RoomView;
    }
  };
}
