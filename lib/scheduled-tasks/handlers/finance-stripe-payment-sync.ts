import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { syncStripePayments } from "@/lib/finance/stripe-payment-sync";

const handleFinanceStripePaymentSync: TaskHandler = async (_task) => {
  await syncStripePayments();
};

export const FINANCE_STRIPE_PAYMENT_SYNC_HANDLERS: HandlerMap = {
  finance_stripe_payment_sync: handleFinanceStripePaymentSync,
};
