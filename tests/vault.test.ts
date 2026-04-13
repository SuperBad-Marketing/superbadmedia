/**
 * Credential vault tests — B2.
 *
 * Verifies:
 *   - Round-trip: encrypt → decrypt returns original plaintext.
 *   - Different contexts produce different ciphertexts (AAD enforcement).
 *   - Tampered ciphertext throws (GCM auth tag failure).
 *   - Missing / wrong-length CREDENTIAL_VAULT_KEY throws.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// ── Provide a test key (64 hex chars = 32 bytes) before importing vault ──────
const TEST_KEY = "a".repeat(64); // 0xaaaa...aa × 32 bytes

const originalKey = process.env.CREDENTIAL_VAULT_KEY;

beforeAll(() => {
  process.env.CREDENTIAL_VAULT_KEY = TEST_KEY;
});

afterAll(() => {
  if (originalKey === undefined) {
    delete process.env.CREDENTIAL_VAULT_KEY;
  } else {
    process.env.CREDENTIAL_VAULT_KEY = originalKey;
  }
});

// Imported after env is set (vitest runs modules fresh per test file).
const { vault } = await import("@/lib/crypto/vault");

describe("vault.encrypt / vault.decrypt", () => {
  it("round-trips a simple string", () => {
    const plaintext = "super-secret-api-key";
    const context = "stripe.api_key";
    const ciphertext = vault.encrypt(plaintext, context);
    const decrypted = vault.decrypt(ciphertext, context);
    expect(decrypted).toBe(plaintext);
  });

  it("round-trips an empty string", () => {
    const ciphertext = vault.encrypt("", "empty.context");
    expect(vault.decrypt(ciphertext, "empty.context")).toBe("");
  });

  it("round-trips a long unicode string", () => {
    const plaintext = "🔑 Käse mit Ñoño 中文 テスト ".repeat(100);
    const context = "unicode.test";
    const ciphertext = vault.encrypt(plaintext, context);
    expect(vault.decrypt(ciphertext, context)).toBe(plaintext);
  });

  it("produces a different ciphertext on each call (random IV)", () => {
    const plaintext = "same-input";
    const context = "idempotent.test";
    const c1 = vault.encrypt(plaintext, context);
    const c2 = vault.encrypt(plaintext, context);
    expect(c1).not.toBe(c2);
    // Both decrypt to the same value.
    expect(vault.decrypt(c1, context)).toBe(plaintext);
    expect(vault.decrypt(c2, context)).toBe(plaintext);
  });

  it("different contexts produce different ciphertexts (AAD enforcement)", () => {
    const plaintext = "shared-secret";
    const c1 = vault.encrypt(plaintext, "context.alpha");
    const c2 = vault.encrypt(plaintext, "context.beta");
    // Ciphertexts differ because AAD is mixed into GCM tag calculation.
    expect(c1).not.toBe(c2);
    // Each decrypts only with its own context.
    expect(vault.decrypt(c1, "context.alpha")).toBe(plaintext);
    expect(vault.decrypt(c2, "context.beta")).toBe(plaintext);
  });

  it("throws when decrypting with a wrong context (GCM auth tag mismatch)", () => {
    const ciphertext = vault.encrypt("my-secret", "correct.context");
    expect(() => vault.decrypt(ciphertext, "wrong.context")).toThrow();
  });

  it("throws when ciphertext bytes are tampered", () => {
    const ciphertext = vault.encrypt("tamper-me", "tamper.context");
    // Flip a byte in the auth tag region (bytes 12–27 in raw; after base64 decoding).
    const raw = Buffer.from(ciphertext, "base64");
    raw[16] ^= 0xff; // flip a byte in the GCM tag
    const tampered = raw.toString("base64");
    expect(() => vault.decrypt(tampered, "tamper.context")).toThrow();
  });

  it("throws when ciphertext is too short", () => {
    // Less than 12 (IV) + 16 (TAG) = 28 bytes minimum.
    const tiny = Buffer.alloc(10).toString("base64");
    expect(() => vault.decrypt(tiny, "any.context")).toThrow();
  });
});

describe("vault key validation", () => {
  it("throws when CREDENTIAL_VAULT_KEY is not set", () => {
    const saved = process.env.CREDENTIAL_VAULT_KEY;
    delete process.env.CREDENTIAL_VAULT_KEY;
    try {
      expect(() => vault.encrypt("x", "ctx")).toThrow(/CREDENTIAL_VAULT_KEY/);
    } finally {
      process.env.CREDENTIAL_VAULT_KEY = saved;
    }
  });

  it("throws when CREDENTIAL_VAULT_KEY is wrong length", () => {
    const saved = process.env.CREDENTIAL_VAULT_KEY;
    process.env.CREDENTIAL_VAULT_KEY = "deadbeef"; // only 4 bytes
    try {
      expect(() => vault.encrypt("x", "ctx")).toThrow(/32 bytes/);
    } finally {
      process.env.CREDENTIAL_VAULT_KEY = saved;
    }
  });
});
