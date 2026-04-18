import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { eq } from "drizzle-orm";
import { getPortalSession } from "@/lib/portal/guard";
import { getChatHistory, getTodayChatCount, getDailyLimit } from "@/lib/portal/chat";
import { ChatHome } from "@/components/lite/portal/chat-home";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PortalChatPage({ params }: Props) {
  void (await params);
  const session = await getPortalSession();
  if (!session) {
    redirect("/lite/portal/recover");
  }

  const [contactRow] = await db
    .select({
      name: contacts.name,
      portal_last_visited_at_ms: contacts.portal_last_visited_at_ms,
    })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .limit(1);

  if (!contactRow) {
    redirect("/lite/portal/recover");
  }

  const tourSeen = contactRow.portal_last_visited_at_ms !== null;

  const [history, todayCount, dailyLimit] = await Promise.all([
    getChatHistory(session.contactId),
    getTodayChatCount(session.contactId),
    getDailyLimit(session.contactId),
  ]);

  return (
    <ChatHome
      contactName={contactRow.name}
      initialMessages={history}
      initialRemainingToday={Math.max(0, dailyLimit - todayCount)}
      dailyLimit={dailyLimit}
      tourSeen={tourSeen}
    />
  );
}
