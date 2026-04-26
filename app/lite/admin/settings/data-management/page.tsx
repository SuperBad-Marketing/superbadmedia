import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { listCompaniesForResetAction } from "./actions";
import { DataManagementClient } from "./data-management-client";

export const metadata: Metadata = {
  title: "SuperBad — Data Management",
  robots: { index: false, follow: false },
};

export default async function DataManagementPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const companies = await listCompaniesForResetAction();

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          Settings{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">
            Data Management
          </span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.3px" }}
        >
          Data Management
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Reset profiles, clear caches, start fresh.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            irreversible. you&apos;ve been warned.
          </em>
        </p>
      </header>

      <DataManagementClient companies={companies} />
    </div>
  );
}
