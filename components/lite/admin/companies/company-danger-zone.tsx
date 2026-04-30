"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCompanyAction } from "@/app/lite/admin/companies/[id]/actions";

export function CompanyDangerZone({ companyId, companyName }: { companyId: string; companyName: string }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteCompanyAction(companyId);
      if (result.ok) {
        router.push("/lite/admin/companies");
      } else {
        setError(result.error);
        setDeleting(false);
        setConfirmDelete(false);
      }
    } catch {
      setError("Something went wrong. Try again.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <section
      className="rounded-[12px] p-6"
      style={{
        background: "rgba(200,49,43,0.06)",
        border: "1px solid rgba(200,49,43,0.15)",
      }}
    >
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-red)] mb-3"
        style={{ letterSpacing: "2.5px" }}
      >
        Danger zone
      </div>
      {error && (
        <div className="mb-3 font-[family-name:var(--font-dm-sans)] text-[13px] text-[color:var(--color-brand-red)]">
          {error}
        </div>
      )}
      {!confirmDelete ? (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="rounded-md px-4 py-2 text-[13px] font-medium text-[color:var(--color-brand-red)] border border-[color:rgba(200,49,43,0.3)] hover:bg-[color:rgba(200,49,43,0.1)] transition-colors cursor-pointer"
        >
          Delete {companyName}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[color:var(--color-neutral-300)]">
            This will delete the company, all contacts, deals, and quotes. This can&apos;t be undone.
          </span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md px-4 py-2 text-[13px] font-medium bg-[color:var(--color-brand-red)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {deleting ? "Deleting..." : "Yes, delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="rounded-md px-4 py-2 text-[13px] text-[color:var(--color-neutral-400)] hover:text-[color:var(--color-neutral-200)] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
