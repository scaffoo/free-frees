import Fastify from "fastify";
import type { FastifyReply } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { Server } from "socket.io";
import argon2 from "argon2";
import { loginSchema, registerSchema, createRoomSchema, joinRoomSchema, submitMoveSchema } from "@free-frees/shared";
import { prisma, seedGameDefinitions, listDefinitions, listRooms, createRoom, getRoom, joinRoom, leaveRoom, submitRoomMove } from "./store.js";

const port = Number(process.env.PORT ?? 3000);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const sessionSecret = process.env.SESSION_SECRET ?? "dev-secret-change-me";
const app = Fastify({ logger: { transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" } } });

await app.register(cors, { origin: webOrigin, credentials: true });
await app.register(helmet);
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
await app.register(cookie, { secret: sessionSecret });

app.addHook("onRequest", async (request) => {
  request.startTime = performance.now();
});

app.addHook("onSend", async (request, reply, payload) => {
  const elapsedMs = Math.round(performance.now() - (request.startTime ?? performance.now()));
  reply.header("Server-Timing", `app;dur=${elapsedMs}`);
  if (elapsedMs > 500) request.log.warn({ elapsedMs, method: request.method, url: request.url }, "Slow request");
  return payload;
});

const io = new Server(app.server, { cors: { origin: webOrigin, credentials: true } });
io.on("connection", (socket) => {
  socket.on("room:join", (roomId: string) => socket.join(roomId));
  socket.on("room:leave", (roomId: string) => socket.leave(roomId));
});

async function currentUser(request: { cookies: Record<string, string | undefined> }) {
  const sessionId = request.cookies.sessionId;
  if (!sessionId) return null;
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

async function requireUser(request: { cookies: Record<string, string | undefined> }) {
  const user = await currentUser(request);
  if (!user) throw new Error("Unauthorized");
  return user;
}

function setSessionCookie(reply: FastifyReply, sessionId: string) {
  reply.setCookie("sessionId", sessionId, { path: "/", httpOnly: true, sameSite: "lax", signed: false, secure: process.env.NODE_ENV === "production" });
}

app.post("/auth/register", async (request, reply) => {
  const input = registerSchema.parse(request.body);
  const user = await prisma.user.create({ data: { email: input.email.toLowerCase(), name: input.name, passwordHash: await argon2.hash(input.password) } });
  const session = await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) } });
  setSessionCookie(reply, session.id);
  return { user: { id: user.id, email: user.email, name: user.name } };
});

app.post("/auth/login", async (request, reply) => {
  const input = loginSchema.parse(request.body);
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || !(await argon2.verify(user.passwordHash, input.password))) return reply.code(401).send({ error: "Invalid email or password" });
  const session = await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) } });
  setSessionCookie(reply, session.id);
  return { user: { id: user.id, email: user.email, name: user.name } };
});

app.post("/auth/logout", async (request, reply) => {
  if (request.cookies.sessionId) await prisma.session.deleteMany({ where: { id: request.cookies.sessionId } });
  reply.clearCookie("sessionId", { path: "/" });
  return { ok: true };
});

app.get("/auth/me", async (request) => {
  const user = await currentUser(request);
  return { user: user ? { id: user.id, email: user.email, name: user.name } : null };
});

app.get("/games", async () => ({ games: await listDefinitions() }));
app.get("/rooms", async () => ({ rooms: await listRooms() }));

app.post("/rooms", async (request) => {
  const user = await requireUser(request);
  const input = createRoomSchema.parse(request.body);
  const room = await createRoom({ gameId: input.gameId, name: input.name, ownerUserId: user.id, ownerName: user.name, botCount: input.botCount });
  io.to(room.id).emit("room:update", room);
  return { room };
});

app.post("/rooms/join", async (request) => {
  const user = await requireUser(request);
  const input = joinRoomSchema.parse(request.body);
  const room = await joinRoom(input.roomId, user);
  io.to(room.id).emit("room:update", room);
  return { room };
});

app.post("/rooms/:roomId/leave", async (request) => {
  const user = await requireUser(request);
  const room = await leaveRoom((request.params as { roomId: string }).roomId, user.id);
  io.to(room.id).emit("room:update", room);
  return { room };
});

app.get("/rooms/:roomId", async (request) => {
  const user = await requireUser(request);
  const room = await getRoom((request.params as { roomId: string }).roomId, user.id);
  return { room };
});

app.post("/rooms/:roomId/moves", async (request) => {
  const user = await requireUser(request);
  const input = submitMoveSchema.parse(request.body);
  const room = await submitRoomMove((request.params as { roomId: string }).roomId, input.moveId, user.id);
  io.to(room.id).emit("room:update", room);
  return { room };
});

await seedGameDefinitions();
await app.listen({ port, host: "0.0.0.0" });
