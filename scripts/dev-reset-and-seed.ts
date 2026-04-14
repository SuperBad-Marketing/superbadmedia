/**
 * Dev-only: rebuilds dev.db from scratch (migrations + seeds) then runs
 * the pipeline seed. Run via:
 *   NODE_OPTIONS='-r ./scripts/shim-server-only.cjs' npx tsx scripts/dev-reset-and-seed.ts
 */
import fs from "node:fs";
import { runMigrations } from "../lib/db/migrate";

const DB = "./dev.db";
for (const ext of ["", "-wal", "-shm"]) {
  const p = `${DB}${ext}`;
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
runMigrations(`file:${DB}`);
console.log("migrations applied");

// Must import AFTER migrations so the lib/db singleton opens the fresh
// file with tables present.
import("./seed-pipeline").catch((err) => {
  console.error(err);
  process.exit(1);
});
