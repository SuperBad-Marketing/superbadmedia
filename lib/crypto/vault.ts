/**
 * Credential vault — AES-256-GCM symmetric encryption.
 *
 * All feature code that needs to store a sensitive secret (API key, token,
 * credential) must encrypt it through this module. No feature code may import
 * raw Node.js cipher methods directly — enforced by the `no-direct-crypto`
 * ESLint rule.
 *
 * Key management:
 *   - Key is 32 bytes, hex-encoded in `CREDENTIAL_VAULT_KEY` env var.
 *   - Generate with: `openssl rand -hex 32`
 *   - Key rotation: re-encrypt existing secrets with the new key, then update
 *     the env var. Procedure documented in INCIDENT_PLAYBOOK.md §"Vault key
 *     rotation".
 *
 * Wire format (base64-encoded): IV(12) || TAG(16) || CIPHERTEXT(n)
 *
 * Per BUILD_PLAN.md Wave 2 B2 + FOUNDATIONS.md §11 credential-vault primitive.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const IV_LENGTH = 12; // GCM standard nonce length
const TAG_LENGTH = 16; // GCM authentication tag length (default)

function getKey(): Buffer {
  const raw = process.env.CREDENTIAL_VAULT_KEY;
  if (!raw || raw.trim() === "") {
    throw new Error(
      "CREDENTIAL_VAULT_KEY env var is not set. Generate with: openssl rand -hex 32",
    );
  }
  const buf = Buffer.from(raw.trim(), "hex");
  if (buf.length !== 32) {
    throw new Error(
      `CREDENTIAL_VAULT_KEY must be exactly 32 bytes (64 hex chars). Got ${buf.length} bytes.`,
    );
  }
  return buf;
}

export const vault = {
  /**
   * Encrypt a plaintext string.
   *
   * @param plaintext - The secret to encrypt.
   * @param context   - A non-secret scope string (e.g. "stripe.api_key",
   *                    "ghl.access_token"). Used as AAD — ciphertexts are
   *                    not interchangeable across different contexts.
   * @returns Base64-encoded IV || TAG || CIPHERTEXT.
   */
  encrypt(plaintext: string, context: string): string {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(context, "utf8"));
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
  },

  /**
   * Decrypt a vault ciphertext.
   *
   * @param ciphertext - Base64-encoded output from `vault.encrypt()`.
   * @param context    - Must match the context string used during encryption.
   * @throws If the key is missing/wrong size, the context doesn't match,
   *         or the ciphertext has been tampered with (GCM auth tag failure).
   */
  decrypt(ciphertext: string, context: string): string {
    const key = getKey();
    const data = Buffer.from(ciphertext, "base64");
    if (data.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error("vault.decrypt: ciphertext is too short to be valid");
    }
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    decipher.setAAD(Buffer.from(context, "utf8"));
    return (
      decipher.update(encrypted).toString("utf8") + decipher.final("utf8")
    );
  },
};
