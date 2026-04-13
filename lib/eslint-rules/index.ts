import type { ESLint } from "eslint";
import noDirectAnthropicImport from "./no-direct-anthropic-import";
import noDirectStripeCustomerCreate from "./no-direct-stripe-customer-create";
import noDirectResendSend from "./no-direct-resend-send";

const plugin: ESLint.Plugin = {
  meta: {
    name: "lite",
    version: "0.1.0",
  },
  rules: {
    "no-direct-anthropic-import": noDirectAnthropicImport,
    "no-direct-stripe-customer-create": noDirectStripeCustomerCreate,
    "no-direct-resend-send": noDirectResendSend,
  },
};

export default plugin;
