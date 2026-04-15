"use client";

import { useState, useTransition } from "react";
import { resendSubscriberLoginAction } from "../actions";

export function ResendLoginClient({ initialEmail }: { initialEmail: string | null }) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "sent" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "idle" });
    startTransition(async () => {
      const result = await resendSubscriberLoginAction({ email });
      if (result.ok) {
        setStatus({ kind: "sent" });
        return;
      }
      const message =
        result.reason === "cooldown"
          ? "Hang on — we just sent one. Check your inbox and try again in a minute."
          : result.reason === "unknown_email"
            ? "That email isn't on a subscription. Use the address you checked out with."
            : result.reason === "invalid"
              ? "That doesn't look like an email address."
              : "Something went wrong sending the email. Try again shortly.";
      setStatus({ kind: "error", message });
    });
  }

  if (status.kind === "sent") {
    return (
      <div
        className="mt-10 rounded-md border border-foreground/10 px-5 py-4 text-sm"
        data-testid="welcome-resend-sent"
      >
        Login link on the way. Check your inbox.
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto mt-10 flex max-w-md flex-col gap-3"
      data-testid="welcome-resend-form"
    >
      <label className="text-foreground/60 text-xs uppercase tracking-[0.2em]">
        Send me my login
      </label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className="border-foreground/15 focus:border-foreground/30 rounded-md border bg-transparent px-3 py-2 text-base outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[#c8312b] px-4 py-2 text-sm font-semibold text-[#fff5e6] disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email me a login link"}
      </button>
      {status.kind === "error" ? (
        <p className="text-foreground/70 text-sm" role="alert">
          {status.message}
        </p>
      ) : null}
    </form>
  );
}
