import type { Rule } from "eslint";

/**
 * Bans raw Node.js cipher calls (`createCipheriv`, `createDecipheriv`) and
 * Web Crypto cipher calls (`subtle.encrypt`, `subtle.decrypt`) outside the
 * credential vault (`lib/crypto/vault.ts`).
 *
 * All encryption must go through `vault.encrypt / vault.decrypt` from
 * `lib/crypto`. `crypto.randomUUID()`, `createHash()`, and similar
 * non-cipher uses are allowed.
 *
 * Per BUILD_PLAN.md Wave 2 B2 — credential vault primitive.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow raw crypto cipher calls outside lib/crypto/vault.ts. Use vault.encrypt/decrypt instead.",
    },
    schema: [],
    messages: {
      noDirect:
        "Use vault.encrypt/decrypt from @/lib/crypto instead of raw Node.js / Web Crypto cipher calls. See FOUNDATIONS §11 and BUILD_PLAN B2.",
    },
  },
  create(context) {
    const FORBIDDEN_NODE = new Set(["createCipheriv", "createDecipheriv"]);
    const FORBIDDEN_SUBTLE = new Set(["encrypt", "decrypt"]);

    return {
      CallExpression(node) {
        const callee = node.callee;

        // Direct call: createCipheriv(...) or createDecipheriv(...)
        if (
          callee.type === "Identifier" &&
          FORBIDDEN_NODE.has(callee.name)
        ) {
          context.report({ node, messageId: "noDirect" });
          return;
        }

        if (callee.type !== "MemberExpression" || callee.computed) return;
        if (callee.property.type !== "Identifier") return;

        const propName = callee.property.name;

        // Member call: crypto.createCipheriv(...) or anything.createCipheriv(...)
        if (FORBIDDEN_NODE.has(propName)) {
          context.report({ node, messageId: "noDirect" });
          return;
        }

        // Subtle call: subtle.encrypt(...) or subtle.decrypt(...)
        // Catches crypto.subtle.encrypt / webcrypto.subtle.encrypt etc.
        if (
          FORBIDDEN_SUBTLE.has(propName) &&
          callee.object.type === "MemberExpression" &&
          !callee.object.computed &&
          callee.object.property.type === "Identifier" &&
          callee.object.property.name === "subtle"
        ) {
          context.report({ node, messageId: "noDirect" });
        }
      },
    };
  },
};

export default rule;
