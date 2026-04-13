import type { Rule } from "eslint";

/**
 * Bans direct imports of `@anthropic-ai/sdk` outside the LLM model
 * registry (`lib/ai/`). Every Anthropic call must route through the
 * registered-job helper so the model choice lives in one place.
 *
 * Per FOUNDATIONS §11.6 + memory `project_llm_model_registry`.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct imports of @anthropic-ai/sdk outside lib/ai/.",
    },
    schema: [],
    messages: {
      noDirect:
        "Import Anthropic via the LLM model registry (lib/ai/), never directly. See FOUNDATIONS §11.6.",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== "string") return;
        if (
          source === "@anthropic-ai/sdk" ||
          source.startsWith("@anthropic-ai/sdk/")
        ) {
          context.report({ node, messageId: "noDirect" });
        }
      },
    };
  },
};

export default rule;
