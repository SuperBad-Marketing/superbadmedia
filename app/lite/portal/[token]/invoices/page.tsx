import { requirePortalSession } from "@/lib/portal/require-session";
import { getPortalMode } from "@/lib/portal/mode";
import { SectionLocked } from "@/components/lite/portal/section-locked";
import { PortalInvoicesList } from "@/components/lite/portal/invoices-list";
import { fetchPortalInvoices } from "./actions";

export default async function PortalInvoicesPage() {
  const session = await requirePortalSession();
  const { mode } = await getPortalMode(session.contactId);

  if (mode === "pre_retainer") {
    return <SectionLocked sectionLabel="Invoices" />;
  }

  const invoices = await fetchPortalInvoices();

  return <PortalInvoicesList invoices={invoices} />;
}
