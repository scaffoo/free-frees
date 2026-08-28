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

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const jsonValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([literalSchema, z.array(jsonValueSchema), z.record(jsonValueSchema)]));

export const predicateSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(predicateSchema) }),
    z.object({ any: z.array(predicateSchema) }),
    z.object({ not: predicateSchema }),
    z.object({ equals: z.tuple([z.string(), jsonValueSchema]) }),
    z.object({ notEquals: z.tuple([z.string(), jsonValueSchema]) }),
    z.object({ greaterThan: z.tuple([z.string(), jsonValueSchema]) }),
    z.object({ greaterThanOrEqual: z.tuple([z.string(), jsonValueSchema]) }),
    z.object({ lessThan: z.tuple([z.string(), jsonValueSchema]) }),
    z.object({ lessThanOrEqual: z.tuple([z.string(), jsonValueSchema]) }),
    z.object({ in: z.tuple([z.string(), z.union([z.string(), z.array(jsonValueSchema)])]) })
  ])
);
export type Predicate = z.infer<typeof predicateSchema>;

export const gameCardValueSchema = z.object({
  name: z.string(),
  value: z.number().int(),
  rank: z.number().int()
});

export const gameZoneDefinitionSchema = z.object({
  label: idSchema,
  attributes: z.record(jsonValueSchema).default({})
});
export type GameZoneDefinition = z.infer<typeof gameZoneDefinitionSchema>;

export const cardSelectionSchema = z.union([
  z.object({ top: z.union([z.number().int().positive(), z.string()]), order: z.enum(["Preserve", "Reverse"]).default("Preserve") }),
  z.object({ bottom: z.union([z.number().int().positive(), z.string()]), order: z.enum(["Preserve", "Reverse"]).default("Preserve") }),
  z.object({ index: z.union([z.number().int().nonnegative(), z.string()]) }),
  z.object({ range: z.tuple([z.union([z.number().int().nonnegative(), z.string()]), z.union([z.number().int().nonnegative(), z.string()])]) })
]);
export type CardSelection = z.infer<typeof cardSelectionSchema>;

export const cardPlacementSchema = z.union([
  z.literal("Top"),
  z.literal("Bottom"),
  z.object({ index: z.union([z.number().int().nonnegative(), z.string()]) })
]);
export type CardPlacement = z.infer<typeof cardPlacementSchema>;

export const zoneTransferActionSchema = z.object({
  source: z.string(),
  destination: z.string(),
  selection: cardSelectionSchema,
  placement: cardPlacementSchema.default("Top")
});

export const communicateActionSchema = z.object({
  source: z.union([z.number().int(), z.string()]),
  destination: z.union([z.number().int(), z.string()]),
  verb: z.string(),
  value: z.union([z.string(), z.number().int(), z.null()]).optional()
});

export const ruleEffectSchema = z.object({
  op: z.string(),
  args: z.record(jsonValueSchema).default({})
});
export type RuleEffect = z.infer<typeof ruleEffectSchema>;

export const gameRuleSchema = z.object({
  name: idSchema,
  automatic: z.boolean().default(false),
  predicate: predicateSchema,
  action: z.union([
    z.object({ zoneTransfer: zoneTransferActionSchema }),
    z.object({ communicate: communicateActionSchema })
  ]),
  effects: z.array(ruleEffectSchema).default([])
});
export type GameRule = z.infer<typeof gameRuleSchema>;

export const gameDefinitionSchema = z.object({
  id: idSchema,
  version: z.string(),
  name: z.string(),
  description: z.string().optional(),
  engine: z.object({ runtime: z.literal("genericCardGame"), languageVersion: z.literal("0.2") }),
  players: z.object({
    count: z.number().int().positive(),
    players: z.array(z.object({ id: z.number().int().nonnegative(), type: z.enum(["Human", "Bot", "Null"]) }))
  }),
  cards: z.object({
    count: z.number().int().positive(),
    decks: z.number().int().positive(),
    suits: z.array(z.string()),
    values: z.array(gameCardValueSchema)
  }),
  zones: z.array(gameZoneDefinitionSchema),
  initialState: z.object({
    stateType: z.string(),
    variables: z.record(jsonValueSchema).default({}),
    actor: z.number().int().nonnegative(),
    zones: z.record(z.number().int().nonnegative()),
    distribution: z.object({ random: z.boolean().default(true) }).default({ random: true })
  }),
  stateTypes: z.record(z.object({ predicate: predicateSchema.optional() })).default({}),
  rules: z.array(gameRuleSchema),
  turn: z.object({ actor: z.union([z.number().int().nonnegative(), z.string()]), minimumActions: z.number().int().nonnegative(), maximumActions: z.number().int().positive().nullable() }),
  ruleEvaluation: z.object({ default: z.literal("Deny"), applicableRules: z.literal("Derived") }),
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
