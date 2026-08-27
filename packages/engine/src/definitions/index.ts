import { gameDefinitionSchema } from "@free-frees/shared";
import type { DeclarativeGameDefinition } from "@free-frees/shared";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function definitionsDirectory() {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "../../definitions");
}

export function loadRawDefinitions(): unknown[] {
  const directory = definitionsDirectory();
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(directory, file), "utf8")) as unknown);
}

export function compileDefinitions(): DeclarativeGameDefinition[] {
  return loadRawDefinitions().map((definition) => gameDefinitionSchema.parse(definition));
}
