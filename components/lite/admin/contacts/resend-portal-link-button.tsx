"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { useToastWithSound } from "@/components/lite/toast-with-sound";
import { resendPortalLinkAction } from "@/app/lite/admin/contacts/[id]/actions";

export function ResendPortalLinkButton({
  contactId,
  companyId,
  hasEmail,
}: {
  contactId: string;
  companyId: string;
  hasEmail: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const toast = useToastWithSound();

  function handleClick() {
    if (!hasEmail) {
      toast.error("No email on file — can't send a portal link.");
      return;
    }
    startTransition(async () => {
      const result = await resendPortalLinkAction(contactId, companyId);
      if (result.ok) {
        toast("Portal link sent.", { sound: "kanban-drop" });
      } else {
        toast.error(result.reason);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || !hasEmail}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-neutral-600)] bg-transparent px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-300)] transition-colors hover:border-[color:var(--color-brand-pink)] hover:text-[color:var(--color-brand-pink)] disabled:opacity-40 disabled:pointer-events-none"
    >
      <Send size={12} strokeWidth={1.5} aria-hidden />
      {pending ? "Sending…" : "Send portal link"}
    </button>
  );
}
