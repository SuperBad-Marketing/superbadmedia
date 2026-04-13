import type { Rule } from "eslint";

/**
 * Bans calls to `stripe.customers.create(...)` outside `lib/stripe/`.
 * Every Stripe Customer creation must go through `ensureStripeCustomer()`
 * so the SuperBad business-lifecycle / Stripe identity boundary is
 * enforced (FOUNDATIONS §11.7 + §13 glossary).
 */
const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow stripe.customers.create calls outside lib/stripe/.",
    },
    schema: [],
    messages: {
      noDirect:
        "Use ensureStripeCustomer() from lib/stripe/, never stripe.customers.create directly. See FOUNDATIONS §11.7.",
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
          prop.name === "create" &&
          obj.type === "MemberExpression" &&
          obj.property.type === "Identifier" &&
          obj.property.name === "customers"
        ) {
          context.report({ node, messageId: "noDirect" });
        }
      },
    };
  },
};

export default rule;
