import { PrismaClient } from "@prisma/client";
import { compileDefinitions, createRoom as createEngineRoom, submitMove, toRoomView, chooseRandomBotMove } from "@free-frees/engine";
import type { EngineRoom } from "@free-frees/engine";
import type { Player, RoomView } from "@free-frees/shared";
import { nanoid } from "nanoid";

export const prisma = new PrismaClient();

const memoryRooms = new Map<string, EngineRoom>();

export async function seedGameDefinitions() {
  for (const definition of compileDefinitions()) {
    await prisma.gameDefinition.upsert({
      where: { id: definition.id },
      update: { version: definition.version, name: definition.name, document: JSON.stringify(definition) },
      create: { id: definition.id, version: definition.version, name: definition.name, document: JSON.stringify(definition) }
    });
  }
}

export async function listDefinitions() {
  return compileDefinitions();
}

export async function listRooms() {
  return [...memoryRooms.values()].map((room) => toRoomView(room));
}

export async function getRoom(roomId: string, viewerPlayerId?: string): Promise<RoomView> {
  const room = memoryRooms.get(roomId);
  if (!room) throw new Error("Room not found");
  return toRoomView(room, viewerPlayerId);
}

export async function createRoom(input: { gameId: "klondike-draw-3" | "go-fish-2p"; name: string; ownerUserId: string; ownerName: string; botCount: number }) {
  const players: Player[] = [{ id: nanoid(), userId: input.ownerUserId, name: input.ownerName, seat: 0, isBot: false }];
  for (let i = 0; i < input.botCount; i += 1) players.push({ id: nanoid(), name: `Bot ${i + 1}`, seat: players.length, isBot: true });
  const room = createEngineRoom({ gameId: input.gameId, name: input.name, players });
  memoryRooms.set(room.id, room);
  await prisma.room.create({
    data: {
      id: room.id,
      gameId: room.gameId,
      name: room.name,
      status: room.status,
      seed: room.seed,
      snapshot: { create: { state: JSON.stringify(room) } },
      players: { create: players.map((player) => ({ playerId: player.id, userId: player.userId, name: player.name, seat: player.seat, isBot: player.isBot })) }
    }
  });
  return toRoomView(room, players[0].id);
}

export async function joinRoom(roomId: string, user: { id: string; name: string }) {
  const room = memoryRooms.get(roomId);
  if (!room) throw new Error("Room not found");
  if (room.players.some((player) => player.userId === user.id)) return toRoomView(room, room.players.find((player) => player.userId === user.id)?.id);
  if (room.players.length >= 2) throw new Error("Room is full");
  const player: Player = { id: nanoid(), userId: user.id, name: user.name, seat: room.players.length, isBot: false };
  const next = createEngineRoom({ gameId: room.gameId, name: room.name, players: [...room.players, player], seed: room.seed });
  next.id = room.id;
  next.createdAt = room.createdAt;
  memoryRooms.set(room.id, next);
  await prisma.roomPlayer.create({ data: { roomId, playerId: player.id, userId: user.id, name: user.name, seat: player.seat, isBot: false } });
  await persistRoom(next);
  return toRoomView(next, player.id);
}

export async function leaveRoom(roomId: string, userId: string) {
  const room = memoryRooms.get(roomId);
  if (!room) throw new Error("Room not found");
  const next = { ...room, players: room.players.filter((player) => player.userId !== userId), status: "waiting" as const };
  memoryRooms.set(roomId, next);
  await persistRoom(next);
  return toRoomView(next);
}

export async function submitRoomMove(roomId: string, moveId: string, userId: string) {
  const startedAt = performance.now();
  const room = memoryRooms.get(roomId);
  if (!room) throw new Error("Room not found");
  const actor = room.players.find((player) => player.userId === userId);
  if (!actor) throw new Error("Not seated in room");
  let next = submitMove(room, moveId, actor.id);
  let bot = next.players.find((player) => player.isBot && next.state.kind === "go-fish" && next.state.currentPlayerId === player.id);
  while (bot && next.status === "active") {
    const botMove = chooseRandomBotMove(next, bot.id);
    if (!botMove) break;
    next = submitMove(next, botMove.id, bot.id);
    bot = next.players.find((player) => player.isBot && next.state.kind === "go-fish" && next.state.currentPlayerId === player.id);
  }
  memoryRooms.set(roomId, next);
  void persistRoom(next).catch((error) => {
    console.error({ error, roomId, moveId }, "Failed to persist room after move");
  });
  const view = toRoomView(next, actor.id);
  const elapsedMs = Math.round(performance.now() - startedAt);
  if (elapsedMs > 100) console.warn({ roomId, moveId, elapsedMs }, "Slow move application");
  return view;
}

async function persistRoom(room: EngineRoom) {
  await prisma.room.update({ where: { id: room.id }, data: { status: room.status, snapshot: { upsert: { create: { state: JSON.stringify(room) }, update: { state: JSON.stringify(room), revision: { increment: 1 } } } } } });
  const existing = await prisma.gameEvent.findMany({ where: { roomId: room.id }, select: { id: true } });
  const seen = new Set(existing.map((event) => event.id));
  for (const event of room.events.filter((event) => !seen.has(event.id))) {
    await prisma.gameEvent.create({ data: { id: event.id, roomId: room.id, playerId: event.playerId, type: event.type, payload: JSON.stringify(event.payload), createdAt: event.createdAt } });
  }
}
