import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("PM-1 Display Settings", () => {
  const root = join(__dirname, "..");

  it("page, client component, and actions files exist", () => {
    const dir = "app/lite/admin/settings/display";
    expect(existsSync(join(root, dir, "page.tsx"))).toBe(true);
    expect(existsSync(join(root, dir, "display-settings.tsx"))).toBe(true);
    expect(existsSync(join(root, dir, "actions.ts"))).toBe(true);
  });

  it("design-tokens preference enums are consistent with user schema enums", async () => {
    const tokens = await import("@/lib/design-tokens");

    expect(tokens.MOTION_PREFERENCES).toEqual(["full", "reduced", "off"]);
    expect(tokens.DENSITY_PREFERENCES).toEqual(["comfort", "compact"]);
    expect(tokens.TEXT_SIZE_PREFERENCES).toEqual(["standard", "large"]);
    expect(tokens.THEME_PRESETS).toEqual([
      "standard",
      "late-shift",
      "quiet-hours",
    ]);
    expect(tokens.TYPEFACE_PRESETS).toEqual([
      "house",
      "long-read",
      "dispatch",
    ]);
  });

  it("user schema density enum matches design-tokens", async () => {
    const { user } = await import("@/lib/db/schema/user");
    const col = user.density_preference;
    expect(col.enumValues).toEqual(["comfort", "compact"]);
  });

  it("user schema text_size enum matches design-tokens", async () => {
    const { user } = await import("@/lib/db/schema/user");
    const col = user.text_size_preference;
    expect(col.enumValues).toEqual(["standard", "large"]);
  });

  it("user schema theme_preset default is 'standard'", async () => {
    const { user } = await import("@/lib/db/schema/user");
    expect(user.theme_preset.default).toBe("standard");
  });

  it("user schema typeface_preset default is 'house'", async () => {
    const { user } = await import("@/lib/db/schema/user");
    expect(user.typeface_preset.default).toBe("house");
  });
});
