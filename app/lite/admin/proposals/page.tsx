"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PROPOSAL_TEMPLATES } from "@/lib/proposal-builder/content-shape";
import { createProposalAction, listProposalsAction } from "./actions";
import type { ProposalRow } from "@/lib/db/schema/proposals";

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--color-neutral-500)",
  sent: "var(--color-brand-orange)",
  viewed: "var(--color-brand-pink)",
  accepted: "#7BAE7E",
  withdrawn: "var(--color-neutral-600)",
  expired: "var(--color-neutral-600)",
};

export default function ProposalsPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [isPending, startTransition] = useTransition();

  // New proposal form
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [templateId, setTemplateId] = useState("content_play");

  useEffect(() => {
    listProposalsAction().then((res) => {
      if (res.ok) setProposals(res.proposals);
    });
  }, []);

  function handleCreate() {
    if (!title.trim() || !clientName.trim()) {
      toast.error("Title and client name are required.");
      return;
    }
    startTransition(async () => {
      const res = await createProposalAction({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        clientName: clientName.trim(),
        templateId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.push(`/lite/admin/proposals/${res.proposalId}`);
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">
            Proposals
          </span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Proposals
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Build and send client proposals.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            the pitch that closes.
          </em>
        </p>
      </header>

      <div className="mt-4 px-4">
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg px-5 py-2.5 font-[family-name:var(--font-body)] text-[14px] font-medium"
          style={{
            backgroundColor: "var(--color-brand-red)",
            color: "var(--color-brand-cream)",
          }}
        >
          {showCreate ? "Cancel" : "New proposal"}
        </button>
      </div>

      {showCreate && (
        <div
          className="mx-4 mt-4 rounded-lg p-6"
          style={{
            backgroundColor: "var(--color-neutral-800)",
            border: "1px solid rgba(253,245,230,0.08)",
          }}
        >
          <div className="space-y-4">
            <div>
              <label
                className="mb-1.5 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Template
              </label>
              <div className="flex flex-wrap gap-2">
                {PROPOSAL_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className="rounded-lg px-4 py-2 font-[family-name:var(--font-body)] text-[13px] transition-all"
                    style={{
                      backgroundColor:
                        templateId === t.id
                          ? "var(--color-brand-red)"
                          : "var(--color-neutral-700)",
                      color: "var(--color-brand-cream)",
                      border:
                        templateId === t.id
                          ? "1px solid var(--color-brand-red)"
                          : "1px solid rgba(253,245,230,0.08)",
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                {PROPOSAL_TEMPLATES.find((t) => t.id === templateId)?.description}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  className="mb-1.5 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Proposal title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. The Moto Content Play"
                  className="w-full rounded-lg border px-3 py-2 font-[family-name:var(--font-body)] text-[14px] outline-none"
                  style={{
                    backgroundColor: "var(--color-neutral-900)",
                    color: "var(--color-brand-cream)",
                    borderColor: "rgba(253,245,230,0.08)",
                  }}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Client name
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Protraxx Australia"
                  className="w-full rounded-lg border px-3 py-2 font-[family-name:var(--font-body)] text-[14px] outline-none"
                  style={{
                    backgroundColor: "var(--color-neutral-900)",
                    color: "var(--color-brand-cream)",
                    borderColor: "rgba(253,245,230,0.08)",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                className="mb-1.5 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                Subtitle{" "}
                <span className="normal-case opacity-50">optional</span>
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. A docuseries-driven content ecosystem for Protraxx Australia"
                className="w-full rounded-lg border px-3 py-2 font-[family-name:var(--font-body)] text-[14px] outline-none"
                style={{
                  backgroundColor: "var(--color-neutral-900)",
                  color: "var(--color-brand-cream)",
                  borderColor: "rgba(253,245,230,0.08)",
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending || !title.trim() || !clientName.trim()}
              className="rounded-lg px-5 py-2.5 font-[family-name:var(--font-body)] text-[14px] font-medium transition-opacity"
              style={{
                backgroundColor: "var(--color-brand-red)",
                color: "var(--color-brand-cream)",
                opacity: isPending ? 0.5 : 1,
              }}
            >
              {isPending ? "Creating…" : "Create proposal"}
            </button>
          </div>
        </div>
      )}

      {/* Proposals list */}
      <div className="mt-8 space-y-2 px-4">
        {proposals.length === 0 && (
          <p className="py-8 text-center font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
            No proposals yet. Create your first one above.
          </p>
        )}
        {proposals.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => router.push(`/lite/admin/proposals/${p.id}`)}
            className="flex w-full items-center justify-between rounded-lg px-5 py-4 text-left transition-colors hover:brightness-110"
            style={{
              backgroundColor: "var(--color-neutral-800)",
              border: "1px solid rgba(253,245,230,0.06)",
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="font-[family-name:var(--font-body)] text-[15px] font-medium text-[color:var(--color-brand-cream)]">
                {p.title}
              </div>
              <div className="mt-0.5 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                {p.client_name} · {p.proposal_number}
              </div>
            </div>
            <div className="ml-4 flex items-center gap-3">
              <span
                className="rounded-full px-2.5 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
                style={{
                  letterSpacing: "1px",
                  color: STATUS_COLORS[p.status] ?? "var(--color-neutral-500)",
                  border: `1px solid ${STATUS_COLORS[p.status] ?? "var(--color-neutral-600)"}`,
                }}
              >
                {p.status}
              </span>
              <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                {new Date(p.created_at_ms).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
