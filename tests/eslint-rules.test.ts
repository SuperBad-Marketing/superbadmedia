import { describe, it } from "vitest";
import { RuleTester } from "eslint";
import noDirectAnthropicImport from "@/lib/eslint-rules/no-direct-anthropic-import";
import noDirectStripeCustomerCreate from "@/lib/eslint-rules/no-direct-stripe-customer-create";
import noDirectResendSend from "@/lib/eslint-rules/no-direct-resend-send";

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

describe("lite/no-direct-anthropic-import", () => {
  it("passes RuleTester cases", () => {
    tester.run("no-direct-anthropic-import", noDirectAnthropicImport, {
      valid: [
        { code: "import { runJob } from '@/lib/ai/registry';" },
        { code: "import { something } from 'next';" },
      ],
      invalid: [
        {
          code: "import Anthropic from '@anthropic-ai/sdk';",
          errors: [{ messageId: "noDirect" }],
        },
        {
          code: "import { foo } from '@anthropic-ai/sdk/bar';",
          errors: [{ messageId: "noDirect" }],
        },
      ],
    });
  });
});

describe("lite/no-direct-stripe-customer-create", () => {
  it("passes RuleTester cases", () => {
    tester.run(
      "no-direct-stripe-customer-create",
      noDirectStripeCustomerCreate,
      {
        valid: [
          { code: "const c = await ensureStripeCustomer(contactId);" },
          { code: "stripe.subscriptions.create({ customer });" },
        ],
        invalid: [
          {
            code: "await stripe.customers.create({ email });",
            errors: [{ messageId: "noDirect" }],
          },
          {
            code: "stripeClient.customers.create({ email: 'x@y.z' });",
            errors: [{ messageId: "noDirect" }],
          },
        ],
      },
    );
  });
});

describe("lite/no-direct-resend-send", () => {
  it("passes RuleTester cases", () => {
    tester.run("no-direct-resend-send", noDirectResendSend, {
      valid: [
        { code: "await sendEmail({ to, subject, body });" },
        { code: "resend.domains.list();" },
      ],
      invalid: [
        {
          code: "await resend.emails.send({ to: 'a@b.c' });",
          errors: [{ messageId: "noDirect" }],
        },
        {
          code: "client.emails.send({ to });",
          errors: [{ messageId: "noDirect" }],
        },
      ],
    });
  });
});
