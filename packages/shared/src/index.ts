import { z } from "zod";

export const idSchema = z.string().min(1);
export type UserId = string;
export type RoomId = string;
export type PlayerId = string;
export type GameId = string;
export type MoveId = string;
export type CardId = string;
export type ZoneId = string;

export const cardSchema = z.object({
  id: idSchema,
  rank: z.string(),
  suit: z.string(),
  color: z.enum(["red", "black"]).optional(),
  value: z.number().int(),
  faceUp: z.boolean().default(true)
});
export type Card = z.infer<typeof cardSchema>;

export const zoneSchema = z.object({
  id: idSchema,
  ownerId: idSchema.optional(),
  kind: z.enum(["stock", "waste", "tableau", "foundation", "hand", "book", "discard", "custom"]),
  visibility: z.enum(["public", "owner-only", "hidden", "team-only", "derived"]),
  cards: z.array(cardSchema)
});
export type Zone = z.infer<typeof zoneSchema>;

export const legalMoveSchema = z.object({
  id: idSchema,
  type: z.string(),
  label: z.string(),
  playerId: idSchema.optional(),
  payload: z.record(z.unknown())
});
export type LegalMove = z.infer<typeof legalMoveSchema>;

export const playerSchema = z.object({
  id: idSchema,
  userId: idSchema.optional(),
  name: z.string(),
  seat: z.number().int().nonnegative(),
  isBot: z.boolean().default(false)
});
export type Player = z.infer<typeof playerSchema>;

export const gameStatusSchema = z.enum(["waiting", "active", "finished"]);
export type GameStatus = z.infer<typeof gameStatusSchema>;

export const publicRoomSchema = z.object({
  id: idSchema,
  gameId: idSchema,
  name: z.string(),
  status: gameStatusSchema,
  players: z.array(playerSchema),
  createdAt: z.string()
});
export type PublicRoom = z.infer<typeof publicRoomSchema>;

export const roomViewSchema = publicRoomSchema.extend({
  state: z.unknown(),
  legalMoves: z.array(legalMoveSchema),
  winnerPlayerIds: z.array(idSchema).optional()
});
export type RoomView = z.infer<typeof roomViewSchema>;

const primitiveArgSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(primitiveArgSchema), z.record(primitiveArgSchema)])
);

export const gamePrimitiveSchema = z.object({
  op: z.string(),
  args: z.record(primitiveArgSchema).default({})
});
export type GamePrimitive = z.infer<typeof gamePrimitiveSchema>;

export const gameZoneDefinitionSchema = z.object({
  id: idSchema,
  kind: zoneSchema.shape.kind,
  visibility: zoneSchema.shape.visibility,
  owner: z.enum(["none", "player", "seat"]).default("none"),
  count: z.number().int().positive().optional(),
  labels: z.array(z.string()).optional()
});
export type GameZoneDefinition = z.infer<typeof gameZoneDefinitionSchema>;

export const gameDefinitionSchema = z.object({
  id: idSchema,
  version: z.string(),
  name: z.string(),
  description: z.string().optional(),
  minPlayers: z.number().int().positive(),
  maxPlayers: z.number().int().positive(),
  engine: z.object({
    runtime: z.string(),
    languageVersion: z.literal("0.1")
  }),
  deck: z.object({
    type: z.enum(["standard-52", "custom"]),
    includeJokers: z.boolean().default(false),
    ranks: z.array(z.string()).optional(),
    suits: z.array(z.string()).optional(),
    cards: z.array(z.record(primitiveArgSchema)).optional()
  }),
  zones: z.array(gameZoneDefinitionSchema),
  setup: z.array(gamePrimitiveSchema).default([]),
  turn: z.object({
    mode: z.enum(["solitaire", "clockwise", "none"]),
    phases: z.array(
      z.object({
        id: idSchema,
        player: z.enum(["none", "current", "owner"]).default("current"),
        choices: z.array(idSchema).default([]),
        automatic: z.array(gamePrimitiveSchema).default([])
      })
    )
  }),
  actions: z.array(
    z.object({
      id: idSchema,
      label: z.string(),
      input: z.array(z.object({ id: idSchema, kind: z.enum(["card", "zone", "rank", "player", "count"]) })).default([]),
      legal: z.array(gamePrimitiveSchema).default([]),
      effect: z.array(gamePrimitiveSchema).default([])
    })
  ).default([]),
  scoring: z.array(gamePrimitiveSchema).default([]),
  endConditions: z.array(
    z.object({
      id: idSchema,
      when: z.array(gamePrimitiveSchema),
      result: z.array(gamePrimitiveSchema)
    })
  ).default([]),
  bot: z.object({ strategy: z.enum(["none", "random-legal"]) }).default({ strategy: "none" })
});
export type DeclarativeGameDefinition = z.infer<typeof gameDefinitionSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80)
});
export const loginSchema = registerSchema.pick({ email: true, password: true });
export const createRoomSchema = z.object({
  gameId: idSchema,
  name: z.string().min(1).max(100),
  botCount: z.number().int().min(0).max(1).default(0)
});
export const joinRoomSchema = z.object({ roomId: idSchema });
export const submitMoveSchema = z.object({ moveId: idSchema });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
