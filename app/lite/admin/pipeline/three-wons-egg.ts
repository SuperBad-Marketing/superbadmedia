"use server";

// Migrated to `lib/eggs/admin-triggers/three-wons.ts` in SD-4.
// Now writes to `hidden_egg_fires` table instead of the settings key.
// Re-exported here for backward compat with the old test file.
export { maybeFireThreeWonsEgg } from "@/lib/eggs/admin-triggers/three-wons";
