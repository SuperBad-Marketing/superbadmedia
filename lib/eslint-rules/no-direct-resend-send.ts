import type { Rule } from "eslint";

/**
 * Bans calls to `resend.emails.send(...)` outside `lib/channels/` (the
 * email adapter). Every send path imports `sendEmail()` so `canSendTo()`
 * cannot be bypassed.
 *
 * Per FOUNDATIONS §11.2 + build-time discipline §14.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow resend.emails.send calls outside lib/channels/.",
    },
    schema: [],
    messages: {
      noDirect:
        "Use sendEmail() from lib/channels/, never resend.emails.send directly. See FOUNDATIONS §11.2.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        const prop = callee.property;
        const obj = callee.object;
        if (
          prop.type === "Identifier" &&
          prop.name === "send" &&
          obj.type === "MemberExpression" &&
          obj.property.type === "Identifier" &&
          obj.property.name === "emails"
        ) {
          context.report({ node, messageId: "noDirect" });
        }
      },
    };
  },
};

export default rule;
