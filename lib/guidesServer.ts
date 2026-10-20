// Server loader for the pre-built guides: read straight from disk, remembered for the process.
// Imported only by API routes, so `fs` never ends up in the browser bundle.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Guide, GuideLoader } from "./guides";

const loaded = new Map<string, Promise<Guide | undefined>>();

export const readGuide: GuideLoader = (code) => {
  const key = code.toUpperCase().replace(/[^A-Z]/g, "");
  if (!loaded.has(key)) {
    loaded.set(key, readFile(path.join(process.cwd(), "public", "guides", `${key}.json`), "utf8")
      .then((s) => JSON.parse(s) as Guide)
      // Don't remember a miss: guides built later should be picked up without a restart.
      .catch(() => { loaded.delete(key); return undefined; }));
  }
  return loaded.get(key)!;
};
