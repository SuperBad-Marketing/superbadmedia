"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  resetBrandDnaAction,
  resetClientContextAction,
  deleteCompanyAction,
  type CompanyListItem,
} from "./actions";

interface Props {
  companies: { id: string; name: string }[];
  companiesWithStats: CompanyListItem[];
}

export function DataManagementClient({ companies, companiesWithStats }: Props) {
  return (
    <div className="space-y-6 px-4 pb-12">
      <CompanyDatabaseSection initialCompanies={companiesWithStats} />

      <ResetSection
        title="Brand DNA"
        description="Clear all Brand DNA profiles, answers, blends, and invites for clients. This does not affect your own SuperBad self-assessment."
        companies={companies}
        onReset={async (scope, companyId) => {
          const result = await resetBrandDnaAction(
            scope === "all" ? "all_clients" : "company",
            companyId,
          );
          return result;
        }}
      />

      <ResetSection
        title="Client Context"
        description="Clear context summaries and portal chat history. Removes the AI's accumulated memory of past interactions so it starts fresh."
        companies={companies}
        onReset={async (scope, companyId) => {
          const result = await resetClientContextAction(scope, companyId);
          return result;
        }}
      />
    </div>
  );
}

function CompanyDatabaseSection({
  initialCompanies,
}: {
  initialCompanies: CompanyListItem[];
}) {
  const [items, setItems] = useState(initialCompanies);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete(companyId: string) {
    startTransition(async () => {
      const result = await deleteCompanyAction(companyId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setItems((prev) => prev.filter((c) => c.id !== companyId));
      setConfirmingId(null);
      toast.success(`Deleted ${result.name} and all related data.`);
    });
  }

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: "var(--color-neutral-900)",
        borderColor: "rgba(253, 245, 230, 0.06)",
      }}
    >
      <h3 className="font-[family-name:var(--font-body)] text-[15px] font-medium text-[color:var(--color-brand-cream)]">
        Company Database
      </h3>
      <p className="mt-1.5 max-w-lg font-[family-name:var(--font-body)] text-[13px] leading-[1.5] text-[color:var(--color-neutral-500)]">
        Every company in the system. Deleting removes the company and all
        linked data (contacts, deals, content, Brand DNA, invoices).
      </p>

      {items.length === 0 ? (
        <p className="mt-4 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-600)]">
          No companies in the database.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {items.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 rounded-lg px-4 py-3"
              style={{
                backgroundColor: "var(--color-neutral-800)",
                border: "1px solid rgba(253, 245, 230, 0.04)",
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
                    {c.name}
                  </span>
                  {c.hasContentEngine && (
                    <span
                      className="rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
                      style={{
                        backgroundColor: "rgba(253, 245, 230, 0.06)",
                        color: "var(--color-semantic-success)",
                        letterSpacing: "1px",
                      }}
                    >
                      Content Engine
                    </span>
                  )}
                </div>
                <div className="mt-1 flex gap-3 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                  {c.domain && <span>{c.domain}</span>}
                  <span>{c.contactCount} contacts</span>
                  <span>{c.dealCount} deals</span>
                  <span>{c.postCount} posts</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {confirmingId === c.id ? (
                  <>
                    <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-brand-red)]">
                      Gone forever.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      disabled={pending}
                      className="rounded-md px-3 py-1.5 font-[family-name:var(--font-body)] text-[12px] font-medium transition-opacity"
                      style={{
                        backgroundColor: "var(--color-brand-red)",
                        color: "var(--color-brand-cream)",
                        opacity: pending ? 0.5 : 1,
                      }}
                    >
                      {pending ? "Deleting…" : "Confirm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="rounded-md px-2 py-1.5 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(c.id)}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-[family-name:var(--font-body)] text-[12px] transition-colors hover:bg-[color:var(--color-neutral-700)]"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResetSection({
  title,
  description,
  companies,
  onReset,
}: {
  title: string;
  description: string;
  companies: { id: string; name: string }[];
  onReset: (
    scope: "all" | "company",
    companyId?: string,
  ) => Promise<{ ok: true; cleared: number } | { ok: false; error: string }>;
}) {
  const [scope, setScope] = useState<"all" | "company">("company");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    if (scope === "company" && !selectedCompany) {
      toast.error("Select a company first.");
      return;
    }
    setResetting(true);
    const result = await onReset(
      scope,
      scope === "company" ? selectedCompany : undefined,
    );
    setResetting(false);
    setConfirming(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.cleared === 0) {
      toast("Nothing to clear.");
    } else {
      toast.success(`Cleared ${result.cleared} record${result.cleared === 1 ? "" : "s"}.`);
    }
  }

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: "var(--color-neutral-900)",
        borderColor: "rgba(253, 245, 230, 0.06)",
      }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="font-[family-name:var(--font-body)] text-[15px] font-medium text-[color:var(--color-brand-cream)]">
            Reset {title}
          </h3>
          <p className="mt-1.5 max-w-lg font-[family-name:var(--font-body)] text-[13px] leading-[1.5] text-[color:var(--color-neutral-500)]">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label
            className="mb-1.5 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Scope
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                setScope("company");
                setConfirming(false);
              }}
              className="rounded-md px-3 py-1.5 font-[family-name:var(--font-body)] text-[13px] transition-colors"
              style={{
                backgroundColor:
                  scope === "company"
                    ? "var(--color-brand-red)"
                    : "var(--color-neutral-800)",
                color: "var(--color-brand-cream)",
              }}
            >
              Single company
            </button>
            <button
              type="button"
              onClick={() => {
                setScope("all");
                setConfirming(false);
              }}
              className="rounded-md px-3 py-1.5 font-[family-name:var(--font-body)] text-[13px] transition-colors"
              style={{
                backgroundColor:
                  scope === "all"
                    ? "var(--color-brand-red)"
                    : "var(--color-neutral-800)",
                color: "var(--color-brand-cream)",
              }}
            >
              All clients
            </button>
          </div>
        </div>

        {scope === "company" && (
          <div>
            <label
              className="mb-1.5 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.5px" }}
            >
              Company
            </label>
            <select
              value={selectedCompany}
              onChange={(e) => {
                setSelectedCompany(e.target.value);
                setConfirming(false);
              }}
              className="rounded-md border px-3 py-2 font-[family-name:var(--font-body)] text-[13px]"
              style={{
                backgroundColor: "var(--color-neutral-800)",
                borderColor: "rgba(253, 245, 230, 0.1)",
                color: "var(--color-brand-cream)",
                minWidth: 200,
              }}
            >
              <option value="">Select…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-md px-4 py-2 font-[family-name:var(--font-body)] text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: "var(--color-neutral-800)",
              color: "var(--color-brand-cream)",
              border: "1px solid rgba(253, 245, 230, 0.1)",
            }}
          >
            Reset…
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-brand-red)]">
              This cannot be undone.
            </span>
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="rounded-md px-4 py-2 font-[family-name:var(--font-body)] text-[13px] font-medium transition-opacity"
              style={{
                backgroundColor: "var(--color-brand-red)",
                color: "var(--color-brand-cream)",
                opacity: resetting ? 0.5 : 1,
              }}
            >
              {resetting ? "Clearing…" : "Confirm reset"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-md px-3 py-2 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
