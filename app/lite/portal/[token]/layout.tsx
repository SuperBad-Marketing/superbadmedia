import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/guard";
import { getPortalMode, PORTAL_SECTIONS } from "@/lib/portal/mode";
import { PortalShell } from "@/components/lite/portal/portal-shell";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { eq } from "drizzle-orm";

interface Props {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}

export default async function PortalTokenLayout({ children, params }: Props) {
  const { token } = await params;
  const session = await getPortalSession();
  if (!session) {
    redirect("/lite/portal/recover");
  }

  const [contact] = await db
    .select({ name: contacts.name })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .limit(1);

  if (!contact) {
    redirect("/lite/portal/recover");
  }

  const modeResult = await getPortalMode(session.contactId);

  return (
    <PortalShell
      portalToken={token}
      portalMode={modeResult.mode}
      contactName={contact.name}
      sections={PORTAL_SECTIONS as unknown as Array<{
        key: string;
        label: string;
        eyebrow: string;
        description: string;
        preRetainer: boolean;
      }>}
    >
      {children}
    </PortalShell>
  );
}
