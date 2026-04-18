import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { dncEmails, dncDomains } from "@/lib/db/schema/dnc";
import { desc } from "drizzle-orm";
import { LeadGenTabs } from "../_components/lead-gen-tabs";
import { DncManager } from "../_components/dnc-manager";

export const metadata: Metadata = {
  title: "Lead Gen DNC — SuperBad",
};

export default async function LeadGenDncPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const [emails, domains] = await Promise.all([
    db.select().from(dncEmails).orderBy(desc(dncEmails.added_at)),
    db.select().from(dncDomains).orderBy(desc(dncDomains.added_at)),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <LeadGenTabs currentPath="/lite/admin/lead-gen/dnc" />
      <DncManager emails={emails} domains={domains} />
    </div>
  );
}
